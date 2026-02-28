/**
 * Ultimate Grid — React Demo
 *
 * Demonstrates the <UltimateGrid> component with:
 *  - Exposed GridApi via onGridReady
 *  - Live stats bar updated via grid events
 *  - Add / Remove rows
 *  - Clear filters, sort, selection
 *  - Dark/light theme toggle
 *  - Help modal
 */

import '../../core/src/styles/ugrid.css';
import '../../core/demo/demo-shared.css';
import '../src/UltimateGrid.tsx';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UltimateGrid } from '../src/UltimateGrid.tsx';
import type { GridApi, ColumnDef, SortState, FilterState, Column, RowNode } from '../../core/src/types.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  location: string;
  salary: number;
  score: number;
  joined: string;
  active: boolean;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Finance', 'HR'];
const LOCATIONS   = ['London', 'New York', 'Berlin', 'Tokyo', 'Paris', 'Sydney', 'Singapore'];
const ROLES       = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director'];
const NAMES       = [
  'Alice Chen', 'Bob Martin', 'Carol White', 'Dave Singh', 'Eve Johnson',
  'Frank Kim', 'Grace Liu', 'Henry Park', 'Iris Torres', 'Jack Brown',
  'Kate Wilson', 'Leo Zhang', 'Mia Patel', 'Noah Garcia', 'Olivia Davis',
];

function generateData(count: number): Employee[] {
  const rows: Employee[] = [];
  for (let i = 1; i <= count; i++) {
    const year  = 2015 + (i % 9);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day   = String((i % 28) + 1).padStart(2, '0');
    rows.push({
      id:         i,
      name:       NAMES[i % NAMES.length] + (i > NAMES.length ? ` ${Math.floor(i / NAMES.length)}` : ''),
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      role:       ROLES[i % ROLES.length],
      location:   LOCATIONS[i % LOCATIONS.length],
      salary:     45000 + (i % 20) * 5000,
      score:      Math.round((((i * 37) % 100) + 1)),
      joined:     `${year}-${month}-${day}`,
      active:     i % 7 !== 0,
    });
  }
  return rows;
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function employeeCellRenderer(col: Column, _node: RowNode, value: unknown): HTMLElement | null {
  const cell = document.createElement('div');

  switch (col.colId) {
    case 'id':
      cell.className = 'ugrid-cell ugrid-cell--number';
      cell.textContent = String(value);
      return cell;

    case 'salary':
      cell.className = 'ugrid-cell ugrid-cell--number';
      cell.textContent = `$${Number(value).toLocaleString()}`;
      return cell;

    case 'score': {
      cell.className = 'ugrid-cell ugrid-cell--score';
      const bar = document.createElement('span');
      bar.className = 'ugrid-score-bar';
      bar.style.setProperty('--score-pct', `${value}%`);
      bar.title = `${value}/100`;
      const label = document.createElement('span');
      label.className = 'ugrid-score-label';
      label.textContent = String(value);
      cell.appendChild(bar);
      cell.appendChild(label);
      return cell;
    }

    case 'department': {
      cell.className = 'ugrid-cell ugrid-cell--badge';
      const badge = document.createElement('span');
      badge.textContent = String(value);
      cell.appendChild(badge);
      return cell;
    }

    case 'active':
      cell.className = 'ugrid-cell';
      cell.textContent = value ? '\u2611' : '\u2BBD';
      return cell;

    default:
      return null;
  }
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMN_DEFS: ColumnDef<Employee>[] = [
  { key: 'id',         field: 'id',         headerName: '#',          width: 60  },
  { key: 'name',       field: 'name',       headerName: 'Name',       width: 180 },
  { key: 'department', field: 'department', headerName: 'Department', width: 130, filterIcon: true },
  { key: 'role',       field: 'role',       headerName: 'Role',       width: 100, filterIcon: true },
  { key: 'location',   field: 'location',   headerName: 'Location',   width: 120, filterIcon: true },
  { key: 'salary',     field: 'salary',     headerName: 'Salary',     width: 110 },
  { key: 'score',      field: 'score',      headerName: 'Score',      width: 100 },
  { key: 'joined',     field: 'joined',     headerName: 'Joined',     width: 110 },
  { key: 'active',     field: 'active',     headerName: 'Active',     width: 80  },
];

const HEADER_MAP: Record<string, string> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, c.headerName ?? c.key])
);

