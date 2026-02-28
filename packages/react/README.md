# @ultimate-grid/react

React wrapper for [Ultimate Data Grid](../../README.md).

## Installation

```bash
npm install @ultimate-grid/core @ultimate-grid/react
```

## Quick Start

### 1. Import CSS

In your main entry file (e.g., `main.tsx` or `App.tsx`):

```tsx
import '@ultimate-grid/core/styles/ugrid.css';
```

### 2. Use the Component

```tsx
import { UltimateGrid } from '@ultimate-grid/react';
import type { ColumnDef } from '@ultimate-grid/core';
import { useState } from 'react';

interface RowData {
  id: number;
  name: string;
  role: string;
}

export default function App() {
  const [rowData] = useState<RowData[]>([
    { id: 1, name: 'Alice', role: 'Engineer' },
    { id: 2, name: 'Bob', role: 'Designer' },
  ]);

  const [columnDefs] = useState<ColumnDef[]>([
    { colId: 'name', field: 'name', headerName: 'Name' },
    { colId: 'role', field: 'role', headerName: 'Role' },
  ]);

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <UltimateGrid
        rowData={rowData}
        columnDefs={columnDefs}
        rowHeight={36}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|---|---|---|
| `columnDefs` | `ColumnDef[]` | **Required.** Column definitions. |
| `rowData` | `TData[]` | Row data array. |
| `options` | `Partial<GridOptions>` | Extra options merged into grid config. |
| `selectionMode` | `'single' \| 'multi' \| 'range' \| 'none'` | Default `'multi'`. |
| `rowHeight` | `number` | Row height in pixels (default 36). |
| `onGridReady` | `(api: GridApi) => void` | Called with `api` after the grid mounts. |
| `className` | `string` | Optional CSS class for the container. |
| `style` | `CSSProperties` | Optional inline styles. |

## Running the demo

```bash
npm run dev:react
```

Starts Vite dev server at http://localhost:5175.
