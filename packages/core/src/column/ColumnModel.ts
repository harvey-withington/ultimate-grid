import type {
  ColumnDef,
  Column,
  ColumnModel as IColumnModel,
  EventBus as IEventBus,
  SortState,
} from '../types';

const DEFAULT_WIDTH = 150;
const DEFAULT_MIN_WIDTH = 50;

/**
 * ColumnModel
 *
 * Owns the live state of all columns: order, width, visibility, pinning,
 * sort indicators, and filter-active flags. Fires EventBus events on every
 * mutation so other modules (VirtualScrollEngine, RenderPipeline, plugins)
 * can react without polling.
 *
 * Accepts an array of ColumnDef (user-provided) and builds internal Column
 * objects. The original ColumnDef is never mutated.
 */
export class ColumnModel<TData = unknown> implements IColumnModel<TData> {
  private _columns: Column<TData>[] = [];
  private _byId = new Map<string, Column<TData>>();

  constructor(
    defs: ColumnDef<TData>[],
    private readonly _bus: IEventBus,
    private readonly _defaultColWidth: number = DEFAULT_WIDTH,
  ) {
    this._init(defs);
  }

  // ─── IColumnModel accessors ────────────────────────────────────────────────

  get all(): Column<TData>[] {
    return this._columns;
  }

  get visible(): Column<TData>[] {
    return this._columns.filter((c) => c.visible);
  }

  get pinnedLeft(): Column<TData>[] {
    return this._columns.filter((c) => c.visible && c.pinned === 'left');
  }

  get pinnedRight(): Column<TData>[] {
    return this._columns.filter((c) => c.visible && c.pinned === 'right');
  }

  get center(): Column<TData>[] {
    return this._columns.filter((c) => c.visible && c.pinned === null);
  }

  get totalWidth(): number {
    return this.visible.reduce((sum, c) => sum + c.width, 0);
  }

  get sortState(): SortState[] {
    return this._columns
      .filter((c) => c.sortDirection !== null && c.sortIndex !== null)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((c) => ({ colId: c.colId, direction: c.sortDirection!, index: c.sortIndex! }));
  }

  get centerWidth(): number {
    return this.center.reduce((sum, c) => sum + c.width, 0);
  }

  getById(colId: string): Column<TData> | null {
    return this._byId.get(colId) ?? null;
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  setWidth(colId: string, width: number): void {
    const col = this._mustGet(colId);
    const clamped = this._clampWidth(col, width);
    if (col.width === clamped) return;
    col.width = clamped;
    this._recalcLeftOffsets();
    this._bus.emit('columnResized', {
      type: 'columnResized',
      source: 'api',
      colId,
      width: clamped,
      finished: true,
    });
  }

  setVisible(colId: string, visible: boolean): void {
    const col = this._mustGet(colId);
    if (col.visible === visible) return;
    col.visible = visible;
    this._recalcLeftOffsets();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'internal' });
  }

  setPinned(colId: string, pinned: 'left' | 'right' | null): void {
    const col = this._mustGet(colId);
    if (col.pinned === pinned) return;
    if (col.def.lockPinned) return;
    col.pinned = pinned;
    this._recalcLeftOffsets();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'internal' });
  }

  moveColumn(colId: string, toIndex: number): void {
    const col = this._mustGet(colId);
    if (col.def.lockPosition) return;
    const fromIndex = this._columns.indexOf(col);
    if (fromIndex === toIndex) return;

    this._columns.splice(fromIndex, 1);
    const clampedTo = Math.max(0, Math.min(toIndex, this._columns.length));
    this._columns.splice(clampedTo, 0, col);
    this._recalcLeftOffsets();
    this._bus.emit('columnMoved', {
      type: 'columnMoved',
      source: 'api',
      colId,
      toIndex: clampedTo,
    });
  }

  setSort(colId: string, direction: 'asc' | 'desc' | null, multiSort = false): void {
    const col = this._mustGet(colId);

    if (!multiSort) {
      // Clear all other sort indicators
      for (const c of this._columns) {
        if (c.colId !== colId) {
          c.sortDirection = null;
          c.sortIndex = null;
        }
      }
    }

    col.sortDirection = direction;
    col.sortIndex = direction === null ? null : this._nextSortIndex(colId);

    const sortState = this._columns
      .filter((c) => c.sortDirection !== null && c.sortIndex !== null)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((c) => ({ colId: c.colId, direction: c.sortDirection!, index: c.sortIndex! }));

    this._bus.emit('sortChanged', { type: 'sortChanged', source: 'api', sortState });
  }

  setFilter(colId: string, filterValue: unknown): void {
    const col = this._mustGet(colId);
    col.filterActive = filterValue !== null && filterValue !== undefined;
    
    // We shouldn't guess the full filter state here since ColumnModel only knows about this one column's active state,
    // not its actual value. In the new architecture, GridCore or the caller manages the full FilterState and passes it down.
    // So ColumnModel just tracks the boolean `filterActive` flag for UI (e.g., highlighting a filter icon).
    // The actual filtering is done via GridCore.setFilterModel which delegates to RowModel.
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  private _init(defs: ColumnDef<TData>[]): void {
    this._columns = defs.map((def) => this._buildColumn(def));
    this._byId.clear();
    for (const col of this._columns) {
      this._byId.set(col.colId, col);
    }
    this._recalcLeftOffsets();
  }

  private _buildColumn(def: ColumnDef<TData>): Column<TData> {
    return {
      colId: def.key,
      def,
      width: def.width ?? this._defaultColWidth,
      left: 0,
      visible: def.hidden !== true,
      pinned: def.pinned ?? null,
      sortIndex: null,
      sortDirection: null,
      filterActive: false,
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private _recalcLeftOffsets(): void {
    let leftOffset = 0;
    let centerOffset = 0;
    let rightOffset = 0;

    // Pinned-left columns accumulate from 0
    for (const col of this._columns.filter((c) => c.visible && c.pinned === 'left')) {
      col.left = leftOffset;
      leftOffset += col.width;
    }
    // Center columns accumulate from 0 (their scroll container starts at 0)
    for (const col of this._columns.filter((c) => c.visible && c.pinned === null)) {
      col.left = centerOffset;
      centerOffset += col.width;
    }
    // Pinned-right columns accumulate from 0 (sticky right, measured from right edge)
    for (const col of this._columns.filter((c) => c.visible && c.pinned === 'right')) {
      col.left = rightOffset;
      rightOffset += col.width;
    }
  }

  private _clampWidth(col: Column<TData>, width: number): number {
    const min = col.def.minWidth ?? DEFAULT_MIN_WIDTH;
    const max = col.def.maxWidth ?? Infinity;
    return Math.max(min, Math.min(max, width));
  }

  private _mustGet(colId: string): Column<TData> {
    const col = this._byId.get(colId);
    if (!col) throw new Error(`ColumnModel: unknown colId "${colId}"`);
    return col;
  }

  private _nextSortIndex(excludeColId: string): number {
    let max = -1;
    for (const c of this._columns) {
      if (c.colId !== excludeColId && c.sortIndex !== null) {
        max = Math.max(max, c.sortIndex);
      }
    }
    return max + 1;
  }

}
