/**
 * Ultimate Grid — Angular Demo
 *
 * Demonstrates the <ultimate-grid> component with:
 *  - Exposed GridApi via (gridReady)
 *  - Live stats bar updated via grid events
 *  - Add / Remove rows
 *  - Clear filters, sort, selection
 *  - Dark/light theme toggle
 *  - Help modal
 */

import '../../core/src/styles/ugrid.css';
import '../../core/demo/demo-shared.css';

import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UltimateGridComponent } from '../src/ultimate-grid.component.ts';
import type {
  GridApi,
  ColumnDef,
  SortState,
  FilterState,
  Column,
  RowNode,
} from '../../core/src/types.ts';

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

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UltimateGridComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ── Top bar ──────────────────────────────────────────────────────── -->
    <div class="demo-bar">
      <h1>&#9889; Ultimate Data Grid</h1>
      <span>Angular wrapper demo</span>
      <span class="demo-badge">Angular 17</span>
      <div class="demo-controls">
        <button
          class="btn-theme"
          (click)="toggleTheme()"
          [title]="dark ? 'Switch to light mode' : 'Switch to dark mode'"
        >{{ dark ? '☀️' : '🌙' }}</button>
        <button id="btn-help" (click)="helpOpen = true">? Help</button>
      </div>
    </div>

    <!-- ── Stats bar ─────────────────────────────────────────────────────── -->
    <div class="demo-stats">
      <span class="stat-item">
        Showing <strong id="stat-showing">{{ statShowing }}</strong> of <strong>{{ statTotal }}</strong> rows
      </span>
      <span class="stat-item">
        Columns: <strong>{{ statCols }}</strong>
      </span>
      <span class="stat-item">
        Sort: <strong>{{ statSort }}</strong>
        <button *ngIf="statHasSort" class="stat-clear" title="Clear sort" (click)="clearSort()">✕</button>
      </span>
      <span class="stat-item">
        Selected: <strong>{{ statSelected }}</strong>
        <button *ngIf="statSelected > 0" class="stat-clear" title="Clear selection" (click)="clearSelection()">✕</button>
      </span>
      <span *ngIf="statFilterText" class="stat-item stat-item--filter active">
        <em class="stat-filter-icon">⊿</em>
        <span>{{ statFilterText }}</span>
        <button class="stat-clear" title="Clear filters" (click)="clearFilters()">✕</button>
      </span>
      <span class="stat-actions">
        <button (click)="addRow()">+ Add Row</button>
        <button (click)="removeSelected()" [disabled]="statSelected === 0">Remove Selected</button>
      </span>
    </div>

    <!-- ── Grid ──────────────────────────────────────────────────────────── -->
    <div class="demo-grid-wrap">
      <ultimate-grid
        [columnDefs]="columnDefs"
        [rowData]="rowData"
        selectionMode="multi"
        [rowHeight]="36"
        [cellRenderer]="cellRenderer"
        (gridReady)="onGridReady($event)"
        (sortChanged)="onSortChanged($event)"
        (filterChanged)="onFilterChanged($event)"
        (selectionChanged)="onSelectionChanged()"
      />
    </div>

    <!-- ── Help modal ─────────────────────────────────────────────────────── -->
    <div [class]="'help-backdrop' + (helpOpen ? ' open' : '')" (click)="helpOpen = false">
      <div class="help-modal" (click)="$event.stopPropagation()">
        <div class="help-modal-header">
          <h2>&#9889; Ultimate Data Grid — Quick Reference</h2>
          <button class="help-close" (click)="helpOpen = false">&#10005;</button>
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
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly columnDefs: ColumnDef<Employee>[] = COLUMN_DEFS;
  readonly cellRenderer = employeeCellRenderer;
  rowData: Employee[] = generateData(2000);

  dark     = window.matchMedia('(prefers-color-scheme: dark)').matches;
  helpOpen = false;

  statShowing    = 2000;
  statTotal      = 2000;
  statCols       = COLUMN_DEFS.length;
  statSort       = 'none';
  statHasSort    = false;
  statSelected   = 0;
  statFilterText = '';

  private cdr = inject(ChangeDetectorRef);

  private api:         GridApi<Employee> | null = null;
  private total        = 2000;
  private sortState:   SortState[]  = [];
  private filterState: FilterState  = {};

  constructor() {}

  ngOnInit(): void {
    this.applyTheme();
  }

  ngOnDestroy(): void {}

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.helpOpen = false;
      this.cdr.markForCheck();
    }
  }

  // ─── Grid event handlers ──────────────────────────────────────────────────

  onGridReady(api: GridApi<Employee>): void {
    this.api = api;
    this.updateStats();
  }

  onSortChanged(e: any): void {
    this.sortState = e.sortState ?? [];
    this.updateStats();
  }

  onFilterChanged(e: any): void {
    this.filterState = e.filterState ?? {};
    this.updateStats();
  }

  onSelectionChanged(): void {
    this.updateStats();
  }

  // ─── Toolbar actions ──────────────────────────────────────────────────────

  addRow(): void {
    const api = this.api;
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
    this.total += 1;
    this.updateStats();
  }

  removeSelected(): void {
    const api = this.api;
    if (!api) return;
    const ids = api.getSelectedRowIds();
    if (!ids.length) return;
    api.removeRows(ids);
    api.deselectAll();
    this.total -= ids.length;
    this.updateStats();
  }

  clearSort(): void {
    this.api?.setSortModel([]);
  }

  clearFilters(): void {
    this.api?.setFilterModel({});
  }

  clearSelection(): void {
    this.api?.deselectAll();
    this.updateStats();
  }

  toggleTheme(): void {
    this.dark = !this.dark;
    this.applyTheme();
    this.cdr.markForCheck();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private updateStats(): void {
    const api = this.api;
    if (!api) return;
    const selectedIds  = api.getSelectedRowIds();
    const showing      = api.getDisplayedRowCount();
    const filterText   = buildFilterSummary(this.filterState);
    const sort         = this.sortState.length
      ? this.sortState.map(s => `${s.colId} ${s.direction}`).join(', ')
      : 'none';
    this.statShowing    = showing;
    this.statTotal      = this.total;
    this.statSort       = sort;
    this.statHasSort    = this.sortState.length > 0;
    this.statSelected   = selectedIds.length;
    this.statFilterText = filterText;
    this.cdr.markForCheck();
  }

  private applyTheme(): void {
    document.body.classList.toggle('demo-dark',  this.dark);
    document.body.classList.toggle('demo-light', !this.dark);
  }
}
