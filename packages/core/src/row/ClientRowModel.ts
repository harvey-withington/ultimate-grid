import type {
  RowModel,
  RowModelType,
  RowNode,
  RowUpdate,
  SortState,
  FilterState,
  ColumnFilterValue,
  TextFilterValue,
  NumberFilterValue,
  DateFilterValue,
  SetFilterValue,
  EventBus as IEventBus,
} from '../types';

const DEFAULT_ROW_HEIGHT = 40;

/**
 * ClientRowModel
 *
 * In-memory row model for client-side data. Owns:
 * - The canonical set of RowNodes built from raw data arrays.
 * - Sort application (stable, multi-column, via comparators or default).
 * - Filter application (text / number / date / set / custom predicates).
 * - Pinned-top and pinned-bottom row collections.
 * - `displayRows` — the ordered, filtered+sorted slice rendered by the grid.
 *
 * Does NOT own selection, editing, or grouping — those are plugin concerns.
 */
export class ClientRowModel<TData = unknown> implements RowModel<TData> {
  readonly type: RowModelType = 'client';

  private _allNodes: RowNode<TData>[] = [];
  private _displayRows: RowNode<TData>[] = [];
  private _pinnedTopRows: RowNode<TData>[] = [];
  private _pinnedBottomRows: RowNode<TData>[] = [];
  private _byId = new Map<string, RowNode<TData>>();

  private _sortState: SortState[] = [];
  private _filterState: FilterState = {};
  private _idCounter = 0;

  constructor(
    private readonly _bus: IEventBus,
    private readonly _defaultRowHeight = DEFAULT_ROW_HEIGHT,
    private readonly _rowIdFn?: (data: TData) => string,
  ) {}

  // ─── RowModel interface ────────────────────────────────────────────────────

  get displayRows(): RowNode<TData>[] { return this._displayRows; }
  get displayRowCount(): number { return this._displayRows.length; }
  get pinnedTopRows(): RowNode<TData>[] { return this._pinnedTopRows; }
  get pinnedBottomRows(): RowNode<TData>[] { return this._pinnedBottomRows; }

  getRowById(rowId: string): RowNode<TData> | null {
    return this._byId.get(rowId) ?? null;
  }

  getRowByDisplayIndex(index: number): RowNode<TData> | null {
    return this._displayRows[index] ?? null;
  }

  // ─── Data mutations ────────────────────────────────────────────────────────

