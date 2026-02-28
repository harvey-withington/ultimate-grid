// ─── Core Types ───────────────────────────────────────────────────────────────
// All public interfaces and type contracts for @ultimate-grid/core.
// Framework adapters import from this file only.

// ─── Cell Coordinate System ───────────────────────────────────────────────────

export interface CellCoord {
  rowId: string;
  colId: string;
}

export interface CellRange {
  start: CellCoord;
  end: CellCoord;
}

export interface CellDisplayCoord {
  rowIndex: number;
  colIndex: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CoordResolver {
  toDisplay(coord: CellCoord): CellDisplayCoord | null;
  fromDisplay(coord: CellDisplayCoord): CellCoord | null;
  isValid(coord: CellCoord): boolean;
  adjacent(coord: CellCoord, direction: Direction): CellCoord | null;
}

// ─── Visible Range ────────────────────────────────────────────────────────────

export interface VisibleRange {
  start: number;
  end: number;
}

// ─── Sort & Filter ────────────────────────────────────────────────────────────

export interface SortState {
  colId: string;
  direction: 'asc' | 'desc';
  index: number;
}

export type SortComparator<TData = unknown> = (
  a: unknown,
  b: unknown,
  nodeA: RowNode<TData>,
  nodeB: RowNode<TData>,
) => number;

export interface TextFilterValue {
  type: 'text';
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith';
  value: string;
  caseSensitive?: boolean;
}

export interface NumberFilterValue {
  type: 'number';
  operator:
    | 'equals'
    | 'notEquals'
    | 'lessThan'
    | 'lessThanOrEqual'
    | 'greaterThan'
    | 'greaterThanOrEqual'
    | 'inRange';
  value: number;
  valueTo?: number;
}

export interface DateFilterValue {
  type: 'date';
  operator: 'equals' | 'before' | 'beforeOrEqual' | 'after' | 'afterOrEqual' | 'inRange';
  value: string;
  valueTo?: string;
}

export interface SetFilterValue {
  type: 'set';
  values: unknown[];
}

export interface CustomFilterValue {
  type: 'custom';
  predicate: (value: unknown, rowNode: RowNode) => boolean;
}

export type ColumnFilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | SetFilterValue
  | CustomFilterValue;

export interface FilterState {
  [colId: string]: ColumnFilterValue;
}

// ─── Row Model ────────────────────────────────────────────────────────────────

export type RowType = 'data' | 'group' | 'aggregate' | 'loading' | 'pinnedTop' | 'pinnedBottom';
export type RowModelType = 'client' | 'server' | 'infinite';

export interface RowNode<TData = unknown> {
  readonly rowId: string;
  readonly rowType: RowType;
  data: TData | null;
  readonly level: number;
  readonly parentId: string | null;
  childIds: string[];
  expanded: boolean;
  displayIndex: number;
  rowHeight: number;
  heightMeasured: boolean;
  selected: boolean;
  selectable: boolean;
  pinned: 'top' | 'bottom' | null;
  readonly rowIndex: number;
}

export interface RowUpdate<TData = unknown> {
  rowId: string;
  data: Partial<TData>;
}

export interface ServerRowRequest {
  startRow: number;
  endRow: number;
  sortModel: SortState[];
  filterModel: FilterState;
  groupKeys: string[];
}

export interface RowModel<TData = unknown> {
  readonly type: RowModelType;
  readonly displayRows: RowNode<TData>[];
  readonly displayRowCount: number;
  readonly pinnedTopRows: RowNode<TData>[];
  readonly pinnedBottomRows: RowNode<TData>[];
  getRowById(rowId: string): RowNode<TData> | null;
  getRowByDisplayIndex(index: number): RowNode<TData> | null;
  setRowData(data: TData[]): void;
  updateRows(updates: RowUpdate<TData>[]): void;
  addRows(rows: TData[], index?: number): void;
  removeRows(rowIds: string[]): void;
  expandRow(rowId: string): void;
  collapseRow(rowId: string): void;
  expandAll(): void;
  collapseAll(): void;
  applySort(sortState: SortState[]): void;
  applyFilter(filterState: FilterState): void;
  requestRows?(params: ServerRowRequest): void;
}

// ─── Column Model ─────────────────────────────────────────────────────────────

export type AggFunc = (values: unknown[]) => unknown;

export type CellClassFn<TData = unknown> = (params: CellRendererParams<TData>) => string;
export type CellStyleFn<TData = unknown> = (
  params: CellRendererParams<TData>,
) => Record<string, string>;
export type EditableFn<TData = unknown> = (node: RowNode<TData>) => boolean;

export interface ValueGetterParams<TData = unknown> {
  data: TData | null;
  rowNode: RowNode<TData>;
  colId: string;
}

export interface ValueFormatterParams<TData = unknown> {
  value: unknown;
  data: TData | null;
  rowNode: RowNode<TData>;
  colId: string;
}

export interface ValueParserParams<TData = unknown> {
  oldValue: unknown;
  newValue: unknown;
  data: TData | null;
  rowNode: RowNode<TData>;
  colId: string;
}

export interface ValueSetterParams<TData = unknown> {
  oldValue: unknown;
  newValue: unknown;
  data: TData | null;
  rowNode: RowNode<TData>;
  colId: string;
}

export interface ColumnDef<TData = unknown> {
  key: string;
  field?: keyof TData | string;
  headerName?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number;
  pinned?: 'left' | 'right' | null;
  hidden?: boolean;
  cellRenderer?: CellRenderer<TData>;
  cellClass?: string | CellClassFn<TData>;
  cellStyle?: Record<string, string> | CellStyleFn<TData>;
  headerRenderer?: HeaderRenderer;
  headerClass?: string;
  headerTooltip?: string;
  sortable?: boolean;
  comparator?: SortComparator<TData>;
  filterable?: boolean;
  filterIcon?: boolean;
  filterType?: 'text' | 'number' | 'date' | 'set' | 'custom';
  filterParams?: Record<string, unknown>;
  editable?: boolean | EditableFn<TData>;
  cellEditor?: CellEditor<TData>;
  valueParser?: (params: ValueParserParams<TData>) => unknown;
  valueSetter?: (params: ValueSetterParams<TData>) => boolean;
  valueGetter?: (params: ValueGetterParams<TData>) => unknown;
  valueFormatter?: (params: ValueFormatterParams<TData>) => string;
  aggFunc?: AggFunc | string;
  columnGroupId?: string;
  resizable?: boolean;
  lockPosition?: boolean;
  lockPinned?: boolean;
}

export interface Column<TData = unknown> {
  readonly colId: string;
  readonly def: ColumnDef<TData>;
  width: number;
  left: number;
  visible: boolean;
  pinned: 'left' | 'right' | null;
  sortIndex: number | null;
  sortDirection: 'asc' | 'desc' | null;
  filterActive: boolean;
}

export interface ColumnModel<TData = unknown> {
  readonly all: Column<TData>[];
  readonly visible: Column<TData>[];
  readonly pinnedLeft: Column<TData>[];
  readonly pinnedRight: Column<TData>[];
  readonly center: Column<TData>[];
  readonly totalWidth: number;
  readonly centerWidth: number;
  getById(colId: string): Column<TData> | null;
  setWidth(colId: string, width: number): void;
  setVisible(colId: string, visible: boolean): void;
  setPinned(colId: string, pinned: 'left' | 'right' | null): void;
  moveColumn(colId: string, toIndex: number): void;
  setSort(colId: string, direction: 'asc' | 'desc' | null, multiSort?: boolean): void;
  setFilter(colId: string, filterValue: unknown): void;
}

// ─── Viewport & Virtual Scroll ────────────────────────────────────────────────

export interface Viewport {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
  rowRange: VisibleRange;
  colRange: VisibleRange;
  rowOverscan: number;
  colOverscan: number;
  totalHeight: number;
  totalWidth: number;
}

export interface VirtualScrollEngine {
  init(container: HTMLElement, viewport: Viewport): void;
  setRowHeight(displayIndex: number, height: number): void;
  getRowOffset(displayIndex: number): number;
  getRowAtOffset(y: number): number;
  getTotalHeight(): number;
  setColumnWidth(colIndex: number, width: number): void;
  getColumnOffset(colIndex: number): number;
  getColumnAtOffset(x: number): number;
  getTotalWidth(): number;
  onScroll(scrollTop: number, scrollLeft: number): void;
  scrollToRow(displayIndex: number, position?: 'top' | 'middle' | 'bottom'): void;
  scrollToColumn(colIndex: number): void;
  scrollToCell(coord: CellCoord): void;
  recalculate(): void;
  getVisibleRowRange(): VisibleRange;
  getVisibleColRange(): VisibleRange;
}

// ─── Selection Model ──────────────────────────────────────────────────────────

export type SelectionMode = 'single' | 'multi' | 'range' | 'none';
export type SelectionUnit = 'row' | 'cell';

export interface SelectionModel {
  readonly mode: SelectionMode;
  readonly unit: SelectionUnit;
  readonly selectedRowIds: Set<string>;
  readonly selectedRanges: CellRange[];
  readonly focusedCell: CellCoord | null;
  readonly anchorCell: CellCoord | null;
  selectRow(rowId: string, extend?: boolean): void;
  deselectRow(rowId: string): void;
  selectAll(): void;
  deselectAll(): void;
  isRowSelected(rowId: string): boolean;
  selectCell(coord: CellCoord, extend?: boolean): void;
  selectRange(start: CellCoord, end: CellCoord): void;
  isCellSelected(coord: CellCoord): boolean;
  isCellInRange(coord: CellCoord): boolean;
  setFocus(coord: CellCoord): void;
  moveFocus(direction: Direction): void;
}

// ─── Edit Model ───────────────────────────────────────────────────────────────

export interface EditState {
  active: boolean;
  coord: CellCoord | null;
  initialValue: unknown;
  currentValue: unknown;
}

export interface CellEditorParams<TData = unknown> {
  value: unknown;
  rowNode: RowNode<TData>;
  column: Column<TData>;
  coord: CellCoord;
  eventKey: string | null;
  stopEditing: (cancel?: boolean) => void;
}

export interface CellEditor<TData = unknown> {
  init(params: CellEditorParams<TData>): void;
  getGui(): HTMLElement;
  getValue(): unknown;
  destroy(): void;
  isPopup?(): boolean;
  isCancelAfterEnd?(): boolean;
  focusIn?(): void;
  focusOut?(): void;
}

// ─── Cell & Header Renderers ──────────────────────────────────────────────────

export interface CellRendererParams<TData = unknown> {
  value: unknown;
  rawValue: unknown;
  data: TData | null;
  rowNode: RowNode<TData>;
  column: Column<TData>;
  coord: CellCoord;
  api: GridApi<TData>;
}

export interface CellRenderer<TData = unknown> {
  init(params: CellRendererParams<TData>): void;
  getGui(): HTMLElement;
  refresh(params: CellRendererParams<TData>): boolean;
  destroy?(): void;
}

export interface HeaderRenderer {
  init(params: HeaderRendererParams): void;
  getGui(): HTMLElement;
  destroy?(): void;
}

export interface HeaderRendererParams {
  column: Column;
  displayName: string;
  api: GridApi;
}

// ─── Event Bus ────────────────────────────────────────────────────────────────

export interface GridEvent {
  type: string;
  source?: 'user' | 'api' | 'internal';
}

export interface RowDataChangedEvent extends GridEvent { type: 'rowDataChanged'; }
export interface ScrollEvent extends GridEvent { type: 'scroll'; scrollTop: number; scrollLeft: number; }
export interface ViewportChangedEvent extends GridEvent { type: 'viewportChanged'; rowRange: VisibleRange; colRange: VisibleRange; }
export interface CellClickedEvent extends GridEvent { type: 'cellClicked'; coord: CellCoord; rowNode: RowNode; event: MouseEvent; }
export interface CellDoubleClickedEvent extends GridEvent { type: 'cellDoubleClicked'; coord: CellCoord; event: MouseEvent; }
export interface CellKeyDownEvent extends GridEvent { type: 'cellKeyDown'; coord: CellCoord; event: KeyboardEvent; }
export interface SelectionChangedEvent extends GridEvent { type: 'selectionChanged'; selectedRowIds: string[]; }
export interface SortChangedEvent extends GridEvent { type: 'sortChanged'; sortState: SortState[]; }
export interface FilterChangedEvent extends GridEvent { type: 'filterChanged'; filterState: FilterState; }
export interface ColumnResizedEvent extends GridEvent { type: 'columnResized'; colId: string; width: number; finished: boolean; }
export interface ColumnMovedEvent extends GridEvent { type: 'columnMoved'; colId: string; toIndex: number; }
export interface RowGroupChangedEvent extends GridEvent { type: 'rowGroupChanged'; }
export interface EditStartedEvent extends GridEvent { type: 'editStarted'; coord: CellCoord; }
export interface EditStoppedEvent extends GridEvent { type: 'editStopped'; coord: CellCoord; value: unknown; cancelled: boolean; }

export interface GridEventMap {
  rowDataChanged: RowDataChangedEvent;
  scroll: ScrollEvent;
  viewportChanged: ViewportChangedEvent;
  cellClicked: CellClickedEvent;
  cellDoubleClicked: CellDoubleClickedEvent;
  cellKeyDown: CellKeyDownEvent;
  selectionChanged: SelectionChangedEvent;
  sortChanged: SortChangedEvent;
  filterChanged: FilterChangedEvent;
  columnResized: ColumnResizedEvent;
  columnMoved: ColumnMovedEvent;
  rowGroupChanged: RowGroupChangedEvent;
  editStarted: EditStartedEvent;
  editStopped: EditStoppedEvent;
  [key: string]: GridEvent;
}

export interface EventBus {
  on<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): () => void;
  off<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): void;
  emit<K extends keyof GridEventMap>(event: K, payload: GridEventMap[K]): void;
}

