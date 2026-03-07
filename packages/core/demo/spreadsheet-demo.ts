import '../src/styles/ugrid.css';
import { createGrid } from '../src/createGrid';
import type { ColumnDef, GridApi } from '../src/types';
import { formatCellCoord, formatCellRange } from '../src/cell/cellUtils';

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
    cellRenderer: 'spreadsheet',
  });

  // ── Stats bar updates ────────────────────────────────────────────────────
  const elActiveCell     = document.getElementById('ss-active-cell')!;
  const elRange          = document.getElementById('ss-range')!;
  const elSelectedCount  = document.getElementById('ss-selected-count')!;

  _api.on('selectionChanged', () => {
    elActiveCell.textContent    = formatCellCoord(_api!.getActiveCell(), COLS);
    elRange.textContent         = formatCellRange(_api!.getSelectedRanges(), COLS);
    elSelectedCount.textContent = String(_api!.getSelectedCellCount());
  });

  _api.on('activeCellChanged', () => {
    elActiveCell.textContent = formatCellCoord(_api!.getActiveCell(), COLS);
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
