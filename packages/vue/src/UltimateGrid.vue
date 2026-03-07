<script setup lang="ts">
/**
 * @ultimate-grid/vue — Vue 3 wrapper component for @ultimate-grid/core.
 *
 * Usage:
 *   import { UltimateGrid } from '@ultimate-grid/vue';
 *
 *   <UltimateGrid
 *     :column-defs="columnDefs"
 *     :row-data="rowData"
 *     selection-mode="multi"
 *     :row-height="36"
 *     :cell-renderer="customCellRenderer"
 *     @grid-ready="onGridReady"
 *     @sort-changed="onSortChanged"
 *     @filter-changed="onFilterChanged"
 *     @selection-changed="onSelectionChanged"
 *   />
 */
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { createGrid } from '../../core/src/index.ts';
import type { RenderPipelineOptions } from '../../core/src/render/RenderPipeline.ts';
import type {
  ColumnDef,
  GridApi,
  GridOptions,
  GridEventMap,
} from '../../core/src/types.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    columnDefs: ColumnDef[];
    rowData?: unknown[];
    selectionMode?: GridOptions['selectionMode'];
    rowHeight?: number;
    cellRenderer?: RenderPipelineOptions['cellRenderer'];
    options?: Partial<GridOptions>;
  }>(),
  {
    selectionMode: 'multi',
  },
);

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  gridReady:        [api: GridApi];
  rowDataChanged:   [e: GridEventMap['rowDataChanged']];
  sortChanged:      [e: GridEventMap['sortChanged']];
  filterChanged:    [e: GridEventMap['filterChanged']];
  selectionChanged: [e: GridEventMap['selectionChanged']];
  columnResized:    [e: GridEventMap['columnResized']];
  columnMoved:      [e: GridEventMap['columnMoved']];
  cellClicked:      [e: GridEventMap['cellClicked']];
  cellDoubleClicked:[e: GridEventMap['cellDoubleClicked']];
  activeCellChanged: [e: GridEventMap['activeCellChanged']];
}>();

// ─── Internal state ────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null);
const apiRef        = ref<GridApi | null>(null);
let   unsubFns: Array<() => void> = [];

// ─── Mount / destroy helpers ──────────────────────────────────────────────────

function mountGrid(): void {
  if (!containerRef.value) return;

  unsubFns.forEach(fn => fn());
  unsubFns = [];
  if (apiRef.value) {
    apiRef.value.destroy();
    apiRef.value = null;
  }

  const api = createGrid({
    ...props.options,
    container:     containerRef.value,
    columnDefs:    props.columnDefs,
    rowData:       props.rowData ?? [],
    selectionMode: props.selectionMode ?? props.options?.selectionMode ?? 'multi',
    rowHeight:     props.rowHeight ?? props.options?.rowHeight,
    cellRenderer:  props.cellRenderer,
  });

  apiRef.value = api;

  unsubFns.push(
    api.on('rowDataChanged',    e => emit('rowDataChanged',   e)),
    api.on('sortChanged',       e => emit('sortChanged',      e)),
    api.on('filterChanged',     e => emit('filterChanged',    e)),
    api.on('selectionChanged',  e => emit('selectionChanged', e)),
    api.on('columnResized',     e => emit('columnResized',    e)),
    api.on('columnMoved',       e => emit('columnMoved',      e)),
    api.on('cellClicked',       e => emit('cellClicked',      e)),
    api.on('cellDoubleClicked', e => emit('cellDoubleClicked',e)),
    api.on('activeCellChanged',  e => emit('activeCellChanged', e)),
  );

  emit('gridReady', api);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => mountGrid());

// Remount when structural props change
watch(() => [props.columnDefs, props.selectionMode, props.rowHeight] as const, () => {
  mountGrid();
});

// Sync rowData without remounting
watch(() => props.rowData, (newVal) => {
  if (apiRef.value && newVal !== undefined) {
    apiRef.value.setRowData(newVal);
  }
});

onUnmounted(() => {
  unsubFns.forEach(fn => fn());
  unsubFns = [];
  apiRef.value?.destroy();
  apiRef.value = null;
});

// ─── Expose GridApi to parent ─────────────────────────────────────────────────

defineExpose({ api: apiRef });
</script>

<template>
  <div ref="containerRef" style="width: 100%; height: 100%;" />
</template>
