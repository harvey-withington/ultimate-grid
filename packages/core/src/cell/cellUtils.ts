import type { CellCoord, CellRange, ColumnDef } from '../types';

// Re-export ColInfo so callers don't need to import it separately
export type { ColInfo };

/**
 * Minimal column shape needed by the formatting helpers.
 * Using a structural pick avoids generic-covariance issues when callers
 * pass `ColumnDef<SomeRow>[]` where `ColumnDef<unknown>[]` is expected.
 */
type ColInfo = Pick<ColumnDef, 'key' | 'rowHeader'>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Return true when `colId` belongs to a `rowHeader: true` column. */
function isRowHeader(colId: string, cols: ColInfo[] | undefined): boolean {
  if (!cols) return false;
  const def = cols.find(c => c.key === colId);
  return def?.rowHeader === true;
}

/** Return the first non-row-header column key, or the original colId. */
function firstDataCol(cols: ColInfo[] | undefined, fallback: string): string {
  if (!cols) return fallback;
  const col = cols.find(c => !c.rowHeader);
  return col ? col.key : fallback;
}

/** Return the last non-row-header column key, or the original colId. */
function lastDataCol(cols: ColInfo[] | undefined, fallback: string): string {
  if (!cols) return fallback;
  for (let i = cols.length - 1; i >= 0; i--) {
    if (!cols[i].rowHeader) return cols[i].key;
  }
  return fallback;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Format a cell coordinate as a string, e.g. `"B3"`.
 *
 * When `columnDefs` is provided and the coord sits on a `rowHeader` column
 * the display falls back to the row number only (e.g. `"3"` instead of
 * `"row3"`).
 *
 * Returns `'–'` (en-dash) when the coord is null.
 */
export function formatCellCoord(
  coord: CellCoord | null,
  columnDefs?: ColInfo[],
): string {
  if (!coord) return '\u2013';
  if (isRowHeader(coord.colId, columnDefs)) return coord.rowId;
  return `${coord.colId}${coord.rowId}`;
}

/**
 * Format an array of cell ranges as a human-readable string,
 * e.g. `"A1:C5"` or `"A1:C5, D2:D8"`.
 *
 * When `columnDefs` is provided, row-header columns are replaced by the
 * nearest data column so the output reads `"A7:H7"` instead of `"row7:H7"`.
 *
 * Returns `'–'` (en-dash) when the array is empty.
 */
export function formatCellRange(
  ranges: CellRange[],
  columnDefs?: ColInfo[],
): string {
  if (ranges.length === 0) return '\u2013';
  return ranges.map(r => {
    const sCol = isRowHeader(r.start.colId, columnDefs)
      ? firstDataCol(columnDefs, r.start.colId)
      : r.start.colId;
    const eCol = isRowHeader(r.end.colId, columnDefs)
      ? lastDataCol(columnDefs, r.end.colId)
      : r.end.colId;
    const s = `${sCol}${r.start.rowId}`;
    const e = `${eCol}${r.end.rowId}`;
    return s === e ? s : `${s}:${e}`;
  }).join(', ');
}

/**
 * Count the total number of cells across all given ranges.
 *
 * Uses the provided `columnDefs` (or their `key` values) to determine
 * column span. Row span is derived from numeric rowIds.
 *
 * If `columnDefs` is omitted, each range is counted as a single-column span.
 */
export function countCellsInRanges(ranges: CellRange[], columnDefs?: ColInfo[]): number {
  if (ranges.length === 0) return 0;
  let total = 0;
  for (const r of ranges) {
    const r1 = parseInt(r.start.rowId, 10);
    const r2 = parseInt(r.end.rowId, 10);
    const rowSpan = Math.abs(r2 - r1) + 1;

    let colSpan = 1;
    if (columnDefs) {
      const c1 = columnDefs.findIndex(c => c.key === r.start.colId);
      const c2 = columnDefs.findIndex(c => c.key === r.end.colId);
      if (c1 >= 0 && c2 >= 0) colSpan = Math.abs(c2 - c1) + 1;
    }
    total += rowSpan * colSpan;
  }
  return total;
}
