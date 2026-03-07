/**
 * Shared spreadsheet data, column definitions, and helpers.
 * Used by the core demo and all framework wrapper demos.
 */
import type { ColumnDef, Column, RowNode, CellCoord, CellRange } from '../src/types';

// ─── Spreadsheet row type ────────────────────────────────────────────────────

export interface SpreadsheetRow {
  row: number;
  A: string | number;
  B: string | number;
  C: string | number;
  D: string | number;
  E: string | number;
  F: string | number;
  G: string | number;
  H: string | number;
}

// ─── Data generator ──────────────────────────────────────────────────────────

export function generateSpreadsheetData(rows: number): SpreadsheetRow[] {
  const categories = ['Revenue', 'Costs', 'Margin', 'Headcount', 'Churn %', 'NPS', 'MRR', 'ARR'];
  const data: SpreadsheetRow[] = [];
  for (let i = 0; i < rows; i++) {
    data.push({
      row: i + 1,
      A: categories[i % categories.length],
      B: Math.round(1000 + Math.random() * 9000),
      C: Math.round(1000 + Math.random() * 9000),
      D: Math.round(1000 + Math.random() * 9000),
      E: Math.round(100 + Math.random() * 900) / 10,
      F: Math.round(100 + Math.random() * 900) / 10,
      G: Math.round(10000 + Math.random() * 90000),
      H: Math.round(10000 + Math.random() * 90000),
    });
  }
  return data;
}

// ─── Column definitions ──────────────────────────────────────────────────────

export const SS_COLS: ColumnDef<SpreadsheetRow>[] = [
  { key: 'row', field: 'row', headerName: '',  width: 50, rowHeader: true, sortable: false },
  { key: 'A',   field: 'A',   headerName: 'A', width: 120 },
  { key: 'B',   field: 'B',   headerName: 'B', width: 100 },
  { key: 'C',   field: 'C',   headerName: 'C', width: 100 },
  { key: 'D',   field: 'D',   headerName: 'D', width: 100 },
  { key: 'E',   field: 'E',   headerName: 'E', width: 100 },
  { key: 'F',   field: 'F',   headerName: 'F', width: 100 },
  { key: 'G',   field: 'G',   headerName: 'G', width: 120 },
  { key: 'H',   field: 'H',   headerName: 'H', width: 120 },
];

// ─── Cell renderer ───────────────────────────────────────────────────────────

export function spreadsheetCellRenderer(col: Column, _node: RowNode, value: unknown): HTMLElement | null {
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

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatCoord(c: CellCoord | null): string {
  if (!c) return '\u2013';
  return `${c.colId}${c.rowId}`;
}

export function formatRange(ranges: CellRange[]): string {
  if (ranges.length === 0) return '\u2013';
  return ranges.map(r => {
    const s = `${r.start.colId}${r.start.rowId}`;
    const e = `${r.end.colId}${r.end.rowId}`;
    return s === e ? s : `${s}:${e}`;
  }).join(', ');
}

export function countCellsInRanges(ranges: CellRange[]): number {
  if (ranges.length === 0) return 0;
  let total = 0;
  for (const r of ranges) {
    const r1 = parseInt(r.start.rowId, 10);
    const r2 = parseInt(r.end.rowId, 10);
    const rowSpan = Math.abs(r2 - r1) + 1;
    const c1 = SS_COLS.findIndex(c => c.key === r.start.colId);
    const c2 = SS_COLS.findIndex(c => c.key === r.end.colId);
    const colSpan = c1 >= 0 && c2 >= 0 ? Math.abs(c2 - c1) + 1 : 1;
    total += rowSpan * colSpan;
  }
  return total;
}
