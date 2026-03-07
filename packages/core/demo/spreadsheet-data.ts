/**
 * Shared spreadsheet data and column definitions.
 * Used by the core demo and all framework wrapper demos.
 *
 * Formatting helpers (formatCellCoord, formatCellRange, countCellsInRanges)
 * are now part of the core library — import them from '../src/index' or
 * 'ultimate-grid'.
 */
import type { ColumnDef } from '../src/types';

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

