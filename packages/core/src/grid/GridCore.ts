import type {
  GridOptions,
  GridApi,
  GridState,
  GridPlugin,
  GridPluginContext,
  RowNode,
  RowUpdate,
  SortState,
  FilterState,
  CellCoord,
  GridEventMap,
  SelectionModel,
  Viewport,
  ColumnState,
  ExportParams,
} from '../types';
import { EventBus } from '../events/EventBus';
import { ColumnModel } from '../column/ColumnModel';
import { ClientRowModel } from '../row/ClientRowModel';
import { VirtualScrollEngine } from '../virtual-scroll/VirtualScrollEngine';

/**
 * GridCore
 *
 * The central coordinator for the data grid. Owns and wires together:
 *   - EventBus       — all inter-module communication
 *   - ColumnModel    — column state, ordering, widths, pinning
 *   - ClientRowModel — client-side rows, sort, filter
 *   - VirtualScrollEngine — virtual row/col windowing
 *   - Plugin registry
 *
 * Exposes a full GridApi surface. Does NOT own DOM rendering — that is the
 * responsibility of framework adapters or a future RenderPipeline module.
 *
 * Usage:
 *   const core = new GridCore(options, containerElement);
 *   const api = core.getApi();
 */
export class GridCore<TData = unknown> {
  private readonly _bus: EventBus;
  private readonly _columnModel: ColumnModel<TData>;
  private readonly _rowModel: ClientRowModel<TData>;
  private readonly _vse: VirtualScrollEngine;
  private readonly _plugins = new Map<string, GridPlugin>();
  private readonly _options: GridOptions<TData>;

  private _sortState: SortState[] = [];
  private _filterState: FilterState = {};
  private _destroyed = false;

  constructor(options: GridOptions<TData>, container?: HTMLElement) {
    this._options = options;

    // 1. EventBus
    this._bus = new EventBus();

    // 2. ColumnModel
    this._columnModel = new ColumnModel<TData>(
      options.columnDefs,
      this._bus,
      options.defaultColWidth,
    );

    // 3. RowModel
    this._rowModel = new ClientRowModel<TData>(
      this._bus,
      options.rowHeight ?? 40,
      options.getRowId,
    );

    // 4. VirtualScrollEngine
    this._vse = new VirtualScrollEngine();
    if (container) {
      const viewport: Viewport = {
        width: container.clientWidth,
        height: container.clientHeight,
        scrollTop: 0,
        scrollLeft: 0,
        rowOverscan: options.rowOverscan ?? 3,
        colOverscan: options.colOverscan ?? 2,
        rowRange: { start: 0, end: -1 },
        colRange: { start: 0, end: -1 },
        totalHeight: 0,
        totalWidth: 0,
      };
      this._vse.init(container, viewport);
    }

    // 5. Wire sort/filter events back into row model
    this._bus.on('sortChanged', (e) => {
      this._sortState = e.sortState;
      this._rowModel.applySort(this._sortState);
    });
    this._bus.on('filterChanged', (e) => {
      this._filterState = e.filterState as FilterState;
      this._rowModel.applyFilter(this._filterState);
    });

    // 6. Initial data
    if (options.rowData) {
      this._rowModel.setRowData(options.rowData);
    }

    // 7. Initial sort/filter
    if (options.initialSort?.length) {
      this._sortState = options.initialSort;
      // Sync sort indicators onto ColumnModel so header cells reflect initial sort
      for (const s of this._sortState) {
        const col = this._columnModel.getById(s.colId);
        if (col) {
          col.sortDirection = s.direction;
          col.sortIndex     = s.index;
        }
      }
      this._rowModel.applySort(this._sortState);
    }
    if (options.initialFilter && Object.keys(options.initialFilter).length) {
      this._filterState = options.initialFilter;
      this._rowModel.applyFilter(this._filterState);
    }

    // 8. Initialise column widths in VSE
    this._syncVseColumns();
    this._bus.on('columnResized', () => this._syncVseColumns());
    this._bus.on('columnMoved', () => this._syncVseColumns());

    // 9. Plugins
    if (options.plugins) {
      for (const plugin of options.plugins) {
        this._registerPlugin(plugin);
      }
    }
  }

  // ─── Public API factory ────────────────────────────────────────────────────

