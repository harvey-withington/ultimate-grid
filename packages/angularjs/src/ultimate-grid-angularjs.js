/**
 * @ultimate-grid/angularjs
 * AngularJS (v1) module and directive wrapping @ultimate-grid/core.
 *
 * Usage:
 *   angular.module('myApp', ['ultimateGrid'])
 *
 *   <ultimate-grid
 *     column-defs="vm.columnDefs"
 *     row-data="vm.rowData"
 *     options="vm.gridOptions"
 *     on-grid-ready="vm.onGridReady(api)"
 *     selection-mode="multi"
 *     row-height="36"
 *     api="vm.gridApi">
 *   </ultimate-grid>
 */

import { createGrid } from '../../core/src/index.ts';

// ─── Module definition ────────────────────────────────────────────────────────

const MODULE_NAME = 'ultimateGrid';

/* exported for UMD/CJS consumers who already have angular on window */
export { MODULE_NAME };

// ─── Directive ────────────────────────────────────────────────────────────────

function ultimateGridDirective() {
  return {
    restrict: 'E',
    scope: {
      columnDefs:    '=',           // ColumnDef[]  — required
      rowData:       '=',           // TData[]      — optional, watched
      options:       '=?',          // Partial<GridOptions> — optional bag
      onGridReady:   '&?',          // callback(api) fired after mount
      selectionMode: '@?',          // 'single'|'multi'|'range'|'none'
      rowHeight:     '@?',          // number string
      api:           '=?',          // two-way binding → exposes GridApi to parent
    },
    link: function link(scope, element) {
      // ── Container setup ──────────────────────────────────────────────────
      const container = element[0];
      container.style.display = 'block';
      container.style.width   = '100%';
      container.style.height  = '100%';

      let gridApi  = null;
      let unsubFns = [];

      // ── Build GridOptions from directive attrs + options bag ──────────────
      function buildOptions() {
        const extra  = scope.options  || {};
        const rowH   = scope.rowHeight ? Number(scope.rowHeight) : undefined;
        const selMode = scope.selectionMode || extra.selectionMode || 'multi';

        return Object.assign({}, extra, {
          container,
          columnDefs:    scope.columnDefs || [],
          rowData:       scope.rowData    || [],
          selectionMode: selMode,
          rowHeight:     rowH || extra.rowHeight,
        });
      }

      // ── Mount ─────────────────────────────────────────────────────────────
      function mount() {
        if (gridApi) {
          destroy();
        }

        const opts = buildOptions();
        gridApi = createGrid(opts);

        // Expose the api back to the parent scope
        if ('api' in scope) {
          scope.api = gridApi;
        }

        // Forward all grid events into $rootScope so Angular controllers can
        // listen with $scope.$on('ugrid:selectionChanged', ...) etc.
        const FORWARDED_EVENTS = [
          'rowDataChanged',
          'sortChanged',
          'filterChanged',
          'selectionChanged',
          'columnResized',
          'columnMoved',
          'cellClicked',
          'cellDoubleClicked',
        ];

        FORWARDED_EVENTS.forEach(function(evtName) {
          const off = gridApi.on(evtName, function(payload) {
            // $applyAsync schedules a digest on the next tick — safe to call
            // from native JS callbacks without triggering "$apply in progress".
            // This means consumers can update scope variables in $on handlers
            // without needing their own $scope.$apply() / $applyAsync() calls.
            scope.$root.$applyAsync(function() {
              scope.$root.$broadcast('ugrid:' + evtName, payload);
            });
          });
          unsubFns.push(off);
        });

        // Fire onGridReady callback
        if (scope.onGridReady) {
          scope.$evalAsync(function() {
            scope.onGridReady({ api: gridApi });
          });
        }
      }

      // ── Destroy ───────────────────────────────────────────────────────────
      function destroy() {
        unsubFns.forEach(function(fn) { fn(); });
        unsubFns = [];
        if (gridApi) {
          gridApi.destroy();
          gridApi = null;
        }
      }

      // ── Watch rowData: push updates without re-mounting ───────────────────
      scope.$watch('rowData', function(newVal, oldVal) {
        if (!gridApi) return;
        if (newVal === oldVal) return;
        gridApi.setRowData(newVal || []);
      });

      // ── Watch columnDefs: full remount on structural change ───────────────
      scope.$watch('columnDefs', function(newVal, oldVal) {
        if (newVal === oldVal) return;
        mount();
      }, /* deep */ true);

      // ── Initial mount ─────────────────────────────────────────────────────
      mount();

      // ── Cleanup on scope destroy ──────────────────────────────────────────
      scope.$on('$destroy', function() {
        destroy();
      });
    },
  };
}

// ─── Register module ──────────────────────────────────────────────────────────

// Support both AngularJS on window (CDN) and modular imports.
const angular = (typeof window !== 'undefined' && window.angular) ? window.angular : null;

if (angular) {
  angular.module(MODULE_NAME, []).directive('ultimateGrid', ultimateGridDirective);

  // ── ng-app / deferred bootstrap support ─────────────────────────────────
  //
  // If the user set window.name = "NG_DEFER_BOOTSTRAP!" before loading
  // AngularJS (which pauses ng-app auto-bootstrap), we resume it now that
  // the ultimateGrid module is registered.
  //
  // This lets users write plain <html ng-app="myApp"> and just add this
  // one line before the AngularJS <script> tag:
  //   <script>window.name = "NG_DEFER_BOOTSTRAP!";</script>
  //
  if (typeof window !== 'undefined' &&
      typeof window.name === 'string' &&
      window.name.indexOf('NG_DEFER_BOOTSTRAP!') !== -1) {
    // Remove the flag so normal page reloads work correctly.
    window.name = window.name.replace('NG_DEFER_BOOTSTRAP!', '').trim();
    // Let any user modules registered in the same micro-task finish first.
    // Guard: resumeBootstrap only exists when AngularJS was actually paused.
    Promise.resolve().then(function() {
      if (typeof angular.resumeBootstrap === 'function') {
        angular.resumeBootstrap();
      }
    });
  }
}

// Also export the factory for manual registration in bundled environments
export { ultimateGridDirective };

export default MODULE_NAME;