// ─── Plugin System ────────────────────────────────────────────────────────────

export interface GridPlugin {
  readonly pluginId: string;
  init(context: GridPluginContext): void;
  destroy(): void;
}

export interface GridPluginContext {
  eventBus: EventBus;
  rowModel: RowModel;
  columnModel: ColumnModel;
  selectionModel: SelectionModel;
  viewport: Viewport;
  options: GridOptions;
  getPlugin<T extends GridPlugin>(pluginId: string): T | null;
}

// ─── Grid State ───────────────────────────────────────────────────────────────

export interface ColumnState {
  colId: string;
  width: number;
  visible: boolean;
  pinned: 'left' | 'right' | null;
  sortIndex: number | null;
  sortDirection: 'asc' | 'desc' | null;
  filterActive: boolean;
  index: number;
}

export interface GridState {
  columns: ColumnState[];
  sort: SortState[];
  filter: FilterState;
  selection: {
    selectedRowIds: string[];
    focusedCell: CellCoord | null;
  };
  scroll: {
    scrollTop: number;
    scrollLeft: number;
  };
  rowGroups: {
    expandedRowIds: string[];
  };
}

// ─── Grid Options ─────────────────────────────────────────────────────────────

export interface GridTheme {
  [cssVar: string]: string;
}

export interface GridLocale {
  [key: string]: string;
}