  getApi(): GridApi<TData> {
    const self = this;
    const api: GridApi<TData> = {
      // ── Row data ──
      setRowData(data: TData[]) { self._rowModel.setRowData(data); },
      updateRows(updates: RowUpdate<TData>[]) { self._rowModel.updateRows(updates); },
      addRows(rows: TData[], index?: number) { self._rowModel.addRows(rows, index); },
      removeRows(rowIds: string[]) { self._rowModel.removeRows(rowIds); },
      getRowNode(rowId: string): RowNode<TData> | null {
        return self._rowModel.getRowById(rowId);
      },
      getDisplayedRowCount(): number {
        return self._rowModel.displayRowCount;
      },

      // ── Selection (stubs — SelectionPlugin will override) ──
      selectAll() { self._bus.emit('selectionChanged', { type: 'selectionChanged', source: 'api', selectedRowIds: [] }); },
      deselectAll() { self._bus.emit('selectionChanged', { type: 'selectionChanged', source: 'api', selectedRowIds: [] }); },
      getSelectedRowIds(): string[] { return []; },
      getSelectedRows(): TData[] { return []; },

      // ── Sort ──
      setSortModel(sort: SortState[]) {
        self._sortState = sort;
        self._rowModel.applySort(sort);
        self._bus.emit('sortChanged', { type: 'sortChanged', source: 'api', sortState: sort });
      },
      getSortModel(): SortState[] { return [...self._sortState]; },

      // ── Filter ──
      setFilterModel(filter: FilterState) {
        self._filterState = filter;
        self._rowModel.applyFilter(filter);
        self._bus.emit('filterChanged', { type: 'filterChanged', source: 'api', filterState: filter });
      },
      getFilterModel(): FilterState { return { ...self._filterState }; },

      // ── Column mutations ──
      setColumnVisible(colId: string, visible: boolean) {
        self._columnModel.setVisible(colId, visible);
      },
      setColumnWidth(colId: string, width: number) {
        self._columnModel.setWidth(colId, width);
      },
      setColumnPinned(colId: string, pinned: 'left' | 'right' | null) {
        self._columnModel.setPinned(colId, pinned);
      },
      moveColumn(colId: string, toIndex: number) {
        self._columnModel.moveColumn(colId, toIndex);
      },

      // ── Auto-size (stub — requires DOM measurement) ──
      autoSizeColumn(_colId: string) { /* RenderPipeline concern */ },
      autoSizeAllColumns() { /* RenderPipeline concern */ },

      // ── Scroll ──
      scrollToRow(rowId: string, position?: 'top' | 'middle' | 'bottom') {
        const node = self._rowModel.getRowById(rowId);
        if (!node) return;
        self._vse.scrollToRow(node.displayIndex, position);
      },
      scrollToColumn(colId: string) {
        const col = self._columnModel.getById(colId);
        if (!col) return;
        const idx = self._columnModel.center.indexOf(col);
        if (idx >= 0) self._vse.scrollToColumn(idx);
      },
      ensureCellVisible(coord: CellCoord) {
        api.scrollToRow(coord.rowId);
        api.scrollToColumn(coord.colId);
      },

      // ── Edit (stubs — EditPlugin concern) ──
      startEditing(_coord: CellCoord) { /* EditPlugin concern */ },
      stopEditing(_cancel?: boolean) { /* EditPlugin concern */ },

      // ── Export (stubs — ExportPlugin concern) ──
      exportToCsv(_params?: ExportParams) { /* ExportPlugin concern */ },
      exportToExcel(_params?: ExportParams) { /* ExportPlugin concern */ },

      // ── State ──
      getState(): GridState { return self._buildState(); },
      applyState(state: Partial<GridState>) { self._applyState(state); },

      // ── Lifecycle ──
      destroy() { self.destroy(); },

      // ── Events ──
      on<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void) {
        return self._bus.on(event, handler);
      },
    };
    return api;
  }

  // ─── Accessors for testing / advanced use ──────────────────────────────────

  get eventBus(): EventBus { return this._bus; }
  get columnModel(): ColumnModel<TData> { return this._columnModel; }
  get rowModel(): ClientRowModel<TData> { return this._rowModel; }
  get virtualScrollEngine(): VirtualScrollEngine { return this._vse; }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const plugin of this._plugins.values()) {
      try { plugin.destroy(); } catch { /* isolate plugin errors */ }
    }
    this._plugins.clear();
    this._vse.destroy();
    this._bus.clear();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _syncVseColumns(): void {
    const widths = this._columnModel.center.map((c) => c.width);
    if (widths.length > 0) {
      this._vse.initColumns(widths);
    }
  }

  private _registerPlugin(plugin: GridPlugin): void {
    if (this._plugins.has(plugin.pluginId)) return;
    this._plugins.set(plugin.pluginId, plugin);
    const context: GridPluginContext = {
      eventBus: this._bus,
      rowModel: this._rowModel,
      columnModel: this._columnModel as unknown as ColumnModel,
      selectionModel: null as unknown as SelectionModel, // provided by SelectionPlugin
      viewport: {
        width: 0,
        height: 0,
        scrollTop: 0,
        scrollLeft: 0,
        rowOverscan: this._options.rowOverscan ?? 3,
        colOverscan: this._options.colOverscan ?? 2,
        rowRange: { start: 0, end: -1 },
        colRange: { start: 0, end: -1 },
        totalHeight: 0,
        totalWidth: 0,
      },
      options: this._options as GridOptions,
      getPlugin: <T extends GridPlugin>(id: string) =>
        (this._plugins.get(id) as T | undefined) ?? null,
    };
    plugin.init(context);
  }

  private _buildState(): GridState {
    const columns: ColumnState[] = this._columnModel.all.map((col, i) => ({
      colId: col.colId,
      width: col.width,
      visible: col.visible,
      pinned: col.pinned,
      sortIndex: col.sortIndex,
      sortDirection: col.sortDirection,
      filterActive: col.filterActive,
      index: i,
    }));

    return {
      columns,
      sort: [...this._sortState],
      filter: { ...this._filterState },
      selection: { selectedRowIds: [], focusedCell: null },
      scroll: {
        scrollTop: 0,
        scrollLeft: 0,
      },
      rowGroups: { expandedRowIds: [] },
    };
  }

  private _applyState(state: Partial<GridState>): void {
    if (state.sort) {
      this._sortState = state.sort;
      this._rowModel.applySort(this._sortState);
      this._bus.emit('sortChanged', { type: 'sortChanged', source: 'api', sortState: this._sortState });
    }
    if (state.filter) {
      this._filterState = state.filter;
      this._rowModel.applyFilter(this._filterState);
      this._bus.emit('filterChanged', { type: 'filterChanged', source: 'api', filterState: this._filterState });
    }
    if (state.columns) {
      for (const cs of state.columns) {
        const col = this._columnModel.getById(cs.colId);
        if (!col) continue;
        this._columnModel.setWidth(cs.colId, cs.width);
        this._columnModel.setVisible(cs.colId, cs.visible);
        this._columnModel.setPinned(cs.colId, cs.pinned);
      }
    }
  }
}
