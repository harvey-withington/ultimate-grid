<!--
  @ultimate-grid/svelte
  Svelte 4 wrapper component for @ultimate-grid/core.

  Usage:
    import UltimateGrid from '@ultimate-grid/svelte';

    <UltimateGrid
      columnDefs={columnDefs}
      rowData={rowData}
      selectionMode="multi"
      rowHeight={36}
      cellRenderer={customCellRenderer}
      onGridReady={(api) => gridApi = api}
      onSortChanged={handleSortChanged}
      onFilterChanged={handleFilterChanged}
      onSelectionChanged={handleSelectionChanged}
    />
-->

<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { createGrid } from '../../core/src/index.ts';
  import type { RenderPipelineOptions } from '../../core/src/render/RenderPipeline.ts';
  import type {
    ColumnDef,
    GridApi,
    GridOptions,
    GridEventMap,
  } from '../../core/src/types.ts';

  // ─── Props ──────────────────────────────────────────────────────────────────

  export let columnDefs:    ColumnDef[]                                   = [];
  export let rowData:       unknown[]                        | undefined   = undefined;
  export let selectionMode: GridOptions['selectionMode']                   = 'multi';
  export let rowHeight:     number                           | undefined   = undefined;
  export let cellRenderer:  RenderPipelineOptions['cellRenderer'] | undefined = undefined;
  export let options:       Partial<GridOptions>             | undefined   = undefined;

  // ─── Event callbacks ────────────────────────────────────────────────────────

  export let onGridReady:        ((api: GridApi) => void)                               | undefined = undefined;
  export let onRowDataChanged:   ((e: GridEventMap['rowDataChanged'])   => void)        | undefined = undefined;
  export let onSortChanged:      ((e: GridEventMap['sortChanged'])      => void)        | undefined = undefined;
  export let onFilterChanged:    ((e: GridEventMap['filterChanged'])    => void)        | undefined = undefined;
  export let onSelectionChanged: ((e: GridEventMap['selectionChanged']) => void)        | undefined = undefined;
  export let onColumnResized:    ((e: GridEventMap['columnResized'])    => void)        | undefined = undefined;
  export let onColumnMoved:      ((e: GridEventMap['columnMoved'])      => void)        | undefined = undefined;
  export let onCellClicked:      ((e: GridEventMap['cellClicked'])      => void)        | undefined = undefined;
  export let onCellDoubleClicked:((e: GridEventMap['cellDoubleClicked'])=> void)        | undefined = undefined;

  // ─── Internal ───────────────────────────────────────────────────────────────

  let containerEl: HTMLDivElement;
  let gridApi: GridApi | null = null;
  let unsubFns: Array<() => void> = [];

  // Track keys for deciding when to remount vs. setRowData
  let _colKey    = '';
  let _rowData   = rowData;

  function getColKey(): string {
    return columnDefs.map(c => c.key).join(',') + ':' + selectionMode + ':' + (rowHeight ?? '');
  }

  function mountGrid(): void {
    if (!containerEl) return;

    unsubFns.forEach(fn => fn());
    unsubFns = [];
    if (gridApi) {
      gridApi.destroy();
      gridApi = null;
    }

    gridApi = createGrid({
      ...options,
      container:     containerEl,
      columnDefs,
      rowData:       rowData ?? [],
      selectionMode: selectionMode ?? options?.selectionMode ?? 'multi',
      rowHeight:     rowHeight ?? options?.rowHeight,
      cellRenderer,
    });

    unsubFns.push(
      gridApi.on('rowDataChanged',    e => onRowDataChanged?.(e)),
      gridApi.on('sortChanged',       e => onSortChanged?.(e)),
      gridApi.on('filterChanged',     e => onFilterChanged?.(e)),
      gridApi.on('selectionChanged',  e => onSelectionChanged?.(e)),
      gridApi.on('columnResized',     e => onColumnResized?.(e)),
      gridApi.on('columnMoved',       e => onColumnMoved?.(e)),
      gridApi.on('cellClicked',       e => onCellClicked?.(e)),
      gridApi.on('cellDoubleClicked', e => onCellDoubleClicked?.(e)),
    );

    onGridReady?.(gridApi);
    _colKey  = getColKey();
    _rowData = rowData;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  onMount(() => {
    _colKey  = getColKey();
    _rowData = rowData;
    mountGrid();
  });

  afterUpdate(() => {
    const newColKey = getColKey();
    if (newColKey !== _colKey) {
      // Structural change — remount
      _colKey  = newColKey;
      _rowData = rowData;
      mountGrid();
    } else if (gridApi && rowData !== _rowData) {
      // Data-only change — sync without remount
      _rowData = rowData;
      if (rowData !== undefined) {
        gridApi.setRowData(rowData);
      }
    }
  });

  onDestroy(() => {
    unsubFns.forEach(fn => fn());
    unsubFns = [];
    gridApi?.destroy();
    gridApi = null;
  });
</script>

<div bind:this={containerEl} style="width: 100%; height: 100%;" />