export interface ExportParams {
  fileName?: string;
  columnKeys?: string[];
  onlySelected?: boolean;
}

export interface GridDatasource<TData = unknown> {
  getRows(params: ServerRowRequest): Promise<{
    rows: TData[];
    totalCount: number;
  }>;
}

export interface GridOptions<TData = unknown> {
  rowData?: TData[];
  columnDefs: ColumnDef<TData>[];
  getRowId?: (data: TData) => string;
  rowModelType?: RowModelType;
  rowHeight?: number;
  getRowHeight?: (node: RowNode<TData>) => number;
  headerHeight?: number;
  groupHeaderHeight?: number;
  pinnedTopRowData?: TData[];
  pinnedBottomRowData?: TData[];
  selectionMode?: SelectionMode;
  selectionUnit?: SelectionUnit;
  isRowSelectable?: (node: RowNode<TData>) => boolean;
  sortable?: boolean;
  multiSort?: boolean;
  initialSort?: SortState[];
  filterable?: boolean;
  initialFilter?: FilterState;
  editable?: boolean;
  editOnSingleClick?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
  defaultColWidth?: number;
  autoSizeColumns?: boolean;
  groupByFields?: string[];
  groupDefaultExpanded?: number;
  showGroupCount?: boolean;
  rowOverscan?: number;
  colOverscan?: number;
  estimatedRowHeight?: number;
  theme?: string | GridTheme;
  plugins?: GridPlugin[];
  enabledPlugins?: string[];
  locale?: GridLocale;
  ariaLabel?: string;
  onGridReady?: (api: GridApi<TData>) => void;
  initialState?: Partial<GridState>;
  onStateChanged?: (state: GridState) => void;
  datasource?: GridDatasource<TData>;
}

