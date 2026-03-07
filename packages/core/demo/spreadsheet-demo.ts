import '../src/styles/ugrid.css';
import { createGrid } from '../src/createGrid';
import type { Column, ColumnDef, RowNode, GridApi, CellCoord, CellRange } from '../src/types';

// ─── Spreadsheet-style data ──────────────────────────────────────────────────

interface SpreadsheetRow {
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

function generateSpreadsheetData(rows: number): SpreadsheetRow[] {
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

// ─── Column defs — spreadsheet style A–H ─────────────────────────────────────

const COLS: ColumnDef<SpreadsheetRow>[] = [
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

// ─── Cell renderer — row header column gets special styling ──────────────────

function spreadsheetCellRenderer(col: Column, _node: RowNode, value: unknown): HTMLElement | null {
  if (col.def.rowHeader) {
    // Just return the content; the outer cell gets ugrid-cell--row-header from RenderPipeline
    const span = document.createElement('span');
    span.textContent = String(value);
    return span;
  }
  // Numbers get right-aligned tabular styling
  if (typeof value === 'number') {
    const span = document.createElement('span');
    span.style.fontVariantNumeric = 'tabular-nums';
    span.textContent = String(value);
    return span;
  }
  return null; // default rendering
}

// ─── State ───────────────────────────────────────────────────────────────────

let _api: GridApi<SpreadsheetRow> | null = null;
let _mounted = false;

// ─── Mount / Unmount ─────────────────────────────────────────────────────────

export function mount(): void {
  if (_mounted) return;
  _mounted = true;

  const container = document.getElementById('ss-grid-container')!;
  container.style.height = '100%';

  _api = createGrid<SpreadsheetRow>({
    container,
    columnDefs: COLS,
    rowData: generateSpreadsheetData(200),
    getRowId: (d) => String(d.row),
    rowHeight: 28,
    selectionMode: 'multi',
    selectionUnit: 'cell',
    cellRenderer: spreadsheetCellRenderer,
  });

  // ── Stats bar updates ────────────────────────────────────────────────────
  const elActiveCell     = document.getElementById('ss-active-cell')!;
  const elRange          = document.getElementById('ss-range')!;
  const elSelectedCount  = document.getElementById('ss-selected-count')!;

  function formatCoord(c: CellCoord | null): string {
    if (!c) return '–';
    return `${c.colId}${c.rowId}`;
  }

  function formatRange(ranges: CellRange[]): string {
    if (ranges.length === 0) return '–';
    return ranges.map(r => {
      const s = `${r.start.colId}${r.start.rowId}`;
      const e = `${r.end.colId}${r.end.rowId}`;
      return s === e ? s : `${s}:${e}`;
    }).join(', ');
  }

  function countCellsInRanges(ranges: CellRange[]): number {
    if (ranges.length === 0) return 0;
    let total = 0;
    for (const r of ranges) {
      const r1 = parseInt(r.start.rowId, 10);
      const r2 = parseInt(r.end.rowId, 10);
      const rowSpan = Math.abs(r2 - r1) + 1;
      const c1 = COLS.findIndex(c => c.key === r.start.colId);
      const c2 = COLS.findIndex(c => c.key === r.end.colId);
      const colSpan = c1 >= 0 && c2 >= 0 ? Math.abs(c2 - c1) + 1 : 1;
      total += rowSpan * colSpan;
    }
    return total;
  }

  _api.on('selectionChanged', (e) => {
    elActiveCell.textContent    = formatCoord(e.focusedCell);
    elRange.textContent         = formatRange(e.selectedRanges);
    elSelectedCount.textContent = String(countCellsInRanges(e.selectedRanges));
  });

  _api.on('activeCellChanged', (e) => {
    elActiveCell.textContent = formatCoord(e.cell);
  });

  // ── Clear selection button ───────────────────────────────────────────────
  document.getElementById('ss-btn-deselect')!.addEventListener('click', () => {
    _api?.deselectAll();
    elActiveCell.textContent    = '–';
    elRange.textContent         = '–';
    elSelectedCount.textContent = '0';
  });
}

export function unmount(): void {
  if (!_mounted) return;
  _mounted = false;
  if (_api) {
    _api.destroy();
    _api = null;
  }
  const container = document.getElementById('ss-grid-container');
  if (container) container.innerHTML = '';
}
