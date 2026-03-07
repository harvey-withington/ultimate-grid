import type {
  SelectionModel as ISelectionModel,
  SelectionMode,
  SelectionUnit,
  CellCoord,
  CellRange,
  Direction,
  EventBus as IEventBus,
  RowModel,
} from '../types';

/** Minimal column accessor — avoids coupling to the full generic ColumnModel<TData>. */
interface ColumnAccessor {
  readonly visible: ReadonlyArray<{ readonly colId: string; readonly def: { rowHeader?: boolean } }>;
}

/**
 * SelectionModel
 *
 * Manages row/cell selection state. Supports:
 *  - single, multi, range, and none modes
 *  - row-level and cell-level selection units
 *  - drag-select: a contiguous range of rows selected by dragging
 *    (mouse held + move, or two-finger touch drag)
 *  - Ctrl/Cmd+click adds to selection in multi mode
 *  - Shift+click extends range in multi/range mode
 *  - keyboard focus tracking
 *
 * Does NOT touch the DOM — that is the renderer's job.
 * Emits `selectionChanged` on every mutation.
 */
export class SelectionModel implements ISelectionModel {
  readonly mode: SelectionMode;
  readonly unit: SelectionUnit;

  readonly selectedRowIds = new Set<string>();
  readonly selectedRanges: CellRange[] = [];

  private _focusedCell: CellCoord | null = null;
  private _anchorCell: CellCoord | null = null;

  // Drag-select state
  private _dragAnchorIndex: number | null = null;
  private _dragCurrentIndex: number | null = null;
  private _dragPreSnapshot: Set<string> = new Set(); // selection before drag started
  private _dragDeselect = false; // true when dragging started on an already-selected row

