import { FenwickTree } from './FenwickTree';
import type { CellCoord, VisibleRange, Viewport, VirtualScrollEngine as IVirtualScrollEngine } from '../types';

/**
 * VirtualScrollEngine
 *
 * Translates scroll position → visible row/column ranges.
 * Uses FenwickTree for O(log n) row-height prefix sums (variable row heights).
 * Uses a simple prefix-sum array for column widths (columns change infrequently).
 *
 * Row indexing: 0-based displayIndex (matches RowNode.displayIndex).
 * Column indexing: 0-based index into ColumnModel.visible center columns.
 */
export class VirtualScrollEngine implements IVirtualScrollEngine {
  // ─── Row state ─────────────────────────────────────────────────────────────
  private rowTree!: FenwickTree;
  private rowHeights!: Float64Array;   // mirror of individual heights for delta calc
  private rowCount = 0;

  // ─── Column state ──────────────────────────────────────────────────────────
  private colWidths: number[] = [];
  private colOffsets: number[] = [];   // prefix sum, rebuilt on change
  private colCount = 0;
  private colDirty = false;

  // ─── Viewport state ────────────────────────────────────────────────────────
  private container: HTMLElement | null = null;
  private scrollTop = 0;
  private scrollLeft = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private rowOverscan = 3;
  private colOverscan = 2;

  // ─── Cached visible ranges ─────────────────────────────────────────────────
  private _visibleRowRange: VisibleRange = { start: 0, end: -1 };
  private _visibleColRange: VisibleRange = { start: 0, end: -1 };

  // ─── Initialisation ────────────────────────────────────────────────────────

  /**
   * Must be called before any other method.
   * Reads initial viewport dimensions from `viewport` and attaches a scroll
   * listener to `container` (the ugrid-body scroll element).
   */
  init(container: HTMLElement, viewport: Viewport): void {
    this.container = container;
    this.viewportWidth = viewport.width;
    this.viewportHeight = viewport.height;
    this.scrollTop = viewport.scrollTop;
    this.scrollLeft = viewport.scrollLeft;
    this.rowOverscan = viewport.rowOverscan ?? 3;
    this.colOverscan = viewport.colOverscan ?? 2;

    // Attach scroll handler
    container.addEventListener('scroll', this._onContainerScroll, { passive: true });
  }

  private _onContainerScroll = (): void => {
    if (!this.container) return;
    this.onScroll(this.container.scrollTop, this.container.scrollLeft);
  };

  // ─── Row height index ──────────────────────────────────────────────────────

  /**
   * (Re)initialises the row height structures for `count` rows, setting every
   * row to `defaultHeight`. Call this when RowModel is first populated or fully
   * replaced. For incremental updates use `setRowHeight`.
   */
  initRows(count: number, defaultHeight: number): void {
    this.rowCount = count;
    this.rowTree = new FenwickTree(count);
    this.rowHeights = new Float64Array(count).fill(defaultHeight);
    for (let i = 0; i < count; i++) {
      this.rowTree.update(i, defaultHeight);
    }
    this._recalcVisibleRows();
  }

  /**
   * Updates the height of the row at `displayIndex`.
   * Computes delta so the FenwickTree stays consistent.
   * O(log n)
   */
  setRowHeight(displayIndex: number, height: number): void {
    if (displayIndex < 0 || displayIndex >= this.rowCount) return;
    const prev = this.rowHeights[displayIndex];
    const delta = height - prev;
    if (delta === 0) return;
    this.rowHeights[displayIndex] = height;
    this.rowTree.update(displayIndex, delta);
    this._recalcVisibleRows();
  }

  /**
   * Returns the pixel Y offset of the top edge of the row at `displayIndex`.
   * O(log n)
   */
  getRowOffset(displayIndex: number): number {
    if (displayIndex <= 0) return 0;
    return this.rowTree.query(displayIndex - 1);
  }

  /**
   * Returns the displayIndex of the row that contains pixel offset `y`.
   * Clamps to [0, rowCount - 1].
   * O(log n)
   */
  getRowAtOffset(y: number): number {
    if (this.rowCount === 0) return 0;
    if (y <= 0) return 0;
    const total = this.rowTree.queryAll();
    if (y >= total) return Math.max(0, this.rowCount - 1);
    // findFirst returns the 0-based index where prefix sum first >= y+1
    // We want the row whose range [offset, offset+height) contains y.
    const idx = this.rowTree.findFirst(y + 1);
    return Math.min(idx, this.rowCount - 1);
  }

  /**
   * Returns the total pixel height of all rows.
   * O(log n)
   */
  getTotalHeight(): number {
    if (this.rowCount === 0) return 0;
    return this.rowTree.queryAll();
  }

  // ─── Column width index ────────────────────────────────────────────────────

  /**
   * (Re)initialises column tracking with an array of widths.
   * O(n)
   */
  initColumns(widths: number[]): void {
    this.colWidths = [...widths];
    this.colCount = widths.length;
    this._rebuildColOffsets();
    this._recalcVisibleCols();
  }

  /**
   * Updates the width of the column at `colIndex`.
   * Marks offsets dirty — lazily rebuilt on next read.
   * O(1) mark, O(n) rebuild.
   */
  setColumnWidth(colIndex: number, width: number): void {
    if (colIndex < 0 || colIndex >= this.colCount) return;
    if (this.colWidths[colIndex] === width) return;
    this.colWidths[colIndex] = width;
    this.colDirty = true;
    this._recalcVisibleCols();
  }