// ─── Grid API ─────────────────────────────────────────────────────────────────

export interface GridApi<TData = unknown> {
  setRowData(data: TData[]): void;
  updateRows(updates: RowUpdate<TData>[]): void;
  addRows(rows: TData[], index?: number): void;
  removeRows(rowIds: string[]): void;
  getRowNode(rowId: string): RowNode<TData> | null;
  getDisplayedRowCount(): number;
  selectAll(): void;
  deselectAll(): void;
  getSelectedRowIds(): string[];
  getSelectedRows(): TData[];
  setSortModel(sort: SortState[]): void;
  setFilterModel(filter: FilterState): void;
  getSortModel(): SortState[];
  getFilterModel(): FilterState;
  setColumnVisible(colId: string, visible: boolean): void;
  setColumnWidth(colId: string, width: number): void;
  setColumnPinned(colId: string, pinned: 'left' | 'right' | null): void;
  moveColumn(colId: string, toIndex: number): void;
  autoSizeColumn(colId: string): void;
  autoSizeAllColumns(): void;
  scrollToRow(rowId: string, position?: 'top' | 'middle' | 'bottom'): void;
  scrollToColumn(colId: string): void;
  ensureCellVisible(coord: CellCoord): void;
  startEditing(coord: CellCoord): void;
  stopEditing(cancel?: boolean): void;
  exportToCsv(params?: ExportParams): void;
  exportToExcel(params?: ExportParams): void;
  getState(): GridState;
  applyState(state: Partial<GridState>): void;
  destroy(): void;
  on<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): () => void;
}