  constructor(
    private readonly _bus: IEventBus,
    private readonly _rowModel: RowModel,
    mode: SelectionMode = 'multi',
    unit: SelectionUnit = 'row',
    private readonly _colModel?: ColumnAccessor,
  ) {
    this.mode = mode;
    this.unit = unit;
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  get focusedCell(): CellCoord | null { return this._focusedCell; }
  get anchorCell(): CellCoord | null { return this._anchorCell; }

  isRowSelected(rowId: string): boolean {
    return this.selectedRowIds.has(rowId);
  }

  // ─── Row selection ─────────────────────────────────────────────────────────

  selectRow(rowId: string, extend = false): void {
    if (this.mode === 'none') return;
    const node = this._rowModel.getRowById(rowId);
    if (!node || !node.selectable) return;

    if (this.mode === 'single' || !extend) {
      this.selectedRowIds.clear();
    }
    this.selectedRowIds.add(rowId);
    this._emit();
  }

  deselectRow(rowId: string): void {
    if (this.selectedRowIds.delete(rowId)) this._emit();
  }

  selectAll(): void {
    if (this.mode === 'none' || this.mode === 'single') return;
    for (const row of this._rowModel.displayRows) {
      if (row.selectable) this.selectedRowIds.add(row.rowId);
    }
    this._emit();
  }

  deselectAll(): void {
    if (this.selectedRowIds.size === 0) return;
    this.selectedRowIds.clear();
    this._emit();
  }

  // ─── Range selection (Shift+click or drag) ─────────────────────────────────

  /**
   * Select a contiguous range of display rows from `startIndex` to `endIndex`
   * (inclusive, order-independent). Replaces current selection unless
   * `extend` is true.
   */
  selectRowRange(startIndex: number, endIndex: number, extend = false): void {
    if (this.mode === 'none' || this.mode === 'single') return;

    const lo = Math.min(startIndex, endIndex);
    const hi = Math.max(startIndex, endIndex);
    const rows = this._rowModel.displayRows;

    if (!extend) this.selectedRowIds.clear();

    for (let i = lo; i <= hi; i++) {
      const row = rows[i];
      if (row?.selectable) this.selectedRowIds.add(row.rowId);
    }
    this._emit();
  }

  // ─── Drag-select ───────────────────────────────────────────────────────────

  /**
   * Called when a drag-select gesture begins (mousedown or two-finger touchstart).
   * @param displayIndex  The row index where the drag started.
   * @param extend        If true, add to existing selection (Ctrl held).
   */
  dragStart(displayIndex: number, extend = false): void {
    if (this.mode === 'none' || this.mode === 'single') return;
    this._dragAnchorIndex = displayIndex;
    this._dragCurrentIndex = displayIndex;
    // Snapshot selection BEFORE clearing so dragMove can restore it for extend=true
    this._dragPreSnapshot = new Set(this.selectedRowIds);
    const anchorRow = this._rowModel.getRowByDisplayIndex(displayIndex);
    // Deselect-drag: if the anchor row was already selected, dragging removes rows
    this._dragDeselect = extend && !!anchorRow && this.selectedRowIds.has(anchorRow.rowId);
    if (!extend) {
      this.selectedRowIds.clear();
      this._dragPreSnapshot.clear();
    }
    if (this._dragDeselect) {
      if (anchorRow) this.selectedRowIds.delete(anchorRow.rowId);
    } else {
      if (anchorRow?.selectable) this.selectedRowIds.add(anchorRow.rowId);
    }
    this._emit();
  }

  /**
   * Called as the pointer moves during a drag-select.
   * Extends selection from the anchor to the current index.
   */
  dragMove(displayIndex: number): void {
    if (this._dragAnchorIndex === null) return;
    if (displayIndex === this._dragCurrentIndex) return;
    this._dragCurrentIndex = displayIndex;

    // Recompute the drag range from scratch (don't accumulate)
    const anchor = this._dragAnchorIndex;
    const rows = this._rowModel.displayRows;
    const lo = Math.min(anchor, displayIndex);
    const hi = Math.max(anchor, displayIndex);

    // Start from pre-drag snapshot (so extend=true keeps prior selection)
    this.selectedRowIds.clear();
    for (const id of this._dragPreSnapshot) this.selectedRowIds.add(id);
    if (this._dragDeselect) {
      // Deselect-drag: remove all rows in the dragged range
      for (let i = lo; i <= hi; i++) {
        const row = rows[i];
        if (row) this.selectedRowIds.delete(row.rowId);
      }
    } else {
      // Select-drag: add all rows in the dragged range
      for (let i = lo; i <= hi; i++) {
        const row = rows[i];
        if (row?.selectable) this.selectedRowIds.add(row.rowId);
      }
    }
    this._emit();
  }

  /**
   * Called on mouseup / touchend to commit the drag selection.
   */
  dragEnd(): void {
    this._dragAnchorIndex = null;
    this._dragCurrentIndex = null;
    this._dragPreSnapshot = new Set();
    this._dragDeselect = false;
    // Selection is already committed — no emit needed
  }

  /** Whether a drag-select is currently in progress. */
  get isDragging(): boolean {
    return this._dragAnchorIndex !== null;
  }

  // ─── Cell selection ──────────────────────────────────────────────────────

  /**
   * Select a single cell. Sets both anchor and focused cell.
   * When extend=true (Ctrl+click), adds a new single-cell range.
   * When extend=false, replaces all cell ranges.
   */
  selectCell(coord: CellCoord, extend = false): void {
    if (this.mode === 'none') return;
    const prev = this._focusedCell;
    this._focusedCell = coord;
    this._anchorCell = coord;

    if (!extend || this.mode === 'single') {
      this.selectedRanges.splice(0, this.selectedRanges.length, { start: coord, end: coord });
    } else {
      this.selectedRanges.push({ start: coord, end: coord });
    }

    // In cell unit mode, also track the row as selected for backward compat
    if (this.unit === 'cell') {
      if (!extend) this.selectedRowIds.clear();
      this.selectedRowIds.add(coord.rowId);
    }

    this._emitActiveCellChanged(prev);
    this._emit();
  }

  /**
   * Select a rectangular cell range from start (anchor) to end (focus).
   * Replaces the last range in the array (Shift+click / Shift+arrow behaviour).
   */
  selectRange(start: CellCoord, end: CellCoord): void {
    if (this.mode === 'none') return;
    const prev = this._focusedCell;
    this._anchorCell = start;
    this._focusedCell = end;

    // Replace the last range (the "active" range) while keeping any Ctrl-added ranges
    if (this.selectedRanges.length > 0) {
      this.selectedRanges[this.selectedRanges.length - 1] = { start, end };
    } else {
      this.selectedRanges.push({ start, end });
    }

    this._emitActiveCellChanged(prev);
    this._emit();
  }

  /**
   * Check if a cell is the focused (active) cell.
   */
  isCellSelected(coord: CellCoord): boolean {
    return this._focusedCell !== null
      && this._focusedCell.rowId === coord.rowId
      && this._focusedCell.colId === coord.colId;
  }

  /**
   * Check if a cell falls within any selected range.
   * Resolves row/col positions via the row model and column model.
   */
  isCellInRange(coord: CellCoord): boolean {
    if (this.selectedRanges.length === 0) return false;
    const pos = this._toCellDisplayPos(coord);
    if (!pos) return false;

    for (const range of this.selectedRanges) {
      const s = this._toCellDisplayPos(range.start);
      const e = this._toCellDisplayPos(range.end);
      if (!s || !e) continue;

      const minRow = Math.min(s.row, e.row);
      const maxRow = Math.max(s.row, e.row);
      const minCol = Math.min(s.col, e.col);
      const maxCol = Math.max(s.col, e.col);

      if (pos.row >= minRow && pos.row <= maxRow && pos.col >= minCol && pos.col <= maxCol) {
        return true;
      }
    }
    return false;
  }

  setFocus(coord: CellCoord): void {
    const prev = this._focusedCell;
    this._focusedCell = coord;
    this._emitActiveCellChanged(prev);
  }

  /**
   * Select an entire row as a cell range spanning all visible columns.
   */
  selectEntireRow(rowId: string, extend = false): void {
    if (this.mode === 'none') return;
    const cols = this._colModel?.visible;
    if (!cols || cols.length === 0) return;
    const firstCol = cols[0].colId;
    const lastCol  = cols[cols.length - 1].colId;
    const start: CellCoord = { rowId, colId: firstCol };
    const end:   CellCoord = { rowId, colId: lastCol };

    // Focus the first non-rowHeader column (so active cell shows a valid reference)
    const focusCol = cols.find(c => !c.def?.rowHeader) ?? cols[0];
    const focusCoord: CellCoord = { rowId, colId: focusCol.colId };

    const prev = this._focusedCell;
    this._focusedCell = focusCoord;
    this._anchorCell  = focusCoord;

    if (!extend || this.mode === 'single') {
      this.selectedRanges.splice(0, this.selectedRanges.length, { start, end });
    } else {
      this.selectedRanges.push({ start, end });
    }

    this.selectedRowIds.add(rowId);
    this._emitActiveCellChanged(prev);
    this._emit();
  }

  /**
   * Select all cells: creates a single range from the first data column / first
   * row to the last data column / last row. Used by Ctrl+A and corner-cell click
   * in cell (spreadsheet) mode.
   */
  selectAllCells(): void {
    if (this.mode === 'none') return;
    const cols = this._colModel?.visible;
    const rows = this._rowModel.displayRows;
    if (!cols || cols.length === 0 || rows.length === 0) return;

    const firstDataCol = cols.find(c => !c.def?.rowHeader) ?? cols[0];
    const lastDataCol  = (() => {
      for (let i = cols.length - 1; i >= 0; i--) {
        if (!cols[i].def?.rowHeader) return cols[i];
      }
      return cols[cols.length - 1];
    })();

    const firstRowId = rows[0].rowId;
    const lastRowId  = rows[rows.length - 1].rowId;

    const start: CellCoord = { rowId: firstRowId, colId: firstDataCol.colId };
    const end:   CellCoord = { rowId: lastRowId,  colId: lastDataCol.colId };

    const prev = this._focusedCell;
    this._focusedCell = start;
    this._anchorCell  = start;

    this.selectedRanges.splice(0, this.selectedRanges.length, { start, end });

    // Mark all rows as selected for backward compat
    this.selectedRowIds.clear();
    for (const row of rows) {
      this.selectedRowIds.add(row.rowId);
    }

    this._emitActiveCellChanged(prev);
    this._emit();
  }

  /**
   * Select an entire column as a cell range spanning all visible rows.
   */
  selectEntireColumn(colId: string, extend = false): void {
    if (this.mode === 'none') return;
    const rows = this._rowModel.displayRows;
    if (rows.length === 0) return;
    const firstRowId = rows[0].rowId;
    const lastRowId  = rows[rows.length - 1].rowId;
    const start: CellCoord = { rowId: firstRowId, colId };
    const end:   CellCoord = { rowId: lastRowId,  colId };

    const prev = this._focusedCell;
    this._focusedCell = start;
    this._anchorCell  = start;

    if (!extend || this.mode === 'single') {
      this.selectedRanges.splice(0, this.selectedRanges.length, { start, end });
      this.selectedRowIds.clear();
    } else {
      this.selectedRanges.push({ start, end });
    }

    // Mark all rows as selected for backward compat
    for (const row of rows) {
      this.selectedRowIds.add(row.rowId);
    }

    this._emitActiveCellChanged(prev);
    this._emit();
  }

  /**
   * Move the focused cell in the given direction.
   * When extend=true (Shift held), the selection range extends from the anchor.
   * Otherwise the anchor moves with the focus (single-cell selection).
   */
  moveFocus(direction: Direction, extend = false): void {
    if (!this._focusedCell) return;
    const next = this._adjacentCell(this._focusedCell, direction);
    if (!next) return;

    const prev = this._focusedCell;
    this._focusedCell = next;

    if (extend && this._anchorCell) {
      // Extend the active range from anchor to new focus
      this.selectRange(this._anchorCell, next);

      // In row unit mode, also extend row selection from anchor to focus
      if (this.unit === 'row') {
        const rows = this._rowModel.displayRows;
        const anchorIdx = rows.findIndex(r => r.rowId === this._anchorCell!.rowId);
        const focusIdx  = rows.findIndex(r => r.rowId === next.rowId);
        if (anchorIdx !== -1 && focusIdx !== -1) {
          this.selectRowRange(anchorIdx, focusIdx);
        }
      }
    } else {
      // Move anchor with focus — single cell
      this._anchorCell = next;
      this.selectedRanges.splice(0, this.selectedRanges.length, { start: next, end: next });

      // In row unit mode, also update row selection
      if (this.unit === 'row') {
        this.selectedRowIds.clear();
        this.selectedRowIds.add(next.rowId);
      } else {
        this.selectedRowIds.clear();
        this.selectedRowIds.add(next.rowId);
      }

      this._emitActiveCellChanged(prev);
      this._emit();
    }
  }

  /**
   * Move the focused cell up or down by `count` rows.
   * Behaves like moveFocus but jumps multiple rows (e.g. for PageUp/PageDown).
   */
  moveFocusVertical(count: number, extend = false): void {
    if (!this._focusedCell) return;
    const rows = this._rowModel.displayRows;
    const curIdx = rows.findIndex(r => r.rowId === this._focusedCell!.rowId);
    if (curIdx === -1) return;

    const nextIdx = Math.max(0, Math.min(rows.length - 1, curIdx + count));
    if (nextIdx === curIdx) return;

    const next: CellCoord = { rowId: rows[nextIdx].rowId, colId: this._focusedCell.colId };
    const prev = this._focusedCell;
    this._focusedCell = next;

    if (extend && this._anchorCell) {
      this.selectRange(this._anchorCell, next);

      if (this.unit === 'row') {
        const anchorIdx = rows.findIndex(r => r.rowId === this._anchorCell!.rowId);
        if (anchorIdx !== -1) {
          this.selectRowRange(anchorIdx, nextIdx);
        }
      }
    } else {
      this._anchorCell = next;
      this.selectedRanges.splice(0, this.selectedRanges.length, { start: next, end: next });

      if (this.unit === 'row') {
        this.selectedRowIds.clear();
        this.selectedRowIds.add(next.rowId);
      } else {
        this.selectedRowIds.clear();
        this.selectedRowIds.add(next.rowId);
      }

      this._emitActiveCellChanged(prev);
      this._emit();
    }
  }

  // ─── Range geometry queries ────────────────────────────────────────────────

  /**
   * For a cell that is in-range, returns which edges of the selection rectangle
   * it sits on. Returns null if the cell is not in any range.
   */
  getCellRangeEdges(coord: CellCoord): { top: boolean; right: boolean; bottom: boolean; left: boolean } | null {
    if (this.selectedRanges.length === 0) return null;
    const pos = this._toCellDisplayPos(coord);
    if (!pos) return null;

    let inAnyRange = false;
    let top = false, right = false, bottom = false, left = false;

    for (const range of this.selectedRanges) {
      const s = this._toCellDisplayPos(range.start);
      const e = this._toCellDisplayPos(range.end);
      if (!s || !e) continue;

      const minRow = Math.min(s.row, e.row);
      const maxRow = Math.max(s.row, e.row);
      const minCol = Math.min(s.col, e.col);
      const maxCol = Math.max(s.col, e.col);

      if (pos.row >= minRow && pos.row <= maxRow && pos.col >= minCol && pos.col <= maxCol) {
        inAnyRange = true;
        if (pos.row === minRow) top    = true;
        if (pos.row === maxRow) bottom = true;
        if (pos.col === minCol) left   = true;
        if (pos.col === maxCol) right  = true;
      }
    }
    return inAnyRange ? { top, right, bottom, left } : null;
  }

  /**
   * Returns true if the given column intersects any selected range.
   */
  isColumnInRange(colId: string): boolean {
    if (this.selectedRanges.length === 0) return false;
    const cols = this._colModel?.visible;
    if (!cols) return false;
    const colIdx = cols.findIndex((c) => c.colId === colId);
    if (colIdx === -1) return false;

    for (const range of this.selectedRanges) {
      const s = this._toCellDisplayPos(range.start);
      const e = this._toCellDisplayPos(range.end);
      if (!s || !e) continue;
      const minCol = Math.min(s.col, e.col);
      const maxCol = Math.max(s.col, e.col);
      if (colIdx >= minCol && colIdx <= maxCol) return true;
    }
    return false;
  }

  /**
   * Returns true if the given row intersects any selected range.
   */
  isRowInRange(rowId: string): boolean {
    if (this.selectedRanges.length === 0) return false;
    const rows = this._rowModel.displayRows;
    const rowIdx = rows.findIndex((r) => r.rowId === rowId);
    if (rowIdx === -1) return false;

    for (const range of this.selectedRanges) {
      const s = this._toCellDisplayPos(range.start);
      const e = this._toCellDisplayPos(range.end);
      if (!s || !e) continue;
      const minRow = Math.min(s.row, e.row);
      const maxRow = Math.max(s.row, e.row);
      if (rowIdx >= minRow && rowIdx <= maxRow) return true;
    }
    return false;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private _emit(): void {
    this._bus.emit('selectionChanged', {
      type: 'selectionChanged',
      source: 'user',
      selectedRowIds: [...this.selectedRowIds],
      focusedCell: this._focusedCell,
      selectedRanges: [...this.selectedRanges],
    });
  }

  private _emitActiveCellChanged(previous: CellCoord | null): void {
    if (
      previous?.rowId === this._focusedCell?.rowId &&
      previous?.colId === this._focusedCell?.colId
    ) return;
    this._bus.emit('activeCellChanged', {
      type: 'activeCellChanged',
      source: 'user',
      cell: this._focusedCell,
      previous,
    });
  }

  /**
   * Resolve a CellCoord to numeric display positions { row, col }.
   * Returns null if the row or column can't be found.
   */
  private _toCellDisplayPos(coord: CellCoord): { row: number; col: number } | null {
    const rows = this._rowModel.displayRows;
    const rowIdx = rows.findIndex((r) => r.rowId === coord.rowId);
    if (rowIdx === -1) return null;

    const cols = this._colModel?.visible;
    if (!cols) return null;
    const colIdx = cols.findIndex((c) => c.colId === coord.colId);
    if (colIdx === -1) return null;

    return { row: rowIdx, col: colIdx };
  }

  /**
   * Get the adjacent cell in the given direction.
   * Returns null if at the boundary.
   */
  private _adjacentCell(from: CellCoord, direction: Direction): CellCoord | null {
    const rows = this._rowModel.displayRows;
    const curRowIdx = rows.findIndex((r) => r.rowId === from.rowId);
    if (curRowIdx === -1) return null;

    const cols = this._colModel?.visible;

    if (direction === 'up') {
      const nextIdx = Math.max(0, curRowIdx - 1);
      const nextRow = rows[nextIdx];
      return nextRow ? { rowId: nextRow.rowId, colId: from.colId } : null;
    }
    if (direction === 'down') {
      const nextIdx = Math.min(rows.length - 1, curRowIdx + 1);
      const nextRow = rows[nextIdx];
      return nextRow ? { rowId: nextRow.rowId, colId: from.colId } : null;
    }

    // Left / right require column model
    if (!cols) return null;
    const curColIdx = cols.findIndex((c) => c.colId === from.colId);
    if (curColIdx === -1) return null;

    if (direction === 'left') {
      let nextIdx = curColIdx - 1;
      // Skip row-header columns
      while (nextIdx >= 0 && cols[nextIdx].def?.rowHeader) nextIdx--;
      if (nextIdx < 0) return null;
      return { rowId: from.rowId, colId: cols[nextIdx].colId };
    }
    if (direction === 'right') {
      let nextIdx = curColIdx + 1;
      while (nextIdx < cols.length && cols[nextIdx].def?.rowHeader) nextIdx++;
      if (nextIdx >= cols.length) return null;
      return { rowId: from.rowId, colId: cols[nextIdx].colId };
    }

    return null;
  }
}