  /**
   * Returns the pixel X offset of the left edge of the column at `colIndex`.
   * O(1) (after lazy rebuild)
   */
  getColumnOffset(colIndex: number): number {
    this._ensureColOffsets();
    if (colIndex <= 0) return 0;
    if (colIndex >= this.colCount) return this.colOffsets[this.colCount];
    return this.colOffsets[colIndex];
  }

  /**
   * Returns the colIndex of the column that contains pixel offset `x`.
   * O(log n) binary search.
   */
  getColumnAtOffset(x: number): number {
    if (this.colCount === 0) return 0;
    this._ensureColOffsets();
    if (x <= 0) return 0;
    const total = this.colOffsets[this.colCount];
    if (x >= total) return Math.max(0, this.colCount - 1);

    // Binary search over prefix-sum array
    let lo = 0;
    let hi = this.colCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.colOffsets[mid + 1] <= x) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /**
   * Returns the total pixel width of all center columns.
   * O(1)
   */
  getTotalWidth(): number {
    this._ensureColOffsets();
    return this.colCount > 0 ? this.colOffsets[this.colCount] : 0;
  }

  // ─── Scroll handling ───────────────────────────────────────────────────────

  onScroll(scrollTop: number, scrollLeft: number): void {
    const rowChanged = scrollTop !== this.scrollTop;
    const colChanged = scrollLeft !== this.scrollLeft;
    this.scrollTop = scrollTop;
    this.scrollLeft = scrollLeft;
    if (rowChanged) this._recalcVisibleRows();
    if (colChanged) this._recalcVisibleCols();
  }

  scrollToRow(displayIndex: number, position: 'top' | 'middle' | 'bottom' = 'top'): void {
    if (!this.container || this.rowCount === 0) return;
    const idx = Math.max(0, Math.min(displayIndex, this.rowCount - 1));
    const rowTop = this.getRowOffset(idx);
    const rowHeight = this.rowHeights[idx];
    let target: number;
    switch (position) {
      case 'middle':
        target = rowTop - (this.viewportHeight - rowHeight) / 2;
        break;
      case 'bottom':
        target = rowTop - this.viewportHeight + rowHeight;
        break;
      default:
        target = rowTop;
    }
    this.container.scrollTop = Math.max(0, target);
  }

  scrollToColumn(colIndex: number): void {
    if (!this.container || this.colCount === 0) return;
    const idx = Math.max(0, Math.min(colIndex, this.colCount - 1));
    const colLeft = this.getColumnOffset(idx);
    const colWidth = this.colWidths[idx];
    const { scrollLeft, viewportWidth } = this;

    if (colLeft < scrollLeft) {
      this.container.scrollLeft = colLeft;
    } else if (colLeft + colWidth > scrollLeft + viewportWidth) {
      this.container.scrollLeft = colLeft + colWidth - viewportWidth;
    }
  }

  scrollToCell(_coord: CellCoord): void {
    // Resolved externally by CoordResolver → displayIndex / colIndex, then:
    // scrollToRow + scrollToColumn. CoordResolver not available here — callers
    // should resolve coords and call scrollToRow/scrollToColumn directly.
    // This method is a convenience stub for the interface contract.
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  recalculate(): void {
    if (this.container) {
      this.viewportWidth = this.container.clientWidth;
      this.viewportHeight = this.container.clientHeight;
    }
    this._recalcVisibleRows();
    this._recalcVisibleCols();
  }

  // ─── Visible range accessors ───────────────────────────────────────────────

  getVisibleRowRange(): VisibleRange {
    return { ...this._visibleRowRange };
  }

  getVisibleColRange(): VisibleRange {
    return { ...this._visibleColRange };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _recalcVisibleRows(): void {
    if (this.rowCount === 0) {
      this._visibleRowRange = { start: 0, end: -1 };
      return;
    }
    const startRow = this.getRowAtOffset(this.scrollTop);
    const endRow = this.getRowAtOffset(this.scrollTop + this.viewportHeight);

    this._visibleRowRange = {
      start: Math.max(0, startRow - this.rowOverscan),
      end: Math.min(this.rowCount - 1, endRow + this.rowOverscan),
    };
  }

  private _recalcVisibleCols(): void {
    if (this.colCount === 0) {
      this._visibleColRange = { start: 0, end: -1 };
      return;
    }
    const startCol = this.getColumnAtOffset(this.scrollLeft);
    const endCol = this.getColumnAtOffset(this.scrollLeft + this.viewportWidth);

    this._visibleColRange = {
      start: Math.max(0, startCol - this.colOverscan),
      end: Math.min(this.colCount - 1, endCol + this.colOverscan),
    };
  }

  private _ensureColOffsets(): void {
    if (!this.colDirty && this.colOffsets.length === this.colCount + 1) return;
    this._rebuildColOffsets();
  }

  private _rebuildColOffsets(): void {
    const offsets = new Array<number>(this.colCount + 1);
    offsets[0] = 0;
    for (let i = 0; i < this.colCount; i++) {
      offsets[i + 1] = offsets[i] + this.colWidths[i];
    }
    this.colOffsets = offsets;
    this.colDirty = false;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.container) {
      this.container.removeEventListener('scroll', this._onContainerScroll);
      this.container = null;
    }
  }
}
