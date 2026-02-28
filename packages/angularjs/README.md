# @ultimate-grid/angularjs

AngularJS (v1) wrapper for [Ultimate Data Grid](../../README.md).

## Installation

```bash
npm install @ultimate-grid/core @ultimate-grid/angularjs
# AngularJS itself via CDN or npm:
npm install angular
```

## Quick Start

### 1. Register the module

The wrapper supports both the classic `ng-app` attribute and manual `angular.bootstrap()`.

**Option A — `ng-app` (recommended, idiomatic AngularJS)**

Add one inline script *before* the AngularJS `<script>` tag to pause auto-bootstrap until the ES module has loaded and registered its modules:

```html
<!-- Pause ng-app until ES modules finish loading -->
<script>window.name = 'NG_DEFER_BOOTSTRAP!' + (window.name || '');</script>
<script src="angular.min.js"></script>

<html ng-app="myApp">
```

Then import the wrapper as an ES module — it will call `angular.resumeBootstrap()` automatically once `ultimateGrid` is registered:

```js
import '@ultimate-grid/angularjs'; // registers 'ultimateGrid' + resumes bootstrap
angular.module('myApp', ['ultimateGrid']);
```

**Option B — manual bootstrap**

Skip `ng-app` entirely and call `angular.bootstrap()` yourself at the end of your module script:

```js
import '@ultimate-grid/angularjs';
angular.module('myApp', ['ultimateGrid']).controller(/* ... */);
angular.bootstrap(document, ['myApp']);
```

### 2. Use the directive

```html
<ultimate-grid
  column-defs="vm.columnDefs"
  row-data="vm.rowData"
  options="vm.gridOptions"
  selection-mode="multi"
  on-grid-ready="vm.onGridReady(api)"
  api="vm.gridApi">
</ultimate-grid>
```

### 3. Controller

```js
angular.module('myApp').controller('MyCtrl', ['$scope', '$rootScope', function($scope, $rootScope) {
  const vm = this;

  vm.columnDefs = [
    { key: 'id',   field: 'id',   headerName: '#',    width: 60  },
    { key: 'name', field: 'name', headerName: 'Name', width: 200 },
  ];

  vm.rowData = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob'   },
  ];

  vm.gridOptions = {
    getRowId:  function(d) { return String(d.id); },
    rowHeight: 36,
  };

  vm.gridApi = null;

  vm.onGridReady = function(api) {
    vm.gridApi = api;
    // api is the full GridApi from @ultimate-grid/core
  };

  // Grid events are broadcast on $rootScope as 'ugrid:<eventName>'
  $rootScope.$on('ugrid:selectionChanged', function(_, e) {
    console.log('selected:', e.selectedRowIds);
  });
}]);
```

## Directive Attributes

| Attribute        | Type              | Description                                              |
|------------------|-------------------|----------------------------------------------------------|
| `column-defs`    | `ColumnDef[]`     | **Required.** Column definitions. Remounts on deep change. |
| `row-data`       | `TData[]`         | Row data array. Calls `setRowData()` on change (no remount). |
| `options`        | `Partial<GridOptions>` | Extra options merged into grid config.              |
| `selection-mode` | `string`          | `'single'` \| `'multi'` \| `'range'` \| `'none'`. Default `'multi'`. |
| `row-height`     | `string`          | Row height in pixels (e.g. `"36"`).                     |
| `on-grid-ready`  | expression        | Called with `api` after the grid mounts.                 |
| `api`            | two-way `=`       | Exposes the live `GridApi` to the parent scope.          |

## Events (via `$rootScope.$broadcast`)

All major grid events are forwarded as `ugrid:<eventName>`. The directive wraps every broadcast inside `$rootScope.$applyAsync()`, so **you do not need to call `$scope.$apply()` or `$applyAsync()` yourself** in your event handlers — Angular's digest cycle is triggered automatically:

```js
$rootScope.$on('ugrid:selectionChanged', function(_, e) {
  vm.selectedCount = e.selectedRowIds.length; // just assign — digest is handled
});
```

| Event                    | Payload                              |
|--------------------------|--------------------------------------|
| `ugrid:rowDataChanged`   | `{}`                                 |
| `ugrid:sortChanged`      | `{ sortState: SortState[] }`         |
| `ugrid:filterChanged`    | `{ filterState: FilterState }`       |
| `ugrid:selectionChanged` | `{ selectedRowIds: string[] }`       |
| `ugrid:columnResized`    | `{ colId, width, finished }`         |
| `ugrid:columnMoved`      | `{ colId, toIndex }`                 |
| `ugrid:cellClicked`      | `{ coord, rowNode, event }`          |
| `ugrid:cellDoubleClicked`| `{ coord, event }`                   |

## Running the demo

```bash
pnpm --filter @ultimate-grid/angularjs run demo
```

Starts Vite dev server at http://localhost:5174.
