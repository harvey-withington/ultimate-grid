import type {
  Column,
  ColumnDef,
  RowNode,
  GridApi,
  SortState,
  EventBus as IEventBus,
} from '../types';
import type { ColumnModel } from '../column/ColumnModel';
import { parseFilterExpression } from '../filter/parseFilterExpression';
import type { ClientRowModel } from '../row/ClientRowModel';
import type { SelectionModel } from '../selection/SelectionModel';

// ─── Public options ────────────────────────────────────────────────────────────

export interface RenderPipelineOptions {
  rowHeight?: number;
  headerHeight?: number;
  filterRowHeight?: number;
  overscan?: number;
  /** Called to render custom cell content. Return null to use default. */
  cellRenderer?: (col: Column, node: RowNode, value: unknown) => HTMLElement | null;
}

const DEFAULTS: Required<Omit<RenderPipelineOptions, 'cellRenderer'>> = {
  rowHeight: 36,
  headerHeight: 36,
  filterRowHeight: 32,
  overscan: 5,
};

// ─── RenderPipeline ────────────────────────────────────────────────────────────

/**
 * RenderPipeline
 *
 * Owns the full DOM structure of the grid and keeps it in sync with model state.
 * Framework adapters (React, Vue, etc.) replace this with their own reconciler;
 * the vanilla JS adapter uses RenderPipeline directly.
 *
 * DOM structure produced:
 *
 *   .ugrid
 *     .ugrid-header
 *       .ugrid-header-cell  (×n)
 *     .ugrid-filter-row
 *       .ugrid-filter-cell  (×n)
 *     .ugrid-body                  ← overflow:auto, drives scrollbar
 *       .ugrid-spacer              ← height = totalRows × rowHeight
 *         .ugrid-rows              ← position:absolute, top = startIdx × rowHeight
 *           .ugrid-row             (×visible window)
 *             .ugrid-cell          (×n cols)
 */
export class RenderPipeline<TData = unknown> {
  private readonly _opts: Required<Omit<RenderPipelineOptions, 'cellRenderer'>>;
  private readonly _cellRenderer?: RenderPipelineOptions['cellRenderer'];

  // DOM refs
  private _root!: HTMLElement;
  private _header!: HTMLElement;
  private _filterRow!: HTMLElement;
  private _body!: HTMLElement;
  private _spacer!: HTMLElement;
  private _rowsEl!: HTMLElement;

  // Scroll state
  private _scrollTop = 0;

  // Tracks whether the current click was preceded by a mousedown on a row
  // (in which case dragStart already handled selection — suppress click)
  private _mouseDownOnRow = false;

  // Cell-level drag state
  private _cellDragAnchor: { rowId: string; colId: string } | null = null;
  private _rowHeaderDragAnchor: string | null = null;   // rowId of drag start
  private _colHeaderDragAnchor: string | null = null;   // colId of drag start

  // Sort state cache (for header indicators)
  private _sortState: SortState[] = [];

  // Filter input values
  private _filterValues: Record<string, string> = {};

  // Bound event unsubscribers
  private _unsubs: Array<() => void> = [];

  // Window resize observer
  private _resizeObserver?: ResizeObserver;

