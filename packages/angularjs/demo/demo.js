/**
 * Ultimate Grid — AngularJS v1 Demo
 *
 * Demonstrates the <ultimate-grid> directive with:
 *  - Two-way bound columnDefs & rowData
 *  - Exposed GridApi via the `api` binding
 *  - Live stats updated via ugrid:* broadcast events
 *  - Add / Remove / Clear filters / Clear sort toolbar
 *  - Dark/light theme toggle
 */

import '../../core/src/styles/ugrid.css';
import '../../core/demo/demo-shared.css';
import '../src/ultimate-grid-angularjs.js';  // registers the 'ultimateGrid' module
import { generateSpreadsheetData, SS_COLS, spreadsheetCellRenderer, formatCoord, formatRange, countCellsInRanges } from '../../core/demo/spreadsheet-data.ts';

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

function generateData(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const nameIdx = i % NAMES.length;
    const suffix  = i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '';
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

// ─── Custom cell renderer (same as core demo) ─────────────────────────────────

function employeeCellRenderer(col, node, value) {
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
      cell.className = 'ugrid-cell ugrid-cell--checkbox' + (value ? ' ugrid-cell--checked' : ' ugrid-cell--unchecked');
      cell.textContent = value ? '☑' : '⮽';
      return cell;

    default:
      return null;
  }
}

// ─── AngularJS app ─────────────────────────────────────────────────────────────────────────────────

const COLUMN_HEADER_MAP = {
  id: '#', name: 'Name', department: 'Department', role: 'Role',
  location: 'Location', salary: 'Salary', score: 'Score',
  joined: 'Joined', active: 'Active',
};

function buildFilterSummary(filterState) {
  return Object.entries(filterState)
    .filter(function(_ref) { return _ref[1] != null; })
    .map(function(_ref) {
      var colId = _ref[0], v = _ref[1];
      var label = COLUMN_HEADER_MAP[colId] || colId;
      var val = (v && v.value != null) ? v.value
              : (v && v.values)        ? v.values.join(', ')
              : '';
      return label + ': ' + val;
    })
    .join(', ');
}

angular.module('ugridDemo', ['ultimateGrid'])

