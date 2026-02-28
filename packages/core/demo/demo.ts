import '../src/styles/ugrid.css';
import { applyTheme, openHelp, closeHelp } from './theme';
import { createGrid } from '../src/createGrid';
import type { Column, ColumnDef, RowNode, SortState, FilterState, GridApi } from '../src/types';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
  score: number;       // 0–100
  location: string;
  joined: string;
  active: boolean;
}

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
      id: i + 1,
      name: NAMES[nameIdx] + suffix,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      role: ROLES[i % ROLES.length],
      salary: 40000 + Math.floor((i * 3731 + 17) % 120000),
      score: Math.floor((i * 97 + 13) % 101),
      location: LOCATIONS[i % LOCATIONS.length],
      joined: `${2015 + (i % 10)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      active: i % 7 !== 0,
    });
  }
  return rows;
}

// ─── Column Defs ─────────────────────────────────────────────────────────────

const COLUMN_DEFS: ColumnDef<Employee>[] = [
  { key: 'id',         field: 'id',         headerName: '#',           width: 60  },
  { key: 'name',       field: 'name',       headerName: 'Name',        width: 180 },
  { key: 'department', field: 'department', headerName: 'Department',  width: 130, filterIcon: true },
  { key: 'role',       field: 'role',       headerName: 'Role',        width: 100, filterIcon: true },
  { key: 'location',   field: 'location',   headerName: 'Location',    width: 120, filterIcon: true },
  { key: 'salary',     field: 'salary',     headerName: 'Salary',      width: 110 },
  { key: 'score',      field: 'score',      headerName: 'Score',       width: 100 },
  { key: 'joined',     field: 'joined',     headerName: 'Joined',      width: 110 },
  { key: 'active',     field: 'active',     headerName: 'Active',      width: 80  },
];

const ROW_HEIGHT = 36;
const OVERSCAN   = 5;

// ─── Custom cell renderer ─────────────────────────────────────────────────────

function employeeCellRenderer(col: Column, node: RowNode, value: unknown): HTMLElement | null {
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
      cell.textContent = value ? '☑' : '⮽';
      return cell;

    default:
      return null; // fall through to RenderPipeline default
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const container = document.getElementById('grid-container')!;
container.style.height = '100%';

let _totalRows = 0;
let _sortState: SortState[] = [];
let _filterState: FilterState = {};

const api: GridApi<Employee> = createGrid<Employee>({
  container,
  columnDefs: COLUMN_DEFS,
  rowData: generateData(2000),
  getRowId: (d) => String(d.id),
  rowHeight: ROW_HEIGHT,
  cellRenderer: employeeCellRenderer,
});

// ─── Stats bar ───────────────────────────────────────────────────────────────────────────────

const btnRemove = document.getElementById('btn-remove') as HTMLButtonElement;

_totalRows = 2000;
const _statCols = COLUMN_DEFS.length;

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

function updateStats(): void {
  const selected  = api.getSelectedRowIds();
  const showing   = api.getDisplayedRowCount();
  const sort      = _sortState.length
    ? _sortState.map((s: SortState) => `${s.colId} ${s.direction}`).join(', ')
    : 'none';
  const filterSummary = buildFilterSummary(_filterState);
  const hasFilter  = filterSummary.length > 0;
  const hasSort    = _sortState.length > 0;
  const hasSelected = selected.length > 0;

  document.getElementById('stat-showing')!.textContent  = String(showing);
  document.getElementById('stat-total')!.textContent    = String(_totalRows);
  document.getElementById('stat-cols')!.textContent     = String(_statCols);
  document.getElementById('stat-sort')!.textContent     = sort;
  document.getElementById('stat-selected')!.textContent = String(selected.length);

  document.getElementById('stat-filter-text')!.textContent = filterSummary;
  document.getElementById('stat-filter-item')!.classList.toggle('active', hasFilter);

  (document.getElementById('btn-stat-clear-sort') as HTMLButtonElement).style.display      = hasSort     ? '' : 'none';
  (document.getElementById('btn-stat-clear-selection') as HTMLButtonElement).style.display = hasSelected ? '' : 'none';
  if (btnRemove) btnRemove.disabled = !hasSelected;
}

api.on('rowDataChanged',   () => updateStats());
api.on('sortChanged',      (e) => { _sortState = e.sortState; updateStats(); });
api.on('filterChanged',    (e) => { _filterState = e.filterState; updateStats(); });
api.on('selectionChanged', () => updateStats());
updateStats();

// ─── Action buttons (stats bar) ─────────────────────────────────────────────

document.getElementById('btn-add')!.addEventListener('click', () => {
  const id = Date.now();
  api.addRows([{
    id,
    name: NAMES[id % NAMES.length] + ' (new)',
    department: DEPARTMENTS[id % DEPARTMENTS.length],
    role: 'Junior',
    salary: 45000,
    score: 50,
    location: LOCATIONS[id % LOCATIONS.length],
    joined: new Date().toISOString().slice(0, 10),
    active: true,
  }]);
  _totalRows++;
  updateStats();
});

btnRemove.addEventListener('click', () => {
  const ids = api.getSelectedRowIds();
  if (ids.length === 0) return;
  api.removeRows(ids);
  api.deselectAll();
  _totalRows -= ids.length;
  updateStats();
});

document.getElementById('btn-stat-clear-sort')!.addEventListener('click',      () => api.setSortModel([]));
document.getElementById('btn-stat-clear-filters')!.addEventListener('click',   () => api.setFilterModel({}));
document.getElementById('btn-stat-clear-selection')!.addEventListener('click', () => { api.deselectAll(); updateStats(); });

// ─── Theme toggle ─────────────────────────────────────────────────────────────

const btnTheme     = document.getElementById('btn-theme')!;
const gridContainer = document.getElementById('grid-container')!;
const prefersDark  = window.matchMedia('(prefers-color-scheme: dark)');

let _isDark = prefersDark.matches;
applyTheme(_isDark, document.body, gridContainer, btnTheme);

btnTheme.addEventListener('click', () => {
  _isDark = !_isDark;
  applyTheme(_isDark, document.body, gridContainer, btnTheme);
});

// ─── Help modal ───────────────────────────────────────────────────────────────

const backdrop = document.getElementById('help-backdrop')!;

document.getElementById('btn-help')!.addEventListener('click',  () => openHelp(backdrop));
document.getElementById('help-close')!.addEventListener('click', () => closeHelp(backdrop));

backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) closeHelp(backdrop);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHelp(backdrop);
});
