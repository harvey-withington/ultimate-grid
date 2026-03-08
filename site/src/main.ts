/**
 * Ultimate Data Grid — Product Site Entry Point
 *
 * Mounts a live interactive grid demo, handles framework tab switching,
 * and wires up the demo theme toggle.
 */

import '../../packages/core/src/styles/ugrid.css';
import './site.css';

import { createGrid, formatCellCoord, formatCellRange } from '../../packages/core/src/index.ts';
import type { GridApi, ColumnDef, Column, RowNode } from '../../packages/core/src/types.ts';
import { generateSpreadsheetData, SS_COLS } from '../../packages/core/demo/spreadsheet-data.ts';
import type { SpreadsheetRow } from '../../packages/core/demo/spreadsheet-data.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Data helpers ────────────────────────────────────────────────────────────

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

// ─── Column definitions ──────────────────────────────────────────────────────

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

// ─── Mount live demo ─────────────────────────────────────────────────────────

const container = document.getElementById('demo-grid')!;
container.style.width = '100%';
container.style.height = '100%';

const api: GridApi<Employee> = createGrid<Employee>({
  container,
  columnDefs: COLUMN_DEFS,
  rowData: generateData(2000),
  getRowId: (d: Employee) => String(d.id),
  rowHeight: 36,
  cellRenderer: employeeCellRenderer,
});

// ─── Spreadsheet grid (lazy-mounted) ─────────────────────────────────────────

const ssContainer = document.getElementById('ss-grid-container')!;
ssContainer.style.width = '100%';
ssContainer.style.height = '100%';

let ssApi: GridApi<SpreadsheetRow> | null = null;
let ssMounted = false;

function mountSpreadsheet(): void {
  if (ssMounted) return;
  ssMounted = true;

  ssApi = createGrid<SpreadsheetRow>({
    container: ssContainer,
    columnDefs: SS_COLS as ColumnDef<SpreadsheetRow>[],
    rowData: generateSpreadsheetData(200),
    getRowId: (d: SpreadsheetRow) => String(d.row),
    rowHeight: 28,
    selectionMode: 'multi',
    selectionUnit: 'cell',
    cellRenderer: 'spreadsheet',
  });

  const elActiveCell    = document.getElementById('ss-active-cell')!;
  const elRange         = document.getElementById('ss-range')!;
  const elSelectedCount = document.getElementById('ss-selected-count')!;

  ssApi.on('selectionChanged', () => {
    elActiveCell.textContent    = formatCellCoord(ssApi!.getActiveCell(), SS_COLS);
    elRange.textContent         = formatCellRange(ssApi!.getSelectedRanges(), SS_COLS);
    elSelectedCount.textContent = String(ssApi!.getSelectedCellCount());
  });

  ssApi.on('activeCellChanged', () => {
    elActiveCell.textContent = formatCellCoord(ssApi!.getActiveCell(), SS_COLS);
  });

  // Apply current theme
  ssContainer.querySelector('.ugrid')?.classList.toggle('ugrid-theme-dark', dark);
}

// ─── Demo tab switching ──────────────────────────────────────────────────────

const demoTabBtns = document.querySelectorAll<HTMLButtonElement>('.site-demo-tab');
const pageDg = document.getElementById('demo-page-datagrid')!;
const pageSs = document.getElementById('demo-page-spreadsheet')!;
const statsDg = document.getElementById('demo-stats-dg')!;
const statsSs = document.getElementById('demo-stats-ss')!;

demoTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.demo!;
    demoTabBtns.forEach(b => b.classList.toggle('active', b === btn));
    pageDg.style.display  = target === 'datagrid'    ? '' : 'none';
    pageSs.style.display  = target === 'spreadsheet' ? '' : 'none';
    statsDg.style.display = target === 'datagrid'    ? '' : 'none';
    statsSs.style.display = target === 'spreadsheet' ? '' : 'none';
    if (target === 'spreadsheet') mountSpreadsheet();
  });
});

// ─── Demo theme toggle ──────────────────────────────────────────────────────

let dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const btnTheme = document.getElementById('demo-theme-toggle')!;
const gridEl = container.querySelector('.ugrid');

function applyDemoTheme(): void {
  document.body.classList.toggle('demo-dark',  dark);
  document.body.classList.toggle('demo-light', !dark);
  gridEl?.classList.toggle('ugrid-theme-dark', dark);
  ssContainer.querySelector('.ugrid')?.classList.toggle('ugrid-theme-dark', dark);
  btnTheme.textContent = dark ? '☀️' : '🌙';
  btnTheme.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

btnTheme.addEventListener('click', () => {
  dark = !dark;
  applyDemoTheme();
});

applyDemoTheme();

// ─── Demo stats (data grid) ─────────────────────────────────────────────────

const elShowing   = document.getElementById('demo-stat-showing')!;
const elTotal     = document.getElementById('demo-stat-total')!;
const elSort      = document.getElementById('demo-stat-sort')!;
const elSelected  = document.getElementById('demo-stat-selected')!;

let totalRows = 2000;

function updateStats(): void {
  elShowing.textContent  = String(api.getDisplayedRowCount());
  elTotal.textContent    = String(totalRows);
  elSelected.textContent = String(api.getSelectedRowIds().length);

  const sorts = api.getSortModel();
  elSort.textContent = sorts.length
    ? sorts.map(s => `${s.colId} ${s.direction}`).join(', ')
    : 'none';
}

api.on('rowDataChanged',   () => updateStats());
api.on('filterChanged',    () => updateStats());
api.on('sortChanged',      () => updateStats());
api.on('selectionChanged', () => updateStats());
updateStats();

// ─── Framework tab switching ─────────────────────────────────────────────────

const tabBtns   = document.querySelectorAll<HTMLButtonElement>('.site-fw-tab');
const tabPanels = document.querySelectorAll<HTMLElement>('.site-fw-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.fw!;
    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === `fw-${target}`));
  });
});

// ─── Smooth scroll for nav links ─────────────────────────────────────────────

document.querySelectorAll<HTMLAnchorElement>('.site-nav-links a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href')!);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
