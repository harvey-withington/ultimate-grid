# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2025-02-27

### Added

#### Core Engine (`@ultimate-grid/core`)

- **Virtual scrolling** — FenwickTree-backed row height prefix sums; renders only visible rows + overscan
- **ColumnModel** — column visibility, pinning, sorting (multi-sort via Ctrl+click), and filtering
- **ClientRowModel** — in-memory row store with sort and filter pipeline
- **GridCore** — wires row model, column model, and event bus; exposes `GridApi`
- **SelectionModel** — row selection with single-click, Ctrl+click toggle, drag-select, Ctrl+drag extend, Ctrl+drag-on-selected deselect
- **RenderPipeline** — virtual DOM rendering, header sort indicators, filter row, drag-select gestures, touch support
- **`createGrid()`** — single entry-point factory wiring all subsystems
- **`parseFilterExpression()`** — safe filter expression parser supporting:
  - Text: contains, `=equals`, `!=not`, `^startsWith`, `endsWith$`
  - Number: `>`, `>=`, `<`, `<=`, `=`, `!=`, `50000..80000` range
  - Date: `>2022`, `2020..2023`, `2021-06..2022-03`, `=2019-03-04`
- **`ugrid.css`** — extracted theme with CSS custom properties, full light/dark mode (OS auto-detect + manual override)
- **Demo** — Vite dev server with live data, dark/light toggle, help modal, filter/sort/selection controls
- **314 passing tests** across 10 test files

[0.1.0]: https://github.com/your-org/ultimate-grid/releases/tag/v0.1.0
