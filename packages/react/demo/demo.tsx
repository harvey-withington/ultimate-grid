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
import type { GridApi, ColumnDef, SortState, FilterState } from '../../core/src/types.ts';

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
            <div className="help-section">
              <h3>Selection</h3>
              <table className="help-table">
                <thead><tr><th>Action</th><th>Result</th></tr></thead>
                <tbody>
                  <tr><td>Click row</td><td>Select single row (deselects others)</td></tr>
                  <tr><td><span className="help-kbd">Ctrl</span> + Click</td><td>Toggle row in/out of selection</td></tr>
                  <tr><td><span className="help-kbd">Shift</span> + Click</td><td>Extend selection to row (range)</td></tr>
                  <tr><td>Click &amp; drag</td><td>Drag-select a range of rows</td></tr>
                  <tr><td>Click empty area</td><td>Deselect all</td></tr>
                </tbody>
              </table>
            </div>
            <div className="help-section">
              <h3>Sorting</h3>
              <table className="help-table">
                <thead><tr><th>Action</th><th>Result</th></tr></thead>
                <tbody>
                  <tr><td>Click column header</td><td>Sort ascending → descending → off</td></tr>
                  <tr><td><span className="help-kbd">Shift</span> + Click header</td><td>Add column to multi-sort</td></tr>
                  <tr><td>✕ next to sort in stats bar</td><td>Clear all sort</td></tr>
                </tbody>
              </table>
            </div>
            <div className="help-section">
              <h3>Filtering</h3>
              <table className="help-table">
                <thead><tr><th>Expression</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td><code>alice</code></td><td>Contains "alice" (case-insensitive)</td></tr>
                  <tr><td><code>=alice</code></td><td>Exact match</td></tr>
                  <tr><td><code>!=alice</code></td><td>Not equal</td></tr>
                  <tr><td><code>^alice</code></td><td>Starts with</td></tr>
                  <tr><td><code>alice$</code></td><td>Ends with</td></tr>
                  <tr><td><code>&gt;50</code> <code>&gt;=50</code> <code>&lt;50</code></td><td>Numeric comparisons</td></tr>
                  <tr><td><code>10..20</code></td><td>Numeric range (inclusive)</td></tr>
                  <tr><td><code>&gt;2020-01-01</code></td><td>Date after</td></tr>
                  <tr><td><code>2020..2022</code></td><td>Date year range</td></tr>
                </tbody>
              </table>
              <p>Click the ▽ icon on a cell to filter by that exact value. Click ✕ on the icon to clear it.</p>
            </div>
            <div className="help-section">
              <h3>Toolbar</h3>
              <table className="help-table">
                <thead><tr><th>Button</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td>🌙 / ☀️</td><td>Toggle dark / light theme</td></tr>
                  <tr><td>+ Add Row</td><td>Append a new row</td></tr>
                  <tr><td>Remove Selected</td><td>Delete all selected rows</td></tr>
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