  setRowData(data: TData[]): void {
    this._allNodes = data.map((d, i) => this._buildNode(d, i));
    this._byId.clear();
    for (const node of this._allNodes) {
      this._byId.set(node.rowId, node);
    }
    this._rebuildDisplay();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'api' });
  }

  updateRows(updates: RowUpdate<TData>[]): void {
    for (const update of updates) {
      const node = this._byId.get(update.rowId);
      if (!node) continue;
      node.data = node.data === null
        ? (update.data as TData)
        : { ...node.data, ...update.data };
    }
    this._rebuildDisplay();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'api' });
  }

  addRows(rows: TData[], index?: number): void {
    const newNodes = rows.map((d, i) =>
      this._buildNode(d, (index ?? this._allNodes.length) + i),
    );
    for (const node of newNodes) {
      this._byId.set(node.rowId, node);
    }
    if (index === undefined) {
      this._allNodes.push(...newNodes);
    } else {
      this._allNodes.splice(index, 0, ...newNodes);
    }
    this._rebuildDisplay();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'api' });
  }

  removeRows(rowIds: string[]): void {
    const toRemove = new Set(rowIds);
    this._allNodes = this._allNodes.filter((n) => !toRemove.has(n.rowId));
    for (const id of toRemove) this._byId.delete(id);
    this._rebuildDisplay();
    this._bus.emit('rowDataChanged', { type: 'rowDataChanged', source: 'api' });
  }

  // ─── Expand / collapse (no-op in flat client model, present for interface) ─

  expandRow(_rowId: string): void { /* grouping plugin concern */ }
  collapseRow(_rowId: string): void { /* grouping plugin concern */ }
  expandAll(): void { /* grouping plugin concern */ }
  collapseAll(): void { /* grouping plugin concern */ }

  // ─── Sort ──────────────────────────────────────────────────────────────────

  applySort(sortState: SortState[]): void {
    this._sortState = sortState;
    this._rebuildDisplay();
  }

  // ─── Filter ────────────────────────────────────────────────────────────────

  applyFilter(filterState: FilterState): void {
    this._filterState = filterState;
    this._rebuildDisplay();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private _buildNode(data: TData, rowIndex: number): RowNode<TData> {
    const rowId = this._rowIdFn
      ? this._rowIdFn(data)
      : `row-${++this._idCounter}`;
    return {
      rowId,
      rowType: 'data',
      data,
      level: 0,
      parentId: null,
      childIds: [],
      expanded: false,
      displayIndex: rowIndex,
      rowHeight: this._defaultRowHeight,
      heightMeasured: false,
      selected: false,
      selectable: true,
      pinned: null,
      rowIndex,
    };
  }

  private _rebuildDisplay(): void {
    let rows = this._allNodes.filter((n) => n.pinned === null);

    // Apply filter
    const filterEntries = Object.entries(this._filterState);
    if (filterEntries.length > 0) {
      rows = rows.filter((node) =>
        filterEntries.every(([colId, filterVal]) =>
          this._matchesFilter(node, colId, filterVal),
        ),
      );
    }

    // Apply sort (stable — preserve original order as tiebreak)
    if (this._sortState.length > 0) {
      const sorted = [...this._sortState].sort((a, b) => a.index - b.index);
      rows = rows.slice().sort((a, b) => {
        for (const s of sorted) {
          const valA = this._getValue(a, s.colId);
          const valB = this._getValue(b, s.colId);
          const cmp = this._defaultCompare(valA, valB);
          if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    // Assign display indices
    rows.forEach((node, i) => { node.displayIndex = i; });

    this._displayRows = rows;
    this._pinnedTopRows = this._allNodes.filter((n) => n.pinned === 'top');
    this._pinnedBottomRows = this._allNodes.filter((n) => n.pinned === 'bottom');
  }

  private _getValue(node: RowNode<TData>, colId: string): unknown {
    if (node.data === null) return null;
    return (node.data as Record<string, unknown>)[colId];
  }

  private _defaultCompare(a: unknown, b: unknown): number {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  }

  private _matchesFilter(
    node: RowNode<TData>,
    colId: string,
    filter: ColumnFilterValue,
  ): boolean {
    const raw = this._getValue(node, colId);

    switch (filter.type) {
      case 'text': return this._matchText(raw, filter);
      case 'number': return this._matchNumber(raw, filter);
      case 'date': return this._matchDate(raw, filter);
      case 'set': return this._matchSet(raw, filter);
      case 'custom': return filter.predicate(raw, node as RowNode<unknown>);
      default: return true;
    }
  }

  private _matchText(raw: unknown, f: TextFilterValue): boolean {
    const cell = f.caseSensitive ? String(raw ?? '') : String(raw ?? '').toLowerCase();
    const val  = f.caseSensitive ? f.value : f.value.toLowerCase();
    switch (f.operator) {
      case 'contains':    return cell.includes(val);
      case 'notContains': return !cell.includes(val);
      case 'equals':      return cell === val;
      case 'notEquals':   return cell !== val;
      case 'startsWith':  return cell.startsWith(val);
      case 'endsWith':    return cell.endsWith(val);
      default:            return true;
    }
  }

  private _matchNumber(raw: unknown, f: NumberFilterValue): boolean {
    const n = Number(raw);
    if (isNaN(n)) return false;
    switch (f.operator) {
      case 'equals':             return n === f.value;
      case 'notEquals':          return n !== f.value;
      case 'lessThan':           return n < f.value;
      case 'lessThanOrEqual':    return n <= f.value;
      case 'greaterThan':        return n > f.value;
      case 'greaterThanOrEqual': return n >= f.value;
      case 'inRange':            return n >= f.value && n <= (f.valueTo ?? f.value);
      default:                   return true;
    }
  }

  private _matchDate(raw: unknown, f: DateFilterValue): boolean {
    const cell = new Date(raw as string).getTime();
    const val  = new Date(f.value).getTime();
    if (isNaN(val)) return true; // Invalid filter matches all
    if (isNaN(cell)) return false;
    switch (f.operator) {
      case 'equals':  return cell === val;
      case 'before':  return cell < val;
      case 'beforeOrEqual': return cell <= val;
      case 'after':   return cell > val;
      case 'afterOrEqual':  return cell >= val;
      case 'inRange': {
        const to = f.valueTo ? new Date(f.valueTo).getTime() : val;
        if (isNaN(to)) return true;
        return cell >= val && cell <= to;
      }
      default: return true;
    }
  }

  private _matchSet(raw: unknown, f: SetFilterValue): boolean {
    return f.values.includes(raw);
  }
}