.controller('DemoCtrl', ['$scope', '$rootScope', function($scope, $rootScope) {
  const vm = this;

  // ── Page switching ─────────────────────────────────────────────────────────
  vm.page = 'datagrid';
  vm.showPage = function(id) { vm.page = id; };

  // ── Column definitions ────────────────────────────────────────────────────
  vm.columnDefs = [
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

  // ── Row data ──────────────────────────────────────────────────────────────
  vm.rowData = generateData(2000);

  // ── Grid options bag ──────────────────────────────────────────────────────
  vm.gridOptions = {
    getRowId:     function(d) { return String(d.id); },
    rowHeight:    36,
    cellRenderer: employeeCellRenderer,
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  vm.stats = {
    total:      vm.rowData.length,
    showing:    vm.rowData.length,
    cols:       vm.columnDefs.length,
    sort:       'none',
    hasSort:    false,
    selected:   0,
    filterText: '',
  };

  // ── Help modal ───────────────────────────────────────────────────────────────
  vm.helpOpen = false;

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && vm.helpOpen) {
      $scope.$apply(function() { vm.helpOpen = false; });
    }
  });

  // ── GridApi handle (filled by directive via api="vm.gridApi") ─────────────
  vm.gridApi = null;

  vm.onGridReady = function(api) {
    vm.gridApi = api;
    vm.stats.showing = api.getDisplayedRowCount();
  };

  // ── Listen to forwarded grid events ───────────────────────────────────────
  $rootScope.$on('ugrid:selectionChanged', function(_, e) {
    if (vm.page !== 'datagrid') return;
    vm.stats.selected = e.selectedRowIds.length;
  });

  $rootScope.$on('ugrid:sortChanged', function(_, e) {
    if (vm.page !== 'datagrid') return;
    vm.stats.hasSort = e.sortState.length > 0;
    vm.stats.sort    = vm.stats.hasSort
      ? e.sortState.map(function(s) { return s.colId + ' ' + s.direction; }).join(', ')
      : 'none';
  });

  $rootScope.$on('ugrid:filterChanged', function(_, e) {
    if (vm.page !== 'datagrid') return;
    vm.stats.showing     = vm.gridApi ? vm.gridApi.getDisplayedRowCount() : vm.rowData.length;
    vm.stats.filterText  = buildFilterSummary(e.filterState || {});
  });

  $rootScope.$on('ugrid:rowDataChanged', function() {
    if (vm.page !== 'datagrid') return;
    vm.stats.total   = vm.rowData.length;
    vm.stats.showing = vm.gridApi ? vm.gridApi.getDisplayedRowCount() : vm.rowData.length;
  });

  // ── Toolbar actions ───────────────────────────────────────────────────────
  vm.addRow = function() {
    if (!vm.gridApi) return;
    const id = Date.now();
    const newRow = {
      id,
      name:       NAMES[id % NAMES.length] + ' (new)',
      department: DEPARTMENTS[id % DEPARTMENTS.length],
      role:       'Junior',
      salary:     45000,
      score:      50,
      location:   LOCATIONS[id % LOCATIONS.length],
      joined:     new Date().toISOString().slice(0, 10),
      active:     true,
    };
    vm.gridApi.addRows([newRow]);
    vm.rowData = vm.rowData.concat([newRow]);
    vm.stats.total++;
    vm.stats.showing++;
  };

  vm.removeSelected = function() {
    if (!vm.gridApi) return;
    const ids = vm.gridApi.getSelectedRowIds();
    if (ids.length === 0) return;
    vm.gridApi.removeRows(ids);
    vm.gridApi.deselectAll();
    const idSet = new Set(ids);
    vm.rowData = vm.rowData.filter(function(r) { return !idSet.has(String(r.id)); });
    vm.stats.total   -= ids.length;
    vm.stats.showing -= ids.length;
    vm.stats.selected = 0;
  };

  vm.clearFilters = function() {
    if (vm.gridApi) vm.gridApi.setFilterModel({});
  };

  vm.clearSort = function() {
    if (vm.gridApi) vm.gridApi.setSortModel([]);
  };

  vm.clearSelection = function() {
    if (vm.gridApi) vm.gridApi.deselectAll();
    vm.stats.selected = 0;
  };

  // ── Spreadsheet mode ──────────────────────────────────────────────────────
  vm.ssColumnDefs = SS_COLS;
  vm.ssRowData    = generateSpreadsheetData(200);
  vm.ssGridOptions = {
    getRowId:       function(d) { return String(d.row); },
    rowHeight:      28,
    selectionUnit:  'cell',
    cellRenderer:   spreadsheetCellRenderer,
  };
  vm.ssGridApi = null;
  vm.ssStats = { activeCell: '\u2013', range: '\u2013', selectedCount: 0 };

  vm.onSsGridReady = function(api) {
    vm.ssGridApi = api;
  };

  $rootScope.$on('ugrid:selectionChanged', function(_, e) {
    if (vm.page === 'spreadsheet' && e.selectedRanges) {
      vm.ssStats.activeCell    = formatCoord(e.focusedCell);
      vm.ssStats.range         = formatRange(e.selectedRanges);
      vm.ssStats.selectedCount = countCellsInRanges(e.selectedRanges);
    }
  });

  $rootScope.$on('ugrid:activeCellChanged', function(_, e) {
    if (vm.page === 'spreadsheet') {
      vm.ssStats.activeCell = formatCoord(e.cell);
    }
  });

  vm.ssClearSelection = function() {
    if (vm.ssGridApi) vm.ssGridApi.deselectAll();
    vm.ssStats = { activeCell: '\u2013', range: '\u2013', selectedCount: 0 };
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  vm.isDark = prefersDark.matches;

  function applyTheme(dark) {
    document.body.classList.toggle('demo-dark',  dark);
    document.body.classList.toggle('demo-light', !dark);
    const ugrid = document.querySelector('.ugrid');
    if (ugrid) ugrid.classList.toggle('ugrid-theme-dark', dark);
    vm.themeIcon  = dark ? '☀️' : '🌙';
    vm.themeTitle = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  vm.toggleTheme = function() {
    vm.isDark = !vm.isDark;
    applyTheme(vm.isDark);
  };

  applyTheme(vm.isDark);
}]);

// The 'ultimateGrid' module import above calls angular.resumeBootstrap()
// automatically (because window.name was set to 'NG_DEFER_BOOTSTRAP!' in
// index.html), so ng-app="ugridDemo" on <html> handles bootstrapping.
