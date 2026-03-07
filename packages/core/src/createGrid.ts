import { GridCore } from './grid/GridCore';
import { SelectionModel } from './selection/SelectionModel';
import { RenderPipeline, type RenderPipelineOptions } from './render/RenderPipeline';
import type { GridOptions, GridApi } from './types';

// ─── createGrid options ───────────────────────────────────────────────────────

export interface CreateGridOptions<TData = unknown> extends GridOptions<TData> {
  /**
   * DOM element to mount the grid into. Its dimensions drive the visible
   * row window — make sure it has an explicit height (CSS or inline).
   */
  container: HTMLElement;

  /**
   * Optional custom cell renderer. Return an HTMLElement to override the
   * default text rendering for a cell, or null to use the default.
   */
  cellRenderer?: RenderPipelineOptions['cellRenderer'];
}

// ─── createGrid ───────────────────────────────────────────────────────────────

/**
 * Public entry point for the vanilla JS adapter.
 *
 * Usage:
 * ```ts
 * const api = createGrid({
 *   container: document.getElementById('grid')!,
 *   columnDefs: [...],
 *   rowData: [...],
 * });
 *
 * // later...
 * api.destroy();
 * ```
 *
 * Framework adapters (React, Vue, Svelte, Angular) call this under the hood
 * and wrap the returned api in their own reactivity / lifecycle layer.
 */
export function createGrid<TData = unknown>(
  opts: CreateGridOptions<TData>,
): GridApi<TData> {
  const { container, cellRenderer, onGridReady, ...gridOptions } = opts;

  // 1. Core engine
  const core = new GridCore<TData>(gridOptions);

  // 2. Selection model
  const sel = new SelectionModel(
    core.eventBus,
    core.rowModel,
    gridOptions.selectionMode ?? 'multi',
    gridOptions.selectionUnit ?? 'row',
    core.columnModel,
  );

  // 3. Render pipeline — only pass defined values so DEFAULTS apply correctly
  const pipelineOpts: RenderPipelineOptions = {};
  if (cellRenderer                          !== undefined) pipelineOpts.cellRenderer    = cellRenderer;
  if (gridOptions.rowHeight                 !== undefined) pipelineOpts.rowHeight       = gridOptions.rowHeight;
  if (gridOptions.headerHeight              !== undefined) pipelineOpts.headerHeight    = gridOptions.headerHeight;
  if (gridOptions.rowOverscan               !== undefined) pipelineOpts.overscan        = gridOptions.rowOverscan;

  const pipeline = new RenderPipeline<TData>(
    container,
    core.eventBus,
    core.columnModel,
    core.rowModel,
    sel,
    core.getApi(),
    pipelineOpts,
  );
  pipeline.mount();

  // 4. Augment the GridApi with a full destroy that tears down all layers
  const coreApi = core.getApi();
  const publicApi: GridApi<TData> = {
    ...coreApi,

    // Expose selection helpers through the standard GridApi surface
    selectAll:          () => sel.selectAll(),
    deselectAll:        () => sel.deselectAll(),
    getSelectedRowIds:  () => [...sel.selectedRowIds],
    getSelectedRows:    () => {
      const rows: TData[] = [];
      for (const id of sel.selectedRowIds) {
        const node = core.rowModel.getRowById(id);
        if (node?.data) rows.push(node.data);
      }
      return rows;
    },

    destroy() {
      pipeline.destroy();
      core.destroy();
    },
  };

  // Fire onGridReady if provided (called here, not in GridCore, so publicApi includes selection)
  onGridReady?.(publicApi);

  return publicApi;
}
