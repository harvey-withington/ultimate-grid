<!--
  Ultimate Grid — Vue Demo

  Demonstrates the <UltimateGrid> component with:
   - Exposed GridApi via @grid-ready
   - Live stats bar updated via grid events
   - Add / Remove rows
   - Clear filters, sort, selection
   - Dark/light theme toggle
   - Help modal
-->

<script setup lang="ts">
import '../../core/src/styles/ugrid.css';
import '../../core/demo/demo-shared.css';

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import UltimateGrid from '../src/UltimateGrid.vue';
import type { GridApi, ColumnDef, SortState, FilterState, Column, RowNode } from '../../core/src/types.ts';
import { generateSpreadsheetData, SS_COLS, spreadsheetCellRenderer, formatCoord, formatRange, countCellsInRanges } from '../../core/demo/spreadsheet-data.ts';
import type { SpreadsheetRow } from '../../core/demo/spreadsheet-data.ts';

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
  'Karen Davis', 'Leo Zhang', 'Mia Patel', 'Noah Wilson', 'Olivia Moore',
  'Paul Taylor', 'Quinn Anderson', 'Rachel Harris', 'Sam Jackson', 'Tina Lee',
  'Uma Sharma', 'Victor Ng', 'Wendy Clark', 'Xander Lewis', 'Yara Scott',
];

