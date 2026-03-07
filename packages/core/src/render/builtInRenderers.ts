import type { Column, RowNode } from '../types';

// ─── Built-in cell renderer type ─────────────────────────────────────────────

export type CellRendererFn = (col: Column, node: RowNode, value: unknown) => HTMLElement | null;

// ─── Spreadsheet renderer ────────────────────────────────────────────────────

/**
 * Built-in cell renderer for spreadsheet mode.
 *
 * - Row-header columns (`rowHeader: true`) get plain text content.
 * - Numeric values get `font-variant-numeric: tabular-nums` for aligned columns.
 * - Everything else falls through to the default renderer (returns null).
 */
function spreadsheetCellRenderer(col: Column, _node: RowNode, value: unknown): HTMLElement | null {
  if (col.def.rowHeader) {
    const span = document.createElement('span');
    span.textContent = String(value);
    return span;
  }
  if (typeof value === 'number') {
    const span = document.createElement('span');
    span.style.fontVariantNumeric = 'tabular-nums';
    span.textContent = String(value);
    return span;
  }
  return null;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const BUILT_IN_RENDERERS: Record<string, CellRendererFn> = {
  spreadsheet: spreadsheetCellRenderer,
};

/**
 * Resolve a cellRenderer option that may be either a function or a built-in
 * name string (e.g. `'spreadsheet'`).  Returns the function, or undefined
 * if the name is not recognised.
 */
export function resolveCellRenderer(
  renderer: CellRendererFn | string | undefined,
): CellRendererFn | undefined {
  if (renderer === undefined) return undefined;
  if (typeof renderer === 'function') return renderer;
  return BUILT_IN_RENDERERS[renderer];
}