  constructor(
    private readonly _container: HTMLElement,
    private readonly _bus: IEventBus,
    private readonly _colModel: ColumnModel<TData>,
    private readonly _rowModel: ClientRowModel<TData>,
    private readonly _selModel: SelectionModel,
    private readonly _api: GridApi<TData>,
    opts: RenderPipelineOptions = {},
  ) {
    this._opts = {
      rowHeight:       opts.rowHeight       ?? DEFAULTS.rowHeight,
      headerHeight:    opts.headerHeight    ?? DEFAULTS.headerHeight,
      filterRowHeight: opts.filterRowHeight ?? DEFAULTS.filterRowHeight,
      overscan:        opts.overscan        ?? DEFAULTS.overscan,
    };
    this._cellRenderer = opts.cellRenderer;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  mount(): void {
    // Sync sort state that may have been applied before subscription (e.g. initialSort)
    this._sortState = this._colModel.sortState;
    this._buildShell();
    this._buildHeader();
    this._buildFilterRow();
    this._bindScroll();
    this._bindDragSelect();
    this._bindKeyboard();
    this._subscribeEvents();
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._renderRows());
      this._resizeObserver.observe(this._body);
    }
    this._renderRows();
  }

  private _destroyed = false;

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
    this._resizeObserver?.disconnect();
    this._root.remove();
  }

  // ─── DOM construction ────────────────────────────────────────────────────────

  private _buildShell(): void {
    this._root = document.createElement('div');
    this._root.className = this._selModel.unit === 'cell' ? 'ugrid ugrid--cell-mode' : 'ugrid';

    this._header = document.createElement('div');
    this._header.className = 'ugrid-header';
    this._header.style.height = `${this._opts.headerHeight}px`;

    this._filterRow = document.createElement('div');
    this._filterRow.className = 'ugrid-filter-row';
    this._filterRow.style.height = `${this._opts.filterRowHeight}px`;

    this._body = document.createElement('div');
    this._body.className = 'ugrid-body';
    this._body.tabIndex = 0;

    this._spacer = document.createElement('div');
    this._spacer.className = 'ugrid-spacer';

    this._rowsEl = document.createElement('div');
    this._rowsEl.className = 'ugrid-rows';

    this._spacer.appendChild(this._rowsEl);
    this._body.appendChild(this._spacer);

    this._root.appendChild(this._header);
    this._root.appendChild(this._filterRow);
    this._root.appendChild(this._body);

    this._container.appendChild(this._root);
  }

  private _buildHeader(): void {
    this._header.innerHTML = '';
    for (const col of this._colModel.visible) {
      const cell = document.createElement('div');
      cell.className = 'ugrid-header-cell';
      cell.style.width = `${col.width}px`;
      cell.dataset.colId = col.colId;

      const label = document.createElement('span');
      label.className = 'ugrid-header-label';
      label.textContent = col.def.headerName ?? col.colId;

      const sortIcon = document.createElement('span');
      sortIcon.className = 'ugrid-sort-icon';

      cell.appendChild(label);
      cell.appendChild(sortIcon);
      cell.addEventListener('mousedown', (e) => {
        if (this._selModel.unit === 'cell' && !(e.ctrlKey || e.metaKey)) {
          this._selModel.selectEntireColumn(col.colId);
          this._colHeaderDragAnchor = col.colId;
          e.preventDefault();
          return;
        }
      });
      cell.addEventListener('click', (e) => {
        // In cell mode, selection is handled by mousedown above
        if (this._selModel.unit === 'cell' && !(e.ctrlKey || e.metaKey)) return;
        this._onHeaderClick(col.colId, e.ctrlKey || e.metaKey);
      });
      this._header.appendChild(cell);
    }
    this._refreshSortIndicators();
  }

  private _buildFilterRow(): void {
    this._filterRow.innerHTML = '';
    for (const col of this._colModel.visible) {
      const cell = document.createElement('div');
      cell.className = 'ugrid-filter-cell';
      cell.style.width = `${col.width}px`;
      cell.dataset.colId = col.colId;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Filter…';
      input.value = this._filterValues[col.colId] ?? '';
      input.addEventListener('input', () => {
        this._filterValues[col.colId] = input.value;
        this._applyFilters();
        clearBtn.style.display = input.value ? 'flex' : 'none';
      });

      const clearBtn = document.createElement('button');
      clearBtn.className = 'ugrid-filter-clear-btn';
      clearBtn.textContent = '×';
      clearBtn.title = 'Clear filter';
      clearBtn.style.display = (this._filterValues[col.colId] ?? '') ? 'flex' : 'none';
      clearBtn.addEventListener('click', () => {
        input.value = '';
        delete this._filterValues[col.colId];
        this._applyFilters();
        clearBtn.style.display = 'none';
      });

      const inputWrap = document.createElement('div');
      inputWrap.className = 'ugrid-filter-input-wrap';
      inputWrap.appendChild(input);
      inputWrap.appendChild(clearBtn);
      cell.appendChild(inputWrap);
      this._filterRow.appendChild(cell);
    }
  }

  // ─── Scroll ──────────────────────────────────────────────────────────────────

  private _bindScroll(): void {
    this._body.addEventListener('scroll', () => {
      this._scrollTop = this._body.scrollTop;
      this._renderRows();
    }, { passive: true });
  }

  // ─── Drag-select gestures ─────────────────────────────────────────────────────

  private _bindDragSelect(): void {
    // ── Mouse ────────────────────────────────────────────────────────────────
    this._body.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.ugrid-filter-icon-btn') || target.closest('.ugrid-filter-clear-btn')) return;
      const rowEl = target.closest<HTMLElement>('.ugrid-row');
      if (!rowEl) return;
      this._mouseDownOnRow = true;
      const idx    = Number(rowEl.dataset.displayIndex);
      const extend = e.ctrlKey || e.metaKey;

      const cellEl = target.closest<HTMLElement>('.ugrid-cell');
      const rowId  = rowEl.dataset.rowId!;
      const colId  = cellEl?.dataset.colId ?? this._colModel.visible[0]?.colId;

      if (this._selModel.unit === 'cell') {
        // Check if click is on a rowHeader column → select entire row
        const col = colId ? this._colModel.visible.find(c => c.colId === colId) : null;
        if (col?.def.rowHeader) {
          this._selModel.selectEntireRow(rowId, extend);
          this._cellDragAnchor = null;
          this._rowHeaderDragAnchor = rowId;
        } else if (rowId && colId) {
          const coord = { rowId, colId };
          if (e.shiftKey && this._selModel.focusedCell) {
            // Shift+click: range from current active cell to clicked cell
            const anchor = this._selModel.focusedCell;
            this._selModel.selectRange(anchor, coord);
            this._selModel.setFocus(anchor);
          } else {
            this._selModel.selectCell(coord, extend);
          }
          this._cellDragAnchor = coord;
        }
      } else {
        // Row-level drag
        this._selModel.dragStart(idx, extend);
        this._cellDragAnchor = null;
        if (rowId && colId) {
          this._selModel.setFocus({ rowId, colId });
        }
      }

      e.preventDefault(); // suppress text selection
      this._body.focus();    // ensure body has focus for keyboard events
    });

    this._body.addEventListener('mousemove', (e) => {
      // Row-header drag: extend entire-row selection
      if (this._rowHeaderDragAnchor) {
        const rowIdx = this._yToDisplayIndex(e.clientY);
        if (rowIdx !== null) {
          const row = this._rowModel.displayRows[rowIdx];
          if (row) {
            const cols = this._colModel.visible;
            const focusCol = cols.find(c => !c.def.rowHeader) ?? cols[0];
            const last  = cols[cols.length - 1]?.colId;
            if (focusCol && last) {
              this._selModel.selectRange(
                { rowId: this._rowHeaderDragAnchor, colId: focusCol.colId },
                { rowId: row.rowId, colId: last },
              );
              this._selModel.setFocus({ rowId: this._rowHeaderDragAnchor, colId: focusCol.colId });
            }
          }
        }
        return;
      }
      // Cell-level drag: extend selection range from anchor to current cell
      if (this._cellDragAnchor) {
        const coord = this._xyToCellCoord(e.clientX, e.clientY);
        if (coord) {
          this._selModel.selectRange(this._cellDragAnchor, coord);
          this._selModel.setFocus(this._cellDragAnchor);
        }
        return;
      }
      // Row-level drag
      if (!this._selModel.isDragging) return;
      const idx = this._yToDisplayIndex(e.clientY);
      if (idx !== null) {
        this._selModel.dragMove(idx);
      }
    });

    // Column-header drag (window-level since mouse leaves the header element)
    const onColHeaderDragMove = (e: MouseEvent) => {
      if (!this._colHeaderDragAnchor) return;
      const colId = this._xToColId(e.clientX);
      if (colId) {
        const rows = this._rowModel.displayRows;
        const firstRow = rows[0]?.rowId;
        const lastRow  = rows[rows.length - 1]?.rowId;
        if (firstRow && lastRow) {
          this._selModel.selectRange(
            { rowId: firstRow, colId: this._colHeaderDragAnchor },
            { rowId: lastRow,  colId },
          );
          this._selModel.setFocus({ rowId: firstRow, colId: this._colHeaderDragAnchor });
        }
      }
    };
    window.addEventListener('mousemove', onColHeaderDragMove);
    this._unsubs.push(() => window.removeEventListener('mousemove', onColHeaderDragMove));

    const endDrag = () => {
      this._cellDragAnchor = null;
      this._rowHeaderDragAnchor = null;
      this._colHeaderDragAnchor = null;
      this._selModel.dragEnd();
      setTimeout(() => { this._mouseDownOnRow = false; }, 0);
    };
    window.addEventListener('mouseup', endDrag);
    this._unsubs.push(() => window.removeEventListener('mouseup', endDrag));

    // ── Two-finger touch ─────────────────────────────────────────────────────
    let _twoFingerActive = false;

    this._body.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      _twoFingerActive = true;
      const midY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const idx   = this._yToDisplayIndex(midY);
      const extend = e.ctrlKey || e.metaKey;
      if (idx !== null) this._selModel.dragStart(idx, extend);
    }, { passive: false });

    this._body.addEventListener('touchmove', (e) => {
      if (!_twoFingerActive || e.touches.length !== 2) return;
      e.preventDefault();
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const idx  = this._yToDisplayIndex(midY);
      if (idx !== null) this._selModel.dragMove(idx);
    }, { passive: false });

    this._body.addEventListener('touchend', () => {
      if (!_twoFingerActive) return;
      _twoFingerActive = false;
      this._selModel.dragEnd();
    });
  }

  // ─── Keyboard navigation ──────────────────────────────────────────────────────

  private _bindKeyboard(): void {
    this._body.addEventListener('keydown', (e) => {
      // Don't intercept keyboard when a filter input is focused
      if ((e.target as HTMLElement).closest('.ugrid-filter-input-wrap')) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this._selModel.moveFocus('up', e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._selModel.moveFocus('down', e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this._selModel.moveFocus('left', e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this._selModel.moveFocus('right', e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        case 'PageUp': {
          e.preventDefault();
          const pageRows = Math.max(1, Math.floor((this._body.clientHeight || 400) / this._opts.rowHeight) - 1);
          this._selModel.moveFocusVertical(-pageRows, e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        }
        case 'PageDown': {
          e.preventDefault();
          const pageRows = Math.max(1, Math.floor((this._body.clientHeight || 400) / this._opts.rowHeight) - 1);
          this._selModel.moveFocusVertical(pageRows, e.shiftKey);
          this._ensureFocusedCellVisible();
          break;
        }
        case 'Tab': {
          e.preventDefault();
          const dir = e.shiftKey ? 'left' : 'right';
          this._selModel.moveFocus(dir);
          this._ensureFocusedCellVisible();
          break;
        }
        case 'Enter': {
          e.preventDefault();
          this._selModel.moveFocus('down');
          this._ensureFocusedCellVisible();
          break;
        }
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this._selModel.selectAll();
          }
          break;
        case 'Escape':
          e.preventDefault();
          this._selModel.deselectAll();
          this._selModel.selectedRanges.splice(0, this._selModel.selectedRanges.length);
          break;
        case 'F2':
          if (this._selModel.focusedCell) {
            this._bus.emit('cellKeyDown', {
              type: 'cellKeyDown',
              source: 'user',
              coord: this._selModel.focusedCell,
              event: e,
            });
          }
          break;
        default:
          break;
      }
    });
  }

  private _ensureFocusedCellVisible(): void {
    const fc = this._selModel.focusedCell;
    if (!fc) return;
    const rows = this._rowModel.displayRows;
    const rowIdx = rows.findIndex((r) => r.rowId === fc.rowId);
    if (rowIdx === -1) return;
    const rowH = this._opts.rowHeight;
    const viewH = this._body.clientHeight || 400;
    const rowTop = rowIdx * rowH;
    const rowBot = rowTop + rowH;
    if (rowTop < this._body.scrollTop) {
      this._body.scrollTop = rowTop;
    } else if (rowBot > this._body.scrollTop + viewH) {
      this._body.scrollTop = rowBot - viewH;
    }
  }

  private _yToDisplayIndex(clientY: number): number | null {
    const rect  = this._body.getBoundingClientRect();
    const relY  = clientY - rect.top + this._scrollTop;
    const idx   = Math.floor(relY / this._opts.rowHeight);
    const count = this._rowModel.displayRowCount;
    return idx >= 0 && idx < count ? idx : null;
  }

  /** Resolve a clientX to a column ID using the header's position. */
  private _xToColId(clientX: number): string | null {
    const rect = this._header.getBoundingClientRect();
    const relX = clientX - rect.left + this._header.scrollLeft;
    const cols = this._colModel.visible;
    let accum = 0;
    for (const col of cols) {
      accum += col.width;
      if (relX < accum) return col.colId;
    }
    return cols.length > 0 ? cols[cols.length - 1].colId : null;
  }

  /** Resolve a mouse position to a cell coordinate { rowId, colId }. */
  private _xyToCellCoord(clientX: number, clientY: number): { rowId: string; colId: string } | null {
    // Row from Y
    const rowIdx = this._yToDisplayIndex(clientY);
    if (rowIdx === null) return null;
    const row = this._rowModel.displayRows[rowIdx];
    if (!row) return null;

    // Column from X (skip row-header columns)
    const rect = this._body.getBoundingClientRect();
    const relX = clientX - rect.left + this._body.scrollLeft;
    const cols = this._colModel.visible;
    let accum = 0;
    let lastDataCol: string | null = null;
    for (const col of cols) {
      accum += col.width;
      if (!col.def.rowHeader) lastDataCol = col.colId;
      if (relX < accum) {
        // If landed on a row-header column, clamp to first data column
        if (col.def.rowHeader) {
          const first = cols.find(c => !c.def.rowHeader);
          return first ? { rowId: row.rowId, colId: first.colId } : null;
        }
        return { rowId: row.rowId, colId: col.colId };
      }
    }
    // Past last column — clamp to last data column
    if (lastDataCol) {
      return { rowId: row.rowId, colId: lastDataCol };
    }
    return null;
  }

  // ─── Event subscriptions ─────────────────────────────────────────────────────

  private _subscribeEvents(): void {
    this._unsubs.push(
      this._bus.on('rowDataChanged', () => this._renderRows()),
      this._bus.on('sortChanged', (e) => {
        this._sortState = e.sortState;
        this._refreshSortIndicators();
        this._renderRows();
      }),
      this._bus.on('filterChanged', (e) => {
        if (Object.keys(e.filterState).length === 0) {
          this._filterValues = {};
          this._filterRow.querySelectorAll('input').forEach((inp) => { inp.value = ''; });
        } else {
          // Sync _filterValues with incoming state so filter-icon active state is accurate
          for (const col of this._colModel.visible) {
            if (!col.def.filterIcon) continue;
            const fs = e.filterState[col.colId] as { value?: string } | undefined;
            if (fs?.value !== undefined) {
              // Store as =value so it matches the exactExpr format used by the icon
              this._filterValues[col.colId] = `=${fs.value}`;
            } else if (!(col.colId in e.filterState)) {
              delete this._filterValues[col.colId];
            }
          }
        }
        this._renderRows();
      }),
      this._bus.on('selectionChanged', () => this._refreshSelectionClasses()),
      this._bus.on('activeCellChanged', () => this._refreshSelectionClasses()),
      this._bus.on('columnResized',   () => { this._buildHeader(); this._buildFilterRow(); this._renderRows(); }),
      this._bus.on('columnMoved',     () => { this._buildHeader(); this._buildFilterRow(); this._renderRows(); }),
    );
  }

  // ─── Row render ───────────────────────────────────────────────────────────────

  private _renderRows(): void {
    const rows      = this._rowModel.displayRows;
    const total     = rows.length;
    const viewH     = this._body.clientHeight || 400;
    const rowH      = this._opts.rowHeight;
    const overscan  = this._opts.overscan;

    this._spacer.style.height = `${total * rowH}px`;

    if (total === 0) {
      this._rowsEl.innerHTML = this._emptyHtml();
      return;
    }

    const startIdx  = Math.max(0, Math.floor(this._scrollTop / rowH) - overscan);
    const endIdx    = Math.min(total - 1, Math.ceil((this._scrollTop + viewH) / rowH) + overscan);
    const offsetTop = startIdx * rowH;

    this._rowsEl.style.top = `${offsetTop}px`;

    const cols     = this._colModel.visible;
    const fragment = document.createDocumentFragment();

    for (let i = startIdx; i <= endIdx; i++) {
      fragment.appendChild(this._buildRow(rows[i], i, cols));
    }

    this._rowsEl.innerHTML = '';
    this._rowsEl.appendChild(fragment);
  }

  private _buildRow(node: RowNode<TData>, displayIdx: number, cols: Column<TData>[]): HTMLElement {
    const rowH  = this._opts.rowHeight;
    const isSel = this._selModel.isRowSelected(node.rowId);
    const row   = document.createElement('div');

    const showRowSel = isSel && this._selModel.unit !== 'cell';
    row.className = [
      'ugrid-row',
      displayIdx % 2 === 0 ? 'ugrid-row--even' : 'ugrid-row--odd',
      showRowSel ? 'ugrid-row--selected' : '',
    ].filter(Boolean).join(' ');

    row.style.height = `${rowH}px`;
    row.dataset.rowId        = node.rowId;
    row.dataset.displayIndex = String(displayIdx);

    row.addEventListener('click', (e) => {
      // dragStart on mousedown already handled selection — suppress redundant click
      if (this._mouseDownOnRow) { this._mouseDownOnRow = false; return; }
      // In cell mode, row-level click selection is handled by cell mousedown
      if (this._selModel.unit === 'cell') return;
      this._onRowClick(node.rowId, e);
    });

    for (const col of cols) {
      row.appendChild(this._buildCell(col, node));
    }
    return row;
  }

  private _buildCell(col: Column<TData>, node: RowNode<TData>): HTMLElement {
    const cell  = document.createElement('div');
    const value = this._getValue(node, col);

    cell.style.width = `${col.width}px`;
    cell.dataset.colId = col.colId;

    // Try pluggable renderer first
    if (this._cellRenderer) {
      const custom = this._cellRenderer(col as Column, node as RowNode, value);
      if (custom) {
        cell.className = col.def.rowHeader ? 'ugrid-cell ugrid-cell--row-header' : 'ugrid-cell';
        cell.appendChild(custom);
        this._maybeAppendFilterIcon(cell, col, value);
        this._applyCellSelectionClasses(cell, node.rowId, col.colId);
        return cell;
      }
    }

    // Default rendering
    this._defaultCellRender(cell, col, value);
    if (col.def.rowHeader) cell.classList.add('ugrid-cell--row-header');
    this._maybeAppendFilterIcon(cell, col, value);
    this._applyCellSelectionClasses(cell, node.rowId, col.colId);
    return cell;
  }

  private _maybeAppendFilterIcon(cell: HTMLElement, col: Column<TData>, value: unknown): void {
    if (!col.def.filterIcon) return;
    const strVal = value === null || value === undefined ? '' : String(value);
    const activeFilter = this._filterValues[col.colId] ?? '';
    const exactExpr = `=${strVal}`;
    const isActive = activeFilter !== '' && activeFilter === exactExpr;

    const btn = document.createElement('button');
    btn.className = isActive
      ? 'ugrid-filter-icon-btn ugrid-filter-icon-btn--active'
      : 'ugrid-filter-icon-btn';
    btn.title = isActive ? 'Clear filter' : `Filter by "${strVal}"`;
    btn.textContent = isActive ? '✕' : '▽';
    btn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filterCell = this._filterRow.querySelector<HTMLElement>(
        `.ugrid-filter-cell[data-col-id="${col.colId}"]`
      );
      const input   = filterCell?.querySelector<HTMLInputElement>('input') ?? null;
      const clearBtn = filterCell?.querySelector<HTMLButtonElement>('.ugrid-filter-clear-btn') ?? null;
      if (isActive) {
        delete this._filterValues[col.colId];
        this._applyFilters();
        if (input)    input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
      } else {
        this._filterValues[col.colId] = exactExpr;
        this._applyFilters();
        if (input)    input.value = exactExpr;
        if (clearBtn) clearBtn.style.display = 'flex';
      }
    });
    cell.appendChild(btn);
  }

  /** Override in subclasses or via cellRenderer option for custom rendering. */
  protected _defaultCellRender(cell: HTMLElement, _col: Column<TData>, value: unknown): void {
    cell.className = 'ugrid-cell';
    cell.textContent = value === null || value === undefined ? '' : String(value);
  }

  private _getValue(node: RowNode<TData>, col: Column<TData>): unknown {
    if (!node.data) return null;
    const field = (col.def as ColumnDef).field;
    if (field === undefined) return null;
    return (node.data as Record<string, unknown>)[field as string];
  }

  // ─── Selection helpers ────────────────────────────────────────────────────────

  private _onRowClick(rowId: string, e: MouseEvent): void {
    const extend = e.ctrlKey || e.metaKey || e.shiftKey;
    if (extend) {
      // Ctrl/Meta/Shift: toggle this row additively
      if (this._selModel.isRowSelected(rowId)) {
        this._selModel.deselectRow(rowId);
      } else {
        this._selModel.selectRow(rowId, true);
      }
    } else {
      // Plain click: if this is the only selected row, deselect it; otherwise select only it
      const ids = [...this._selModel.selectedRowIds];
      if (ids.length === 1 && ids[0] === rowId) {
        this._selModel.deselectRow(rowId);
      } else {
        this._selModel.deselectAll();
        this._selModel.selectRow(rowId, false);
      }
    }
  }

  private _refreshSelectionClasses(): void {
    const isCellMode = this._selModel.unit === 'cell';
    this._rowsEl.querySelectorAll<HTMLElement>('.ugrid-row').forEach((rowEl) => {
      const rowId = rowEl.dataset.rowId!;
      rowEl.classList.toggle(
        'ugrid-row--selected',
        !isCellMode && this._selModel.isRowSelected(rowId),
      );
      // Refresh cell-level classes within each visible row
      rowEl.querySelectorAll<HTMLElement>('.ugrid-cell').forEach((cellEl) => {
        const colId = cellEl.dataset.colId!;
        this._applyCellSelectionClasses(cellEl, rowId, colId);
      });
    });

    // Highlight column headers that intersect the selection
    if (isCellMode) {
      this._header.querySelectorAll<HTMLElement>('.ugrid-header-cell').forEach((hdr) => {
        const colId = hdr.dataset.colId!;
        hdr.classList.toggle('ugrid-header-cell--in-range', this._selModel.isColumnInRange(colId));
      });
    }
  }

  private _applyCellSelectionClasses(cell: HTMLElement, rowId: string, colId: string): void {
    // Only apply cell-level selection classes when unit is 'cell'
    if (this._selModel.unit !== 'cell') return;
    const coord = { rowId, colId };
    const focused = this._selModel.isCellSelected(coord);
    const inRange = this._selModel.isCellInRange(coord);

    // Row-header cells highlight when their row intersects ANY range
    const col = this._colModel.visible.find(c => c.colId === colId);
    const isRowHdr = !!col?.def.rowHeader;
    const rowHdrHighlight = isRowHdr && this._selModel.isRowInRange(rowId);

    cell.classList.toggle('ugrid-cell--focused', focused);
    cell.classList.toggle('ugrid-cell--in-range', inRange || rowHdrHighlight);

    // Range perimeter edges (only for actual in-range data cells, not row headers)
    const edges = inRange && !isRowHdr ? this._selModel.getCellRangeEdges(coord) : null;
    cell.classList.toggle('ugrid-cell--range-top',    !!edges?.top);
    cell.classList.toggle('ugrid-cell--range-bottom', !!edges?.bottom);
    cell.classList.toggle('ugrid-cell--range-left',   !!edges?.left);
    cell.classList.toggle('ugrid-cell--range-right',  !!edges?.right);
  }

  // ─── Sort header ─────────────────────────────────────────────────────────────

  private _onHeaderClick(colId: string, multiSort = false): void {
    const existing = this._sortState.find((s) => s.colId === colId);
    if (!existing) {
      this._colModel.setSort(colId, 'asc', multiSort);
    } else if (existing.direction === 'asc') {
      this._colModel.setSort(colId, 'desc', multiSort);
    } else {
      this._colModel.setSort(colId, null, multiSort);
    }
  }

  private _refreshSortIndicators(): void {
    this._header.querySelectorAll<HTMLElement>('.ugrid-header-cell').forEach((cell) => {
      const colId = cell.dataset.colId!;
      const sort  = this._sortState.find((s) => s.colId === colId);
      const icon  = cell.querySelector<HTMLElement>('.ugrid-sort-icon')!;
      cell.classList.toggle('sorted', !!sort);
      icon.textContent = sort ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
    });
  }

  // ─── Filter ───────────────────────────────────────────────────────────────────

  private _applyFilters(): void {
    const filterState: Record<string, unknown> = {};
    for (const [colId, val] of Object.entries(this._filterValues)) {
      if (!val.trim()) continue;
      const parsed = parseFilterExpression(val);
      // Mark input as error if expression didn't parse
      const input = this._filterRow.querySelector<HTMLInputElement>(`[data-col-id="${colId}"] input`);
      if (input) input.classList.toggle('ugrid-filter--error', parsed === null);
      if (parsed !== null) filterState[colId] = parsed;
    }
    this._api.setFilterModel(filterState as never);
  }

  // ─── Misc ─────────────────────────────────────────────────────────────────────

  private _emptyHtml(): string {
    return `<div class="ugrid-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
      </svg>
      <span>No rows match the current filters</span>
    </div>`;
  }

  // ─── Public imperative API ────────────────────────────────────────────────────

  /** Force a full re-render (e.g. after theme change). */
  refresh(): void {
    this._buildHeader();
    this._buildFilterRow();
    this._renderRows();
  }

  /** Clear all filter inputs and reset filter model. */
  clearFilters(): void {
    this._filterValues = {};
    this._filterRow.querySelectorAll('input').forEach((inp) => { inp.value = ''; });
    this._api.setFilterModel({});
  }

  /** Clear sort state in both column model and header indicators. */
  clearSort(): void {
    this._api.setSortModel([]);
    this._sortState = [];
    this._refreshSortIndicators();
  }

  get rootEl(): HTMLElement { return this._root; }
  get bodyEl(): HTMLElement { return this._body; }
  get scrollTop(): number  { return this._scrollTop; }
}
