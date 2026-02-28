# Contributing to Ultimate Data Grid

Thank you for your interest in contributing! This document covers how to get set up and submit changes.

---

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 (`npm install -g pnpm`)

---

## Setup

```bash
git clone https://github.com/harvey-withington/ultimate-grid.git
cd ultimate-grid
pnpm install
```

---

## Project Structure

```
packages/
  core/             Vanilla JS engine — edit this first
    src/
      column/       ColumnModel
      events/       EventBus
      filter/       parseFilterExpression
      grid/         GridCore
      render/       RenderPipeline
      row/          ClientRowModel
      selection/    SelectionModel
      styles/       ugrid.css
      virtual-scroll/ FenwickTree + VirtualScrollEngine
    demo/           Vite demo app
    src/__tests__/  Integration tests (createGrid)
```

---

## Running Locally

```bash
# Interactive demo (hot-reload)
pnpm --filter @ultimate-grid/core run demo

# Run tests once
pnpm --filter @ultimate-grid/core run test

# Run tests in watch mode
pnpm --filter @ultimate-grid/core run test:watch

# Type-check
pnpm --filter @ultimate-grid/core run lint

# Build
pnpm --filter @ultimate-grid/core run build
```

---

## Submitting Changes

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes — add tests for any new behaviour
3. Ensure all tests pass: `pnpm test`
4. Ensure no type errors: `pnpm lint`
5. Commit with a clear message, e.g. `feat(core): add column pinning`
6. Open a pull request against `main`

### Commit Message Format

```
type(scope): short description

Types: feat | fix | docs | style | refactor | test | chore
Scope: core | react | vue | svelte | angular | demo | ci
```

---

## Adding Tests

Tests live alongside source in `__tests__/` subdirectories. The test runner is **Vitest**.

- Unit tests: `src/<module>/__tests__/<Module>.test.ts`
- Integration tests: `src/__tests__/`
- Demo utilities: `demo/__tests__/`

```bash
# Run a single test file
npx vitest run src/selection/__tests__/SelectionModel.test.ts
```

---

## Code Style

- TypeScript strict mode — no `any`, no type assertions without justification
- Zero runtime dependencies in `packages/core`
- DOM class prefix: `ugrid-` for all grid elements
- CSS custom properties: `--ugrid-*` for all theme variables

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
