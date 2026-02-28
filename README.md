# ⚡ Ultimate Data Grid

A fully open-source, MIT-licensed, high-performance data grid with **no enterprise tier**.

Built on a vanilla JavaScript core with zero runtime dependencies, framework adapters for React, Vue, Svelte, and Angular are provided as thin wrappers around the same engine.

[![CI](https://github.com/harvey-withington/ultimate-grid/actions/workflows/ci.yml/badge.svg)](https://github.com/harvey-withington/ultimate-grid/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

- **Virtual scrolling** on both axes — handles millions of rows at 60 fps
- **Multi-sort** — Ctrl+click column headers to add secondary sorts
- **Filter expressions** — type `>50000`, `2020..2023`, `^Alice` directly in the filter row
- **Drag-select** — click+drag to select ranges; Ctrl+drag to add or remove
- **Light / dark mode** — CSS custom properties, auto OS detection with manual override
- **Zero runtime dependencies** — the core ships as pure ESM + CJS
- **Plugin architecture** — extend without forking
- **Fully typed** — complete TypeScript definitions

---

## Monorepo Structure

```
packages/
  core/      @ultimate-grid/core      — Vanilla JS engine (TypeScript, zero deps)
  angularjs/ @ultimate-grid/angularjs — AngularJS (v1) adapter
  react/     @ultimate-grid/react     — React adapter
  vue/       @ultimate-grid/vue       — Vue adapter     (pending)
  svelte/    @ultimate-grid/svelte    — Svelte adapter  (pending)
  angular/   @ultimate-grid/angular   — Angular adapter (pending)
```

---

## Quick Start

### Install

```bash
# npm
npm install @ultimate-grid/core
```

### Usage

```ts
import { createGrid } from '@ultimate-grid/core';
import '@ultimate-grid/core/styles/ugrid.css';

const { api } = createGrid({
  container: document.getElementById('grid')!,
  columnDefs: [
    { colId: 'name',   field: 'name',   headerName: 'Name'   },
    { colId: 'salary', field: 'salary', headerName: 'Salary', filter: 'number' },
    { colId: 'joined', field: 'joined', headerName: 'Joined', filter: 'date'   },
  ],
  rowData: [
    { name: 'Alice', salary: 95000, joined: '2020-03-01' },
    { name: 'Bob',   salary: 72000, joined: '2018-07-15' },
  ],
  onGridReady: (e) => console.log('Grid ready', e.api),
});

// API usage
api.setFilterModel({ salary: { type: 'number', operator: 'greaterThan', value: 80000 } });
api.setSortModel([{ colId: 'name', direction: 'asc', index: 0 }]);
```

---

## Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 10

### Setup

```bash
git clone https://github.com/harvey-withington/ultimate-grid.git
cd ultimate-grid
npm install
```

### Commands

```bash
# Run the core demo (Vanilla JS)
npm run dev

# Run the AngularJS demo
npm run dev:angularjs

# Run the React demo
npm run dev:react

# Run all tests (core)
npm test

# Build core package
npm run build

# Type-check core
npm run lint
```

---

## Documentation

See [`packages/core/README.md`](packages/core/README.md) for the full API reference.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) © Ultimate Data Grid Contributors
