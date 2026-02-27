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

  // ─── Cell selection (stubs — full impl when unit=cell is needed) ───────────

  selectCell(coord: CellCoord, _extend = false): void {
    this._focusedCell = coord;
    this._anchorCell = coord;
  }

  selectRange(start: CellCoord, end: CellCoord): void {
    this._anchorCell = start;
    this._focusedCell = end;
    this.selectedRanges.splice(0, this.selectedRanges.length, { start, end });
  }

  isCellSelected(_coord: CellCoord): boolean { return false; }
  isCellInRange(_coord: CellCoord): boolean { return false; }

  setFocus(coord: CellCoord): void {
    this._focusedCell = coord;
  }

  moveFocus(direction: Direction): void {
    if (!this._focusedCell) return;
    // Keyboard nav — renderer wires this to arrow keys
    const rows = this._rowModel.displayRows;
    const curRow = rows.findIndex((r) => r.rowId === this._focusedCell!.rowId);
    if (curRow === -1) return;

    let nextIndex = curRow;
    if (direction === 'up')   nextIndex = Math.max(0, curRow - 1);
    if (direction === 'down') nextIndex = Math.min(rows.length - 1, curRow + 1);

    const nextRow = rows[nextIndex];
    if (nextRow) {
      this._focusedCell = { rowId: nextRow.rowId, colId: this._focusedCell.colId };
      this.selectRow(nextRow.rowId);
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private _emit(): void {
    this._bus.emit('selectionChanged', {
      type: 'selectionChanged',
      source: 'user',
      selectedRowIds: [...this.selectedRowIds],
    });
  }
}