function generateData(count: number): Employee[] {
  const rows: Employee[] = [];
  for (let i = 0; i < count; i++) {
    const nameIdx = i % NAMES.length;
    const suffix = i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '';
    rows.push({
      id:         i + 1,
      name:       NAMES[nameIdx] + suffix,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      role:       ROLES[i % ROLES.length],
      salary:     40000 + Math.floor((i * 3731 + 17) % 120000),
      score:      Math.floor((i * 97 + 13) % 101),
      location:   LOCATIONS[i % LOCATIONS.length],
      joined:     `${2015 + (i % 10)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      active:     i % 7 !== 0,
    });
  }
  return rows;
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

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

// ─── Page switching ──────────────────────────────────────────────────────────

const page = ref<'datagrid' | 'spreadsheet'>('datagrid');
function showPage(id: 'datagrid' | 'spreadsheet') { page.value = id; }

// ─── App state ────────────────────────────────────────────────────────────────

const apiRef      = ref<GridApi<Employee> | null>(null);
const totalRef    = ref(2000);
const rowData     = ref<Employee[]>(generateData(2000));
const dark        = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
const helpOpen    = ref(false);

const sortStateRef   = ref<SortState[]>([]);
const filterStateRef = ref<FilterState>({});

const stats = reactive({
  showing:    2000,
  total:      2000,
  cols:       COLUMN_DEFS.length,
  sort:       'none',
  hasSort:    false,
  selected:   0,
  filterText: '',
});

function updateStats(): void {
  const api = apiRef.value;
  if (!api) return;
  const selected    = api.getSelectedRowIds();
  const showing     = api.getDisplayedRowCount();
  const sortState   = sortStateRef.value;
  const filterState = filterStateRef.value;
  const filterText  = buildFilterSummary(filterState);
  const sort        = sortState.length
    ? sortState.map(s => `${s.colId} ${s.direction}`).join(', ')
    : 'none';
  stats.showing    = showing;
  stats.total      = totalRef.value;
  stats.cols       = COLUMN_DEFS.length;
  stats.sort       = sort;
  stats.hasSort    = sortState.length > 0;
  stats.selected   = selected.length;
  stats.filterText = filterText;
}

// Apply theme
function applyTheme(): void {
  document.body.classList.toggle('demo-dark',  dark.value);
  document.body.classList.toggle('demo-light', !dark.value);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function onGridReady(api: GridApi<Employee>): void {
  apiRef.value = api;
  updateStats();
}

function onSortChanged(e: any): void {
  sortStateRef.value = e.sortState ?? [];
  updateStats();
}

function onFilterChanged(e: any): void {
  filterStateRef.value = e.filterState ?? {};
  updateStats();
}

function onSelectionChanged(): void {
  updateStats();
}

function addRow(): void {
  const api = apiRef.value;
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
  totalRef.value += 1;
  updateStats();
}

function removeSelected(): void {
  const api = apiRef.value;
  if (!api) return;
  const ids = api.getSelectedRowIds();
  if (!ids.length) return;
  api.removeRows(ids);
  api.deselectAll();
  totalRef.value -= ids.length;
  updateStats();
}

function clearSort(): void {
  apiRef.value?.setSortModel([]);
}

function clearFilters(): void {
  apiRef.value?.setFilterModel({});
}

function clearSelection(): void {
  apiRef.value?.deselectAll();
  updateStats();
}

function toggleTheme(): void {
  dark.value = !dark.value;
  applyTheme();
}

// ─── Spreadsheet state ───────────────────────────────────────────────────────

const ssApiRef  = ref<GridApi | null>(null);
const ssRowData = ref(generateSpreadsheetData(200));
const ssColDefs = SS_COLS as ColumnDef[];
const ssOptions = { selectionUnit: 'cell' as const, getRowId: (d: any) => String(d.row) };

const ssStats = reactive({
  activeCell:    '\u2013',
  range:         '\u2013',
  selectedCount: 0,
});

function onSsGridReady(api: GridApi): void {
  ssApiRef.value = api;
}

function onSsSelectionChanged(e: any): void {
  ssStats.activeCell    = formatCoord(e.focusedCell);
  ssStats.range         = formatRange(e.selectedRanges ?? []);
  ssStats.selectedCount = countCellsInRanges(e.selectedRanges ?? []);
}

function onSsActiveCellChanged(e: any): void {
  ssStats.activeCell = formatCoord(e.cell);
}

function ssClearSelection(): void {
  ssApiRef.value?.deselectAll();
  ssStats.activeCell    = '\u2013';
  ssStats.range         = '\u2013';
  ssStats.selectedCount = 0;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  applyTheme();
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') helpOpen.value = false; };
  document.addEventListener('keydown', handler);
  onUnmounted(() => document.removeEventListener('keydown', handler));
});
</script>

<template>
  <!-- ── Top bar ──────────────────────────────────────────────────────────── -->
  <div class="demo-bar">
    <h1>&#9889; Ultimate Data Grid</h1>
    <nav class="demo-nav">
      <a class="demo-nav-tab" :class="{active: page === 'datagrid'}" href="#" @click.prevent="showPage('datagrid')">Data Grid</a>
      <a class="demo-nav-tab" :class="{active: page === 'spreadsheet'}" href="#" @click.prevent="showPage('spreadsheet')">Spreadsheet</a>
    </nav>
    <span class="demo-badge">Vue 3</span>
    <div class="demo-controls">
      <button
        class="btn-theme"
        @click="toggleTheme"
        :title="dark ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        {{ dark ? '☀️' : '🌙' }}
      </button>
      <button id="btn-help" @click="helpOpen = true">? Help</button>
    </div>
  </div>

  <!-- ══════════ PAGE: Data Grid ══════════ -->
  <div v-show="page === 'datagrid'" class="demo-page">
    <div class="demo-stats">
      <span class="stat-item">
        Showing <strong id="stat-showing">{{ stats.showing }}</strong> of <strong>{{ stats.total }}</strong> rows
      </span>
      <span class="stat-item">
        Columns: <strong>{{ stats.cols }}</strong>
      </span>
      <span class="stat-item">
        Sort: <strong>{{ stats.sort }}</strong>
        <button v-if="stats.hasSort" class="stat-clear" title="Clear sort" @click="clearSort">✕</button>
      </span>
      <span class="stat-item">
        Selected: <strong>{{ stats.selected }}</strong>
        <button v-if="stats.selected > 0" class="stat-clear" title="Clear selection" @click="clearSelection">✕</button>
      </span>
      <span v-if="stats.filterText" class="stat-item stat-item--filter active">
        <em class="stat-filter-icon">⊿</em>
        <span>{{ stats.filterText }}</span>
        <button class="stat-clear" title="Clear filters" @click="clearFilters">✕</button>
      </span>
      <span class="stat-actions">
        <button @click="addRow">+ Add Row</button>
        <button @click="removeSelected" :disabled="stats.selected === 0">Remove Selected</button>
      </span>
    </div>
    <div class="demo-grid-wrap">
      <UltimateGrid
        :column-defs="COLUMN_DEFS"
        :row-data="rowData"
        selection-mode="multi"
        :row-height="36"
        :cell-renderer="employeeCellRenderer"
        @grid-ready="onGridReady"
        @sort-changed="onSortChanged"
        @filter-changed="onFilterChanged"
        @selection-changed="onSelectionChanged"
      />
    </div>
  </div>

  <!-- ══════════ PAGE: Spreadsheet ══════════ -->
  <div v-show="page === 'spreadsheet'" class="demo-page">
    <div class="demo-stats">
      <span class="stat-item">Active cell: <strong>{{ ssStats.activeCell }}</strong></span>
      <span class="stat-item">Range: <strong>{{ ssStats.range }}</strong></span>
      <span class="stat-item">Selected cells: <strong>{{ ssStats.selectedCount }}</strong></span>
      <span class="stat-actions">
        <button @click="ssClearSelection">Clear Selection</button>
      </span>
    </div>
    <div class="demo-grid-wrap">
      <UltimateGrid
        :column-defs="ssColDefs"
        :row-data="ssRowData"
        selection-mode="multi"
        :row-height="28"
        :cell-renderer="spreadsheetCellRenderer"
        :options="ssOptions"
        @grid-ready="onSsGridReady"
        @selection-changed="onSsSelectionChanged"
        @active-cell-changed="onSsActiveCellChanged"
      />
    </div>
  </div>

  <!-- ── Help modal ─────────────────────────────────────────────────────────── -->
  <div :class="`help-backdrop${helpOpen ? ' open' : ''}`" @click="helpOpen = false">
    <div class="help-modal" @click.stop>
      <div class="help-modal-header">
        <h2>&#9889; Ultimate Data Grid — Quick Reference</h2>
        <button class="help-close" @click="helpOpen = false">&#10005;</button>
      </div>
      <div class="help-body">

        <!-- SELECTION -->
        <div class="help-section">
          <h3>Row Selection</h3>
          <table class="help-table">
            <thead><tr><th>Action</th><th>Result</th></tr></thead>
            <tbody>
              <tr><td><span class="help-kbd">Click</span> a row</td><td>Select that row (deselects all others). Click again to deselect.</td></tr>
              <tr><td><span class="help-kbd">Ctrl</span> + <span class="help-kbd">Click</span></td><td>Toggle that row on/off without affecting other selected rows.</td></tr>
              <tr><td><span class="help-kbd">Click</span> + drag</td><td>Drag-select a contiguous range of rows.</td></tr>
              <tr><td><span class="help-kbd">Ctrl</span> + drag on <em>unselected</em> row</td><td>Add dragged range to existing selection.</td></tr>
              <tr><td><span class="help-kbd">Ctrl</span> + drag on <em>selected</em> row</td><td>Remove dragged range from existing selection.</td></tr>
              <tr><td>Two-finger touch drag</td><td>Drag-select on mobile / trackpad.</td></tr>
            </tbody>
          </table>
        </div>

        <!-- SORTING -->
        <div class="help-section">
          <h3>Sorting</h3>
          <table class="help-table">
            <thead><tr><th>Action</th><th>Result</th></tr></thead>
            <tbody>
              <tr><td><span class="help-kbd">Click</span> column header</td><td>Sort by that column ascending (▲). Click again for descending (▼). Third click removes sort.</td></tr>
              <tr><td><span class="help-kbd">Ctrl</span> + <span class="help-kbd">Click</span> header</td><td>Add as a <strong>secondary sort</strong> (multi-sort).</td></tr>
              <tr><td><em>Clear Sort</em> button</td><td>Remove all active sorts.</td></tr>
            </tbody>
          </table>
          <p>The sort priority order is shown in the stats bar, e.g. <em>department asc, salary desc</em>.</p>
        </div>

        <!-- FILTERS -->
        <div class="help-section">
          <h3>Filter Expressions</h3>
          <p>Type directly into any filter input below the column header. Expressions are parsed automatically.</p>
          <table class="help-table">
            <thead><tr><th>Expression</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>alice</code></td><td>Text</td><td>Contains "alice" (case-insensitive)</td></tr>
              <tr><td><code>=Engineering</code></td><td>Text</td><td>Exactly equals "Engineering"</td></tr>
              <tr><td><code>!=Sales</code></td><td>Text</td><td>Does not equal "Sales"</td></tr>
              <tr><td><code>^A</code></td><td>Text</td><td>Starts with "A"</td></tr>
              <tr><td><code>on$</code></td><td>Text</td><td>Ends with "on"</td></tr>
              <tr><td><code>&gt;80000</code></td><td>Number</td><td>Greater than 80 000</td></tr>
              <tr><td><code>50000..80000</code></td><td>Number</td><td>Between 50 000 and 80 000 (inclusive)</td></tr>
              <tr><td><code>2020..2023</code></td><td>Date</td><td>Joined between 2020-01-01 and 2023-12-31</td></tr>
              <tr><td><code>&gt;2022-01-01</code></td><td>Date</td><td>Joined after Jan 1 2022</td></tr>
            </tbody>
          </table>
          <p>A <strong>red border</strong> on a filter input means the expression could not be parsed.</p>
          <p>Multiple column filters are combined with AND. Use the <em>Clear Filters</em> button to reset all at once.</p>
        </div>

        <!-- TOOLBAR -->
        <div class="help-section">
          <h3>Toolbar</h3>
          <table class="help-table">
            <thead><tr><th>Button</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><strong>+ Add Row</strong></td><td>Appends a new randomly-generated employee row.</td></tr>
              <tr><td><strong>Remove Selected</strong></td><td>Permanently removes all currently-selected rows.</td></tr>
              <tr><td><strong>Clear Filters</strong></td><td>Resets all column filter inputs and shows all rows.</td></tr>
              <tr><td><strong>Clear Sort</strong></td><td>Removes all active sort columns and restores insertion order.</td></tr>
              <tr><td><strong>🌙 / ☀️</strong></td><td>Toggle between dark and light mode.</td></tr>
            </tbody>
          </table>
        </div>

        <!-- KEYBOARD -->
        <div class="help-section">
          <h3>Keyboard Shortcuts</h3>
          <table class="help-table">
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><span class="help-kbd">Esc</span></td><td>Close this help panel.</td></tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </div>
</template>
