# @ultimate-grid/core

The vanilla JavaScript engine powering Ultimate Data Grid. Zero runtime dependencies, fully typed TypeScript, ships as ESM + CJS.

---

## Installation

```bash
npm install @ultimate-grid/core
```

---

## Quick Start

```ts
import { createGrid } from '@ultimate-grid/core';
import '@ultimate-grid/core/styles/ugrid.css';

const { api } = createGrid({
  container: document.getElementById('grid')!,
  columnDefs: [
    { colId: 'name',       field: 'name',       headerName: 'Name'       },
    { colId: 'department', field: 'department', headerName: 'Department' },
    { colId: 'salary',     field: 'salary',     headerName: 'Salary',     filter: 'number' },
    { colId: 'joined',     field: 'joined',     headerName: 'Joined',     filter: 'date'   },
  ],
  rowData: myData,
  rowHeight: 36,
  onGridReady: ({ api }) => console.log('ready', api),
});
```

---

## `createGrid(options)` — Options

| Option | Type | Default | Description |
|---|---|---|---|
| `container` | `HTMLElement` | **required** | Element the grid is mounted into |
| `columnDefs` | `ColumnDef[]` | **required** | Column definitions |
| `rowData` | `TData[]` | `[]` | Initial row data |
| `rowHeight` | `number` | `36` | Row height in px |
| `overscan` | `number` | `5` | Extra rows rendered above/below viewport |
| `selectionMode` | `'single' \| 'multi' \| 'range' \| 'none'` | `'multi'` | Row selection mode |
| `initialSort` | `SortState[]` | `[]` | Initial sort state |
| `initialFilter` | `FilterState` | `{}` | Initial filter state |
| `onGridReady` | `(e: GridReadyEvent) => void` | — | Called once grid is mounted |
| `onSelectionChanged` | `(e: SelectionChangedEvent) => void` | — | Called on selection change |
| `onSortChanged` | `(e: SortChangedEvent) => void` | — | Called on sort change |
| `onFilterChanged` | `(e: FilterChangedEvent) => void` | — | Called on filter change |
| `cellRenderer` | `CellRenderer` | — | Custom cell renderer |

---

## `GridApi` — Methods

### Data

| Method | Description |
|---|---|
| `setRowData(rows)` | Replace all row data |
| `addRows(rows)` | Append rows |
| `removeRows(ids)` | Remove rows by ID |
| `getRowData()` | Return current display rows |

### Selection

| Method | Description |
|---|---|
| `getSelectedRowIds()` | Returns `string[]` of selected row IDs |
| `selectAll()` | Select all visible rows |
| `deselectAll()` | Clear selection |

### Sort

| Method | Description |
|---|---|
| `getSortModel()` | Returns current `SortState[]` |
| `setSortModel(state)` | Set sort state programmatically |

### Filter

| Method | Description |
|---|---|
| `getFilterModel()` | Returns current `FilterState` |
| `setFilterModel(state)` | Set filter state programmatically |

### Lifecycle

| Method | Description |
|---|---|
| `destroy()` | Unmount and clean up all event listeners |

---

## Column Definitions

```ts
interface ColumnDef {
  colId:        string;           // Unique column identifier
  field?:       string;           // Property name on row data object
  headerName?:  string;           // Display name in header
  width?:       number;           // Column width in px
  minWidth?:    number;
  maxWidth?:    number;
  sortable?:    boolean;          // Default true
  filter?:      'text' | 'number' | 'date' | 'set' | false;
  resizable?:   boolean;
  pinned?:      'left' | 'right' | null;
  hide?:        boolean;
  initialSort?: 'asc' | 'desc';
  sortIndex?:   number;           // Multi-sort order
  valueGetter?: (params: ValueGetterParams) => unknown;
  valueFormatter?: (params: ValueFormatterParams) => string;
  cellRenderer?: CellRenderer;
}
```

---

## Filter Expressions

Type directly into the filter input below any column header — no dropdowns needed.

### Text columns

| Expression | Meaning |
|---|---|
| `alice` | Contains "alice" (case-insensitive) |
| `=Engineering` | Exactly equals |
| `!=Sales` | Does not equal |
| `^A` | Starts with "A" |
| `son$` | Ends with "son" |

### Number columns

| Expression | Meaning |
|---|---|
| `>80000` | Greater than |
| `>=50000` | Greater than or equal |
| `<60000` | Less than |
| `50000..80000` | Between 50 000 and 80 000 (inclusive) |
| `=75` | Exactly 75 |
| `!=0` | Not zero |

### Date columns

| Expression | Meaning |
|---|---|
| `2020..2023` | Between 2020-01-01 and 2023-12-31 |
| `2021-06..2022-03` | Between June 2021 and March 2022 |
| `>2022-01-01` | After Jan 1 2022 |
| `=2019-03-04` | Exactly that date |

Multiple filters across columns are combined with **AND**.

---

## Sorting

- **Click** a column header → sort ascending → descending → off
- **Ctrl+click** a column header → add as secondary sort (multi-sort)
- **`api.setSortModel([])`** → clear all sorts

---

## Row Selection

| Gesture | Result |
|---|---|
| Click row | Select (deselects others); click again to deselect |
| Ctrl+click | Toggle additive |
| Drag | Drag-select range |
| Ctrl+drag on unselected | Add range to selection |
| Ctrl+drag on selected | Remove range from selection |

---

## Theming

The grid uses CSS custom properties. Import `ugrid.css` once in your app:

```ts
import '@ultimate-grid/core/styles/ugrid.css';
```

Override variables in your own CSS:

```css
:root {
  --ugrid-bg:              #ffffff;
  --ugrid-bg-header:       #f8f9fb;
  --ugrid-selection-bg:    #dbeafe;
  --ugrid-text:            #111827;
  --ugrid-border-color:    #d0d5dd;
  --ugrid-row-height:      36px;
  /* ...see ugrid.css for full list */
}
```

### Manual dark mode

Add `demo-dark` to `<body>` to force dark mode regardless of OS preference:

```ts
document.body.classList.add('demo-dark');   // force dark
document.body.classList.add('demo-light');  // force light (overrides OS dark)
```

---

## License

[MIT](../../LICENSE)
