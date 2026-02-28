# Ultimate Data Grid — Architecture & Data Structures

> This document defines the core data structures, interfaces, and architectural contracts for the Ultimate Data Grid. It is framework-agnostic. All framework adapters (React, Vue, Svelte, Angular, etc.) are thin wrappers over this core.

---

## Table of Contents

1. [Guiding Principles](#guiding-principles)
2. [High-Level Architecture](#high-level-architecture)
3. [Column Model](#column-model)
4. [Row Model](#row-model)
5. [Viewport & Virtual Scroll Engine](#viewport--virtual-scroll-engine)
6. [Cell Coordinate System](#cell-coordinate-system)
7. [Selection Model](#selection-model)
8. [Sort & Filter Model](#sort--filter-model)
9. [Edit Model](#edit-model)
10. [Event Bus](#event-bus)
11. [Plugin System](#plugin-system)
12. [Grid State](#grid-state)
13. [Grid Options (Public API)](#grid-options-public-api)
14. [Framework Adapter Contract](#framework-adapter-contract)
15. [Rendering Pipeline](#rendering-pipeline)
16. [DOM Structure](#dom-structure)

---

## Guiding Principles

- **Vanilla JS core.** Zero runtime dependencies. Framework adapters are separate packages.
- **Data model owns truth.** Rendering is a pure function of state. Never mutate the DOM directly outside the render pipeline.
- **Virtual scroll from day one.** All row/column indexing accounts for virtualization. There is no "simple mode" that skips it.
- **Plugin architecture.** Sorting, filtering, editing, grouping, selection are all feature modules. The core is a render engine + event bus + viewport manager. Nothing more.
- **Cell coordinate system is universal.** Every feature — keyboard nav, selection, editing, copy/paste — operates on `CellCoord`. No feature may address a cell any other way.
- **Immutable-friendly.** State updates produce new state objects. The grid can be driven reactively or imperatively.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GridOptions                         │  ← Public API / Config
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                      GridCore                           │
│                                                         │
│   ┌─────────────┐   ┌──────────────┐   ┌─────────────┐ │
│   │  RowModel   │   │  ColumnModel │   │  GridState  │ │
│   └──────┬──────┘   └──────┬───────┘   └──────┬──────┘ │
│          │                 │                   │        │
│   ┌──────▼─────────────────▼───────────────────▼──────┐ │
│   │               EventBus                            │ │
│   └──────────────────────┬─────────────────────────── ┘ │
│                          │                              │
│   ┌───────────────────── ▼──────────────────────────┐  │
│   │            VirtualScrollEngine                  │  │
│   │   (viewport, row ranges, col ranges, Fenwick)   │  │
│   └──────────────────────┬──────────────────────────┘  │
│                          │                              │
│   ┌───────────────────── ▼──────────────────────────┐  │
│   │              RenderPipeline                     │  │
│   │   (diff, recycle, cell renderers, DOM update)   │  │
│   └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼──────┐  ┌─────────▼──────┐  ┌─────────▼──────┐
│  SortPlugin  │  │  FilterPlugin  │  │ SelectionPlugin│  ← Feature Modules
└──────────────┘  └────────────────┘  └────────────────┘
```

---

## Column Model

### `ColumnDef<TData>`

The raw column definition provided by the user.

```typescript
interface ColumnDef<TData = any> {
  // Identity
  key: string                          // Unique identifier. Used in CellCoord.
  field?: keyof TData | string         // Dot-path to value in row data. e.g. "address.city"

  // Display
  headerName?: string                  // Display label. Defaults to key.
  width?: number                       // Initial width in px. Default: 150.
  minWidth?: number                    // Minimum resize width. Default: 50.
  maxWidth?: number                    // Maximum resize width. Default: unlimited.
  flex?: number                        // Flex grow factor. Columns with flex ignore width.

  // Pinning
  pinned?: 'left' | 'right' | null     // Pin column to left or right viewport edge.

  // Visibility
  hidden?: boolean                     // Start hidden. Default: false.

  // Cell rendering
  cellRenderer?: CellRenderer<TData>   // Custom cell renderer factory.
  cellClass?: string | CellClassFn<TData>
  cellStyle?: CSSProperties | CellStyleFn<TData>

  // Header rendering
  headerRenderer?: HeaderRenderer      // Custom header renderer factory.
  headerClass?: string
  headerTooltip?: string

  // Sorting
  sortable?: boolean                   // Default: true if sortPlugin active.
  comparator?: SortComparator<TData>   // Custom sort function.

  // Filtering
  filterable?: boolean                 // Default: true if filterPlugin active.
  filterType?: 'text' | 'number' | 'date' | 'set' | 'custom'
  filterParams?: Record<string, any>

  // Editing
  editable?: boolean | EditableFn<TData>
  cellEditor?: CellEditor<TData>
  valueParser?: (params: ValueParserParams<TData>) => any
  valueSetter?: (params: ValueSetterParams<TData>) => boolean

  // Value access / formatting
  valueGetter?: (params: ValueGetterParams<TData>) => any
  valueFormatter?: (params: ValueFormatterParams<TData>) => string

  // Aggregation (for row grouping)
  aggFunc?: AggFunc | string           // e.g. 'sum', 'avg', 'min', 'max', or custom fn.

  // Column grouping (header groups)
  columnGroupId?: string               // Groups this column under a header group.

  // Resizing / reordering
  resizable?: boolean                  // Default: true.
  lockPosition?: boolean               // Prevent reordering. Default: false.
  lockPinned?: boolean                 // Prevent pin changes. Default: false.
}
```

### `Column<TData>` (Internal)

The resolved, live column object maintained by ColumnModel. Wraps ColumnDef with computed state.

```typescript
interface Column<TData = any> {
  readonly colId: string               // Same as ColumnDef.key.
  readonly def: ColumnDef<TData>       // Original definition. Never mutated.

  // Computed / mutable state
  width: number                        // Current rendered width.
  left: number                         // Absolute x offset from grid left edge (excluding frozen).
  visible: boolean
  pinned: 'left' | 'right' | null

  // Sort state
  sortIndex: number | null             // Position in multi-sort. null = not sorted.
  sortDirection: 'asc' | 'desc' | null

  // Filter state
  filterActive: boolean
}
```

### `ColumnModel`

```typescript
interface ColumnModel<TData = any> {
  // State
  readonly all: Column<TData>[]        // All columns in display order.
  readonly visible: Column<TData>[]    // Non-hidden, in display order.
  readonly pinnedLeft: Column<TData>[]
  readonly pinnedRight: Column<TData>[]
  readonly center: Column<TData>[]     // Visible, not pinned.
  readonly totalWidth: number          // Sum of all visible column widths.
  readonly centerWidth: number         // Sum of center (non-pinned) column widths.

  // Lookup
  getById(colId: string): Column<TData> | null

  // Mutations (emit events via EventBus)
  setWidth(colId: string, width: number): void
  setVisible(colId: string, visible: boolean): void
  setPinned(colId: string, pinned: 'left' | 'right' | null): void
  moveColumn(colId: string, toIndex: number): void
  setSort(colId: string, direction: 'asc' | 'desc' | null, multiSort?: boolean): void
  setFilter(colId: string, filterValue: any): void
}
```

---

## Row Model

The row model has two layers: the **data row** (raw user data) and the **display row** (what the virtual scroll engine indexes over, which may include group rows, loading rows, etc.).

### `RowData<TData>`

```typescript
// TData is the user's data type, e.g. { id: number, name: string, ... }
// The grid imposes no schema on TData.
type RowData<TData = any> = TData
```

### `RowNode<TData>`

The internal row representation. Every row in the grid — data row, group row, aggregate row, loading placeholder — is a `RowNode`.

```typescript
type RowType = 'data' | 'group' | 'aggregate' | 'loading' | 'pinnedTop' | 'pinnedBottom'

interface RowNode<TData = any> {
  // Identity
  readonly rowId: string               // Stable unique ID. From getRowId() or auto-generated.
  readonly rowType: RowType

  // Data (null for group/loading rows)
  data: TData | null

  // Tree / grouping
  readonly level: number               // Nesting depth. 0 = top level.
  readonly parentId: string | null
  childIds: string[]                   // Direct children (for group rows).
  expanded: boolean                    // Group expansion state.

  // Display index (position in the flat virtual row list)
  // Assigned by RowModel after flattening. Not stable across re-renders.
  displayIndex: number

  // Height
  rowHeight: number                    // Px. May be estimated then measured.
  heightMeasured: boolean              // True once actual DOM height captured.

  // Selection
  selected: boolean
  selectable: boolean

  // Pinned rows
  pinned: 'top' | 'bottom' | null

  // Metadata
  readonly rowIndex: number            // Index in original data array. -1 for synthetic rows.
}
```

### `RowModel<TData>`

```typescript
type RowModelType = 'client' | 'server' | 'infinite'

interface RowModel<TData = any> {
  readonly type: RowModelType

  // Flat virtual row list (what the viewport indexes over)
  readonly displayRows: RowNode<TData>[]    // Ordered, flattened, after sort/filter/group.
  readonly displayRowCount: number

  // Pinned rows (rendered outside virtual scroll)
  readonly pinnedTopRows: RowNode<TData>[]
  readonly pinnedBottomRows: RowNode<TData>[]

  // Lookup
  getRowById(rowId: string): RowNode<TData> | null
  getRowByDisplayIndex(index: number): RowNode<TData> | null

  // Data operations
  setRowData(data: TData[]): void
  updateRows(updates: RowUpdate<TData>[]): void
  addRows(rows: TData[], index?: number): void
  removeRows(rowIds: string[]): void

  // Group operations
  expandRow(rowId: string): void
  collapseRow(rowId: string): void
  expandAll(): void
  collapseAll(): void

  // Sort / filter (called by plugins, triggers re-flatten)
  applySort(sortState: SortState[]): void
  applyFilter(filterState: FilterState): void

  // Server-side (no-ops on client model)
  requestRows?(params: ServerRowRequest): void
}

interface RowUpdate<TData> {
  rowId: string
  data: Partial<TData>
}

interface ServerRowRequest {
  startRow: number
  endRow: number
  sortModel: SortState[]
  filterModel: FilterState
  groupKeys: string[]
}
```

---

## Viewport & Virtual Scroll Engine

This is the heart of the grid. It translates scroll position into visible row/col ranges and manages the height index.

### `Viewport`

```typescript
interface Viewport {
  // Dimensions (px)
  width: number                        // Visible grid width.
  height: number                       // Visible grid height.
  scrollLeft: number                   // Current horizontal scroll offset.
  scrollTop: number                    // Current vertical scroll offset.

  // Computed visible ranges (updated on every scroll/resize)
  rowRange: VisibleRange               // First/last visible row display indices.
  colRange: VisibleRange               // First/last visible center column indices.

  // Overscan (extra rows/cols rendered beyond visible edge)
  rowOverscan: number                  // Default: 3
  colOverscan: number                  // Default: 2

  // Total scrollable area
  totalHeight: number                  // Sum of all row heights.
  totalWidth: number                   // Sum of all column widths.
}

interface VisibleRange {
  start: number                        // Inclusive.
  end: number                          // Inclusive.
}
```

### `VirtualScrollEngine`

```typescript
interface VirtualScrollEngine {
  // Initialization
  init(container: HTMLElement, viewport: Viewport): void

  // Height index — Fenwick tree for O(log n) position lookup
  setRowHeight(displayIndex: number, height: number): void
  getRowOffset(displayIndex: number): number       // Y offset for row at index.
  getRowAtOffset(y: number): number                // Display index at pixel Y.
  getTotalHeight(): number

  // Width index — simple prefix sum (columns change infrequently)
  setColumnWidth(colIndex: number, width: number): void
  getColumnOffset(colIndex: number): number
  getColumnAtOffset(x: number): number
  getTotalWidth(): number

  // Scroll handling
  onScroll(scrollTop: number, scrollLeft: number): void
  scrollToRow(displayIndex: number, position?: 'top' | 'middle' | 'bottom'): void
  scrollToColumn(colIndex: number): void
  scrollToCell(coord: CellCoord): void

  // Viewport recalculation
  recalculate(): void                  // Call on container resize.
  getVisibleRowRange(): VisibleRange
  getVisibleColRange(): VisibleRange
}
```

### Fenwick Tree (internal)

Used by `VirtualScrollEngine` to maintain a prefix sum of row heights. Supports `O(log n)` point update and prefix query — essential for variable row heights.

```typescript
// Internal — not exposed publicly.
class FenwickTree {
  constructor(size: number)
  update(index: number, delta: number): void  // Change value at index by delta.
  query(index: number): number                // Sum from 0..index (inclusive).
  findFirst(target: number): number           // Binary search: first index where prefix sum >= target.
}
```

---

## Cell Coordinate System

Every operation that references a cell — selection, focus, keyboard nav, editing, clipboard — uses `CellCoord`.

```typescript
interface CellCoord {
  rowId: string                        // Stable row ID from RowNode.
  colId: string                        // Column key from ColumnDef.
}

// For range-based operations (selection, copy)
interface CellRange {
  start: CellCoord
  end: CellCoord
}

// Display index version — used internally by virtual scroll engine.
// Converted to/from CellCoord by the coordinate resolver.
interface CellDisplayCoord {
  rowIndex: number                     // displayIndex in RowModel.
  colIndex: number                     // index in ColumnModel.visible.
}

interface CoordResolver {
  toDisplay(coord: CellCoord): CellDisplayCoord | null
  fromDisplay(coord: CellDisplayCoord): CellCoord | null
  isValid(coord: CellCoord): boolean
  adjacent(coord: CellCoord, direction: Direction): CellCoord | null
}

type Direction = 'up' | 'down' | 'left' | 'right'
```

---

## Selection Model

```typescript
type SelectionMode = 'single' | 'multi' | 'range' | 'none'
type SelectionUnit = 'row' | 'cell'

interface SelectionModel {
  readonly mode: SelectionMode
  readonly unit: SelectionUnit

  // Current state
  readonly selectedRowIds: Set<string>
  readonly selectedRanges: CellRange[]          // For cell range selection.
  readonly focusedCell: CellCoord | null        // Keyboard focus. Always single.
  readonly anchorCell: CellCoord | null         // Range selection anchor.

  // Row selection
  selectRow(rowId: string, extend?: boolean): void
  deselectRow(rowId: string): void
  selectAll(): void
  deselectAll(): void
  isRowSelected(rowId: string): boolean

  // Cell selection
  selectCell(coord: CellCoord, extend?: boolean): void
  selectRange(start: CellCoord, end: CellCoord): void
  isCellSelected(coord: CellCoord): boolean
  isCellInRange(coord: CellCoord): boolean

  // Focus
  setFocus(coord: CellCoord): void
  moveFocus(direction: Direction): void
}
```

---

## Sort & Filter Model

### Sort

```typescript
interface SortState {
  colId: string
  direction: 'asc' | 'desc'
  index: number                        // Position in multi-sort order.
}

type SortComparator<TData> = (
  a: any,
  b: any,
  nodeA: RowNode<TData>,
  nodeB: RowNode<TData>
) => number                            // Negative, zero, or positive.
```

### Filter

```typescript
interface FilterState {
  [colId: string]: ColumnFilterValue
}

type ColumnFilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | SetFilterValue
  | CustomFilterValue

interface TextFilterValue {
  type: 'text'
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith'
  value: string
  caseSensitive?: boolean
}

interface NumberFilterValue {
  type: 'number'
  operator: 'equals' | 'notEquals' | 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual' | 'inRange'
  value: number
  valueTo?: number                     // For inRange.
}

interface DateFilterValue {
  type: 'date'
  operator: 'equals' | 'before' | 'after' | 'inRange'
  value: string                        // ISO 8601.
  valueTo?: string
}

interface SetFilterValue {
  type: 'set'
  values: any[]                        // Whitelist of allowed values.
}

interface CustomFilterValue {
  type: 'custom'
  predicate: (value: any, rowNode: RowNode) => boolean
}
```

---

## Edit Model

```typescript
interface EditState {
  active: boolean
  coord: CellCoord | null
  initialValue: any                    // Value when editing started.
  currentValue: any                    // Live value during edit.
}

interface CellEditor<TData = any> {
  // Lifecycle
  init(params: CellEditorParams<TData>): void
  getGui(): HTMLElement
  getValue(): any
  destroy(): void

  // Optional
  isPopup?(): boolean                  // Render editor as floating popup vs inline.
  isCancelAfterEnd?(): boolean         // Return true to cancel on focusout.
  focusIn?(): void
  focusOut?(): void
}

interface CellEditorParams<TData = any> {
  value: any
  rowNode: RowNode<TData>
  column: Column<TData>
  coord: CellCoord
  eventKey: string | null              // Key that triggered edit, if any.
  stopEditing: (cancel?: boolean) => void
}
```

---

## Event Bus

All internal communication goes through the EventBus. Plugins subscribe to events and dispatch their own. This keeps features decoupled.

```typescript
interface GridEvent {
  type: string
  source?: 'user' | 'api' | 'internal'
}

// Core events
interface RowDataChangedEvent extends GridEvent { type: 'rowDataChanged' }
interface ScrollEvent extends GridEvent { type: 'scroll'; scrollTop: number; scrollLeft: number }
interface ViewportChangedEvent extends GridEvent { type: 'viewportChanged'; rowRange: VisibleRange; colRange: VisibleRange }
interface CellClickedEvent extends GridEvent { type: 'cellClicked'; coord: CellCoord; rowNode: RowNode; event: MouseEvent }
interface CellDoubleClickedEvent extends GridEvent { type: 'cellDoubleClicked'; coord: CellCoord; event: MouseEvent }
interface CellKeyDownEvent extends GridEvent { type: 'cellKeyDown'; coord: CellCoord; event: KeyboardEvent }
interface SelectionChangedEvent extends GridEvent { type: 'selectionChanged'; selectedRowIds: string[] }
interface SortChangedEvent extends GridEvent { type: 'sortChanged'; sortState: SortState[] }
interface FilterChangedEvent extends GridEvent { type: 'filterChanged'; filterState: FilterState }
interface ColumnResizedEvent extends GridEvent { type: 'columnResized'; colId: string; width: number; finished: boolean }
interface ColumnMovedEvent extends GridEvent { type: 'columnMoved'; colId: string; toIndex: number }
interface RowGroupChangedEvent extends GridEvent { type: 'rowGroupChanged' }
interface EditStartedEvent extends GridEvent { type: 'editStarted'; coord: CellCoord }
interface EditStoppedEvent extends GridEvent { type: 'editStopped'; coord: CellCoord; value: any; cancelled: boolean }

// Full event map (extensible by plugins)
interface GridEventMap {
  rowDataChanged: RowDataChangedEvent
  scroll: ScrollEvent
  viewportChanged: ViewportChangedEvent
  cellClicked: CellClickedEvent
  cellDoubleClicked: CellDoubleClickedEvent
  cellKeyDown: CellKeyDownEvent
  selectionChanged: SelectionChangedEvent
  sortChanged: SortChangedEvent
  filterChanged: FilterChangedEvent
  columnResized: ColumnResizedEvent
  columnMoved: ColumnMovedEvent
  rowGroupChanged: RowGroupChangedEvent
  editStarted: EditStartedEvent
  editStopped: EditStoppedEvent
  [key: string]: GridEvent              // Plugins may add custom events.
}

interface EventBus {
  on<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): () => void
  off<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): void
  emit<K extends keyof GridEventMap>(event: K, payload: GridEventMap[K]): void
}
```

---

## Plugin System

```typescript
interface GridPlugin {
  readonly pluginId: string            // Unique ID, e.g. 'sortPlugin', 'filterPlugin'.
  init(context: GridPluginContext): void
  destroy(): void
}

interface GridPluginContext {
  eventBus: EventBus
  rowModel: RowModel
  columnModel: ColumnModel
  selectionModel: SelectionModel
  viewport: Viewport
  options: GridOptions
  getPlugin<T extends GridPlugin>(pluginId: string): T | null
}
```

Built-in plugins (each a separate module):

| Plugin ID | Responsibility |
|---|---|
| `sortPlugin` | Multi-column sort, comparators |
| `filterPlugin` | Per-column and global filtering |
| `selectionPlugin` | Row and cell selection, range |
| `editPlugin` | Inline cell editing, value parsing |
| `columnResizePlugin` | Drag-to-resize columns |
| `columnMovePlugin` | Drag-to-reorder columns |
| `rowGroupPlugin` | Row grouping and tree data |
| `aggregationPlugin` | Column aggregation functions |
| `clipboardPlugin` | Copy / paste |
| `keyboardNavPlugin` | Full keyboard navigation |
| `exportPlugin` | CSV and Excel export |
| `contextMenuPlugin` | Right-click context menus |
| `tooltipPlugin` | Cell and header tooltips |
| `infiniteRowPlugin` | Infinite scroll / server-side rows |
| `pinnedRowPlugin` | Top and bottom pinned rows |
| `columnGroupPlugin` | Multi-level column headers |

---

## Grid State

The complete serializable state of the grid. Can be saved and restored.

```typescript
interface GridState {
  columns: ColumnState[]
  sort: SortState[]
  filter: FilterState
  selection: {
    selectedRowIds: string[]
    focusedCell: CellCoord | null
  }
  scroll: {
    scrollTop: number
    scrollLeft: number
  }
  rowGroups: {
    expandedRowIds: string[]
  }
}

interface ColumnState {
  colId: string
  width: number
  visible: boolean
  pinned: 'left' | 'right' | null
  sortIndex: number | null
  sortDirection: 'asc' | 'desc' | null
  filterActive: boolean
  index: number                        // Display order.
}
```

---

## Grid Options (Public API)

The top-level configuration object passed by the user.

```typescript
interface GridOptions<TData = any> {
  // Data
  rowData?: TData[]
  columnDefs: ColumnDef<TData>[]
  getRowId?: (data: TData) => string   // Provide stable IDs. Highly recommended.
  rowModelType?: RowModelType          // Default: 'client'

  // Row display
  rowHeight?: number                   // Fixed row height px. Default: 40.
  getRowHeight?: (node: RowNode<TData>) => number   // Variable row heights.
  headerHeight?: number                // Default: 48.
  groupHeaderHeight?: number           // Default: headerHeight.

  // Pinned rows
  pinnedTopRowData?: TData[]
  pinnedBottomRowData?: TData[]

  // Selection
  selectionMode?: SelectionMode        // Default: 'multi'
  selectionUnit?: SelectionUnit        // Default: 'row'
  isRowSelectable?: (node: RowNode<TData>) => boolean

  // Sorting
  sortable?: boolean                   // Default: true. Can override per column.
  multiSort?: boolean                  // Allow multi-column sort. Default: true.
  initialSort?: SortState[]

  // Filtering
  filterable?: boolean                 // Default: true. Can override per column.
  initialFilter?: FilterState

  // Editing
  editable?: boolean                   // Default: false. Can override per column.
  editOnSingleClick?: boolean          // Default: false (double click).

  // Column behaviour
  resizable?: boolean                  // Default: true.
  reorderable?: boolean                // Default: true.
  defaultColWidth?: number             // Default: 150.
  autoSizeColumns?: boolean            // Fit content on init. Default: false.

  // Row grouping
  groupByFields?: string[]             // Fields to group by.
  groupDefaultExpanded?: number        // Levels to expand by default. -1 = all. Default: 0.
  showGroupCount?: boolean             // Default: true.

  // Virtualisation
  rowOverscan?: number                 // Default: 3.
  colOverscan?: number                 // Default: 2.
  estimatedRowHeight?: number          // For variable heights before measurement. Default: rowHeight.

  // Themes
  theme?: string | GridTheme           // e.g. 'default', 'compact', 'material', or custom object.

  // Plugins
  plugins?: GridPlugin[]               // Additional/custom plugins.
  enabledPlugins?: string[]            // Override which built-in plugins are active.

  // Localisation
  locale?: GridLocale

  // Accessibility
  ariaLabel?: string                   // Sets aria-label on the grid container.

  // Callbacks
  onGridReady?: (api: GridApi<TData>) => void

  // State persistence
  initialState?: Partial<GridState>
  onStateChanged?: (state: GridState) => void

  // Server-side row model
  datasource?: GridDatasource<TData>
}

interface GridDatasource<TData> {
  getRows(params: ServerRowRequest): Promise<{
    rows: TData[]
    totalCount: number
  }>
}
```

---

## Grid API

The imperative API returned to the user via `onGridReady`.

```typescript
interface GridApi<TData = any> {
  // Data
  setRowData(data: TData[]): void
  updateRows(updates: RowUpdate<TData>[]): void
  addRows(rows: TData[], index?: number): void
  removeRows(rowIds: string[]): void
  getRowNode(rowId: string): RowNode<TData> | null

  // Selection
  selectAll(): void
  deselectAll(): void
  getSelectedRowIds(): string[]
  getSelectedRows(): TData[]

  // Sort / Filter
  setSortModel(sort: SortState[]): void
  setFilterModel(filter: FilterState): void
  getSortModel(): SortState[]
  getFilterModel(): FilterState

  // Columns
  setColumnVisible(colId: string, visible: boolean): void
  setColumnWidth(colId: string, width: number): void
  setColumnPinned(colId: string, pinned: 'left' | 'right' | null): void
  moveColumn(colId: string, toIndex: number): void
  autoSizeColumn(colId: string): void
  autoSizeAllColumns(): void

  // Scroll / navigation
  scrollToRow(rowId: string, position?: 'top' | 'middle' | 'bottom'): void
  scrollToColumn(colId: string): void
  ensureCellVisible(coord: CellCoord): void

  // Editing
  startEditing(coord: CellCoord): void
  stopEditing(cancel?: boolean): void

  // Export
  exportToCsv(params?: ExportParams): void
  exportToExcel(params?: ExportParams): void

  // State
  getState(): GridState
  applyState(state: Partial<GridState>): void

  // Lifecycle
  destroy(): void

  // Event subscription (mirrors EventBus but scoped to this grid instance)
  on<K extends keyof GridEventMap>(event: K, handler: (e: GridEventMap[K]) => void): () => void
}
```

---

## Framework Adapter Contract

Each framework adapter is a thin wrapper. It must:

1. Call `createGrid(container, options)` on mount / component init.
2. Call `api.destroy()` on unmount / component destroy.
3. Forward reactive prop changes to the appropriate `GridApi` methods.
4. Expose the `GridApi` instance to the user via a ref / binding.

```typescript
// The single entry point for all adapters and vanilla usage.
function createGrid<TData>(
  container: HTMLElement,
  options: GridOptions<TData>
): GridApi<TData>
```

Adapter packages: `@ultimate-grid/react`, `@ultimate-grid/vue`, `@ultimate-grid/svelte`, `@ultimate-grid/angular`.

---

## Rendering Pipeline

On each frame (triggered by scroll, data change, or resize):

1. **Compute visible ranges** — `VirtualScrollEngine.getVisibleRowRange()` + `getVisibleColRange()` (with overscan).
2. **Diff against previous ranges** — determine rows/cols to add, remove, and reuse.
3. **Recycle DOM nodes** — nodes scrolled out of view go into a pool keyed by row type. New rows pull from the pool before creating fresh DOM.
4. **Position nodes** — set `transform: translateY(offset)` on each row. Use `translateX` per cell for column position.
5. **Invoke cell renderers** — for new or updated cells, call `cellRenderer.refresh()` or remount.
6. **Apply decorations** — selection highlight, focus ring, sort indicators, filter icons.

---

## DOM Structure

```
div.ugrid                              ← Outer container. position: relative; overflow: hidden.
├── div.ugrid-header                   ← Fixed header. position: sticky; top: 0; z-index: 3.
│   ├── div.ugrid-header-pinned-left   ← Frozen left header cells.
│   ├── div.ugrid-header-center        ← Scrollable center header. overflow: hidden.
│   └── div.ugrid-header-pinned-right  ← Frozen right header cells.
│
├── div.ugrid-body                     ← Scroll container. overflow: scroll.
│   ├── div.ugrid-spacer-top           ← Height = offset of first rendered row.
│   ├── div.ugrid-pinned-left          ← Frozen left columns. position: sticky; left: 0.
│   │   └── div.ugrid-row[data-row-id] ← Recycled row nodes.
│   │       └── div.ugrid-cell[data-col-id]
│   ├── div.ugrid-center               ← Virtual scrolling rows.
│   │   └── div.ugrid-row[data-row-id]
│   │       └── div.ugrid-cell[data-col-id]
│   ├── div.ugrid-pinned-right         ← Frozen right columns. position: sticky; right: 0.
│   │   └── div.ugrid-row[data-row-id]
│   │       └── div.ugrid-cell[data-col-id]
│   └── div.ugrid-spacer-bottom        ← Height = total height minus offset of last rendered row.
│
├── div.ugrid-pinned-rows-top          ← Top pinned rows. Rendered outside virtual scroll.
└── div.ugrid-pinned-rows-bottom       ← Bottom pinned rows.
```

---

## Cell Renderer Contract

```typescript
interface CellRenderer<TData = any> {
  // Called once. Must return a DOM element.
  init(params: CellRendererParams<TData>): void
  getGui(): HTMLElement

  // Called when the cell value changes but the DOM node is being reused.
  // Return false to force full re-init.
  refresh(params: CellRendererParams<TData>): boolean

  // Called when the cell is removed from the DOM (recycled or destroyed).
  destroy?(): void
}

interface CellRendererParams<TData = any> {
  value: any                           // Formatted cell value.
  rawValue: any                        // Pre-formatter value.
  data: TData | null
  rowNode: RowNode<TData>
  column: Column<TData>
  coord: CellCoord
  api: GridApi<TData>
}
```

---

*End of Architecture Document — v0.1 Draft*

> **Next step:** Implement `FenwickTree` + `VirtualScrollEngine` as the first unit of code. Everything else builds on top of these.