function buildFilterSummary(filterState: FilterState): string {
  return Object.entries(filterState)
    .filter(([, v]) => v != null)
    .map(([colId, v]) => {
      const label = HEADER_MAP[colId] ?? colId;
      const val = (v as any).value ?? (v as any).values?.join(', ') ?? '';
      return `${label}: ${val}`;
    })
    .join(', ');
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const apiRef      = useRef<GridApi<Employee> | null>(null);
  const totalRef    = useRef(2000);

  const [rowData]       = useState(() => generateData(2000));
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [helpOpen, setHelpOpen] = useState(false);

  // Stats state
  const [stats, setStats] = useState({
    showing:    2000,
    total:      2000,
    cols:       COLUMN_DEFS.length,
    sort:       'none',
    hasSort:    false,
    selected:   0,
    filterText: '',
  });

  // Mutable refs for sort/filter state (avoid stale closures in callbacks)
  const sortStateRef   = useRef<SortState[]>([]);
  const filterStateRef = useRef<FilterState>({});

  const updateStats = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const selected    = api.getSelectedRowIds();
    const showing     = api.getDisplayedRowCount();
    const sortState   = sortStateRef.current;
    const filterState = filterStateRef.current;
    const filterText  = buildFilterSummary(filterState);
    const sort        = sortState.length
      ? sortState.map(s => `${s.colId} ${s.direction}`).join(', ')
      : 'none';
    setStats({
      showing,
      total:      totalRef.current,
      cols:       COLUMN_DEFS.length,
      sort,
      hasSort:    sortState.length > 0,
      selected:   selected.length,
      filterText,
    });
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.classList.toggle('demo-dark',  dark);
    document.body.classList.toggle('demo-light', !dark);
  }, [dark]);

  // ESC closes help modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelpOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleGridReady = useCallback((api: GridApi<Employee>) => {
    apiRef.current = api;
    updateStats();
  }, [updateStats]);

  const handleSortChanged = useCallback((e: any) => {
    sortStateRef.current = e.sortState ?? [];
    updateStats();
  }, [updateStats]);

  const handleFilterChanged = useCallback((e: any) => {
    filterStateRef.current = e.filterState ?? {};
    updateStats();
  }, [updateStats]);

  const handleSelectionChanged = useCallback(() => {
    updateStats();
  }, [updateStats]);

  const addRow = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const id = Date.now();
    api.addRows([{
      id,
      name:       NAMES[id % NAMES.length] + ' (new)',
      department: DEPARTMENTS[id % DEPARTMENTS.length],
      role:       'Junior',
      salary:     45000,
      score:      50,
      location:   LOCATIONS[id % LOCATIONS.length],
      joined:     new Date().toISOString().slice(0, 10),
      active:     true,
    }]);
    totalRef.current += 1;
    updateStats();
  }, [updateStats]);

  const removeSelected = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const ids = api.getSelectedRowIds();
    if (!ids.length) return;
    api.removeRows(ids);
    api.deselectAll();
    totalRef.current -= ids.length;
    updateStats();
  }, [updateStats]);

  const clearSort = useCallback(() => {
    apiRef.current?.setSortModel([]);
  }, []);

  const clearFilters = useCallback(() => {
    apiRef.current?.setFilterModel({});
  }, []);

  const clearSelection = useCallback(() => {
    apiRef.current?.deselectAll();
    updateStats();
  }, [updateStats]);

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="demo-bar">
        <h1>&#9889; Ultimate Data Grid</h1>
        <span>React wrapper demo</span>
        <span className="demo-badge">React 19</span>
        <div className="demo-controls">
          <button
            className="btn-theme"
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <button id="btn-help" onClick={() => setHelpOpen(true)}>? Help</button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="demo-stats">
        <span className="stat-item">
          Showing <strong id="stat-showing">{stats.showing}</strong> of <strong>{stats.total}</strong> rows
        </span>
        <span className="stat-item">
          Columns: <strong>{stats.cols}</strong>
        </span>
        <span className="stat-item">
          Sort: <strong>{stats.sort}</strong>
          {stats.hasSort && (
            <button className="stat-clear" title="Clear sort" onClick={clearSort}>✕</button>
          )}
        </span>
        <span className="stat-item">
          Selected: <strong>{stats.selected}</strong>
          {stats.selected > 0 && (
            <button className="stat-clear" title="Clear selection" onClick={clearSelection}>✕</button>
          )}
        </span>
        {stats.filterText && (
          <span className="stat-item stat-item--filter active">
            <em className="stat-filter-icon">⊿</em>
            <span>{stats.filterText}</span>
            <button className="stat-clear" title="Clear filters" onClick={clearFilters}>✕</button>
          </span>
        )}
        <span className="stat-actions">
          <button onClick={addRow}>+ Add Row</button>
          <button onClick={removeSelected} disabled={stats.selected === 0}>Remove Selected</button>
        </span>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className="demo-grid-wrap">
        <UltimateGrid<Employee>
          columnDefs={COLUMN_DEFS}
          rowData={rowData}
          selectionMode="multi"
          rowHeight={36}
          cellRenderer={employeeCellRenderer}
          onGridReady={handleGridReady}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          onSelectionChanged={handleSelectionChanged}
        />
      </div>

      {/* ── Help modal ──────────────────────────────────────────────────── */}
      <div
        className={`help-backdrop${helpOpen ? ' open' : ''}`}
        onClick={() => setHelpOpen(false)}
      >
        <div className="help-modal" onClick={e => e.stopPropagation()}>
          <div className="help-modal-header">
            <h2>&#9889; Ultimate Data Grid — Quick Reference</h2>
            <button className="help-close" onClick={() => setHelpOpen(false)}>&#10005;</button>
          </div>
          <div className="help-body">

            {/* SELECTION */}
            <div className="help-section">
              <h3>Row Selection</h3>
              <table className="help-table">
                <thead><tr><th>Action</th><th>Result</th></tr></thead>
                <tbody>
                  <tr><td><span className="help-kbd">Click</span> a row</td><td>Select that row (deselects all others). Click again to deselect.</td></tr>
                  <tr><td><span className="help-kbd">Ctrl</span> + <span className="help-kbd">Click</span></td><td>Toggle that row on/off without affecting other selected rows.</td></tr>
                  <tr><td><span className="help-kbd">Click</span> + drag</td><td>Drag-select a contiguous range of rows.</td></tr>
                  <tr><td><span className="help-kbd">Ctrl</span> + drag on <em>unselected</em> row</td><td>Add dragged range to existing selection.</td></tr>
                  <tr><td><span className="help-kbd">Ctrl</span> + drag on <em>selected</em> row</td><td>Remove dragged range from existing selection.</td></tr>
                  <tr><td>Two-finger touch drag</td><td>Drag-select on mobile / trackpad.</td></tr>
                </tbody>
              </table>
            </div>

            {/* SORTING */}
            <div className="help-section">
              <h3>Sorting</h3>
              <table className="help-table">
                <thead><tr><th>Action</th><th>Result</th></tr></thead>
                <tbody>
                  <tr><td><span className="help-kbd">Click</span> column header</td><td>Sort by that column ascending (▲). Click again for descending (▼). Third click removes sort.</td></tr>
                  <tr><td><span className="help-kbd">Ctrl</span> + <span className="help-kbd">Click</span> header</td><td>Add as a <strong>secondary sort</strong> (multi-sort). The primary sort column is unchanged. Repeat to cycle asc → desc → off for that column independently.</td></tr>
                  <tr><td><em>Clear Sort</em> button</td><td>Remove all active sorts.</td></tr>
                </tbody>
              </table>
              <p>The sort priority order is shown in the stats bar, e.g. <em>department asc, salary desc</em>.</p>
            </div>

            {/* FILTERS */}
            <div className="help-section">
              <h3>Filter Expressions</h3>
              <p>Type directly into any filter input below the column header. Expressions are parsed automatically — no need to select an operator from a dropdown.</p>
              <table className="help-table">
                <thead><tr><th>Expression</th><th>Type</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td><code>alice</code></td><td>Text</td><td>Contains "alice" (case-insensitive)</td></tr>
                  <tr><td><code>=Engineering</code></td><td>Text</td><td>Exactly equals "Engineering"</td></tr>
                  <tr><td><code>!=Sales</code></td><td>Text</td><td>Does not equal "Sales"</td></tr>
                  <tr><td><code>^A</code></td><td>Text</td><td>Starts with "A"</td></tr>
                  <tr><td><code>on$</code></td><td>Text</td><td>Ends with "on"</td></tr>
                  <tr><td><code>&gt;80000</code></td><td>Number</td><td>Greater than 80 000</td></tr>
                  <tr><td><code>&gt;=50000</code></td><td>Number</td><td>Greater than or equal to 50 000</td></tr>
                  <tr><td><code>&lt;60000</code></td><td>Number</td><td>Less than 60 000</td></tr>
                  <tr><td><code>50000..80000</code></td><td>Number</td><td>Between 50 000 and 80 000 (inclusive)</td></tr>
                  <tr><td><code>=75</code> or <code>75</code></td><td>Number</td><td>Exactly 75</td></tr>
                  <tr><td><code>2020..2023</code></td><td>Date</td><td>Joined between 2020-01-01 and 2023-12-31</td></tr>
                  <tr><td><code>2021-06..2022-03</code></td><td>Date</td><td>Joined between June 2021 and March 2022</td></tr>
                  <tr><td><code>&gt;2022-01-01</code></td><td>Date</td><td>Joined after Jan 1 2022</td></tr>
                  <tr><td><code>=2019-03-04</code></td><td>Date</td><td>Joined on exactly that date</td></tr>
                </tbody>
              </table>
              <p>A <strong>red border</strong> on a filter input means the expression could not be parsed.</p>
              <p>Multiple column filters are combined with AND. Use the <em>Clear Filters</em> button to reset all at once.</p>
            </div>

            {/* TOOLBAR */}
            <div className="help-section">
              <h3>Toolbar</h3>
              <table className="help-table">
                <thead><tr><th>Button</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td><strong>+ Add Row</strong></td><td>Appends a new randomly-generated employee row.</td></tr>
                  <tr><td><strong>Remove Selected</strong></td><td>Permanently removes all currently-selected rows.</td></tr>
                  <tr><td><strong>Clear Filters</strong></td><td>Resets all column filter inputs and shows all rows.</td></tr>
                  <tr><td><strong>Clear Sort</strong></td><td>Removes all active sort columns and restores insertion order.</td></tr>
                  <tr><td><strong>🌙 / ☀️</strong></td><td>Toggle between dark and light mode. Overrides your OS preference.</td></tr>
                </tbody>
              </table>
            </div>

            {/* KEYBOARD */}
            <div className="help-section">
              <h3>Keyboard Shortcuts</h3>
              <table className="help-table">
                <thead><tr><th>Key</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td><span className="help-kbd">Esc</span></td><td>Close this help panel.</td></tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(<App />);
