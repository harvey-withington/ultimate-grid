import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectionModel } from '../SelectionModel';
import { EventBus } from '../../events/EventBus';
import { ClientRowModel } from '../../row/ClientRowModel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Row { id: number; name: string }

function makeSetup(mode: 'single' | 'multi' | 'range' | 'none' = 'multi') {
  const bus = new EventBus();
  const rowModel = new ClientRowModel<Row>(bus, 40, (d) => String(d.id));
  const data: Row[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob'   },
    { id: 3, name: 'Carol' },
    { id: 4, name: 'Dave'  },
    { id: 5, name: 'Eve'   },
  ];
  rowModel.setRowData(data);
  const sel = new SelectionModel(bus, rowModel, mode, 'row');
  return { bus, rowModel, sel };
}

describe('SelectionModel', () => {
  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with no selection', () => {
      const { sel } = makeSetup();
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('focusedCell is null', () => {
      const { sel } = makeSetup();
      expect(sel.focusedCell).toBeNull();
    });

    it('isDragging is false', () => {
      const { sel } = makeSetup();
      expect(sel.isDragging).toBe(false);
    });
  });

  // ─── selectRow ────────────────────────────────────────────────────────────

  describe('selectRow', () => {
    it('selects a single row', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      expect(sel.isRowSelected('1')).toBe(true);
    });

    it('replaces selection when extend=false', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.selectRow('2');
      expect(sel.isRowSelected('1')).toBe(false);
      expect(sel.isRowSelected('2')).toBe(true);
    });

    it('extends selection when extend=true in multi mode', () => {
      const { sel } = makeSetup('multi');
      sel.selectRow('1');
      sel.selectRow('2', true);
      expect(sel.isRowSelected('1')).toBe(true);
      expect(sel.isRowSelected('2')).toBe(true);
    });

    it('single mode always replaces even with extend=true', () => {
      const { sel } = makeSetup('single');
      sel.selectRow('1');
      sel.selectRow('2', true);
      expect(sel.isRowSelected('1')).toBe(false);
      expect(sel.isRowSelected('2')).toBe(true);
    });

    it('does nothing in none mode', () => {
      const { sel } = makeSetup('none');
      sel.selectRow('1');
      expect(sel.isRowSelected('1')).toBe(false);
    });

    it('skips non-selectable rows', () => {
      const { sel, rowModel } = makeSetup();
      rowModel.getRowById('3')!.selectable = false;
      sel.selectRow('3');
      expect(sel.isRowSelected('3')).toBe(false);
    });

    it('emits selectionChanged', () => {
      const { sel, bus } = makeSetup();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.selectRow('1');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].selectedRowIds).toContain('1');
    });
  });

  // ─── deselectRow ──────────────────────────────────────────────────────────

  describe('deselectRow', () => {
    it('removes a selected row', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.deselectRow('1');
      expect(sel.isRowSelected('1')).toBe(false);
    });

    it('is a no-op for unselected row', () => {
      const { sel, bus } = makeSetup();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.deselectRow('999');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── selectAll / deselectAll ──────────────────────────────────────────────

  describe('selectAll / deselectAll', () => {
    it('selectAll selects all selectable display rows', () => {
      const { sel } = makeSetup();
      sel.selectAll();
      expect(sel.selectedRowIds.size).toBe(5);
    });

    it('selectAll skips non-selectable rows', () => {
      const { sel, rowModel } = makeSetup();
      rowModel.getRowById('2')!.selectable = false;
      sel.selectAll();
      expect(sel.selectedRowIds.size).toBe(4);
      expect(sel.isRowSelected('2')).toBe(false);
    });

    it('selectAll does nothing in single mode', () => {
      const { sel } = makeSetup('single');
      sel.selectAll();
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('selectAll does nothing in none mode', () => {
      const { sel } = makeSetup('none');
      sel.selectAll();
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('deselectAll clears selection and emits', () => {
      const { sel, bus } = makeSetup();
      sel.selectAll();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.deselectAll();
      expect(sel.selectedRowIds.size).toBe(0);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('deselectAll is no-op when nothing selected', () => {
      const { sel, bus } = makeSetup();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.deselectAll();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── selectRowRange ───────────────────────────────────────────────────────

  describe('selectRowRange', () => {
    it('selects a contiguous range', () => {
      const { sel } = makeSetup();
      sel.selectRowRange(1, 3);
      expect([...sel.selectedRowIds]).toHaveLength(3);
      expect(sel.isRowSelected('2')).toBe(true); // displayIndex 1
      expect(sel.isRowSelected('3')).toBe(true); // displayIndex 2
      expect(sel.isRowSelected('4')).toBe(true); // displayIndex 3
    });

    it('is order-independent (endIndex < startIndex)', () => {
      const { sel } = makeSetup();
      sel.selectRowRange(3, 1);
      expect([...sel.selectedRowIds]).toHaveLength(3);
    });

    it('replaces existing selection when extend=false', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.selectRowRange(2, 3);
      expect(sel.isRowSelected('1')).toBe(false);
    });

    it('extends existing selection when extend=true', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.selectRowRange(2, 3, true);
      expect(sel.isRowSelected('1')).toBe(true);
      expect(sel.isRowSelected('3')).toBe(true);
    });

    it('single-row range selects one row', () => {
      const { sel } = makeSetup();
      sel.selectRowRange(2, 2);
      expect([...sel.selectedRowIds]).toHaveLength(1);
    });

    it('does nothing in none mode', () => {
      const { sel } = makeSetup('none');
      sel.selectRowRange(0, 4);
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('does nothing in single mode', () => {
      const { sel } = makeSetup('single');
      sel.selectRowRange(0, 4);
      expect(sel.selectedRowIds.size).toBe(0);
    });
  });

  // ─── drag-select ──────────────────────────────────────────────────────────

  describe('drag-select', () => {
    it('dragStart selects the anchor row and sets isDragging', () => {
      const { sel } = makeSetup();
      sel.dragStart(0);
      expect(sel.isDragging).toBe(true);
      expect(sel.isRowSelected('1')).toBe(true);
    });

    it('dragMove extends selection to current index', () => {
      const { sel } = makeSetup();
      sel.dragStart(0);
      sel.dragMove(2);
      // rows at displayIndex 0,1,2 → ids 1,2,3
      expect(sel.selectedRowIds.size).toBe(3);
      expect(sel.isRowSelected('1')).toBe(true);
      expect(sel.isRowSelected('2')).toBe(true);
      expect(sel.isRowSelected('3')).toBe(true);
    });

    it('dragMove backwards shrinks selection correctly', () => {
      const { sel } = makeSetup();
      sel.dragStart(4);
      sel.dragMove(2);
      // rows 2,3,4 → ids 3,4,5
      expect(sel.selectedRowIds.size).toBe(3);
      expect(sel.isRowSelected('3')).toBe(true);
      expect(sel.isRowSelected('4')).toBe(true);
      expect(sel.isRowSelected('5')).toBe(true);
    });

    it('dragMove is a no-op when index unchanged', () => {
      const { sel, bus } = makeSetup();
      sel.dragStart(0);
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.dragMove(0); // same index
      expect(handler).not.toHaveBeenCalled();
    });

    it('dragEnd clears drag state but preserves selection', () => {
      const { sel } = makeSetup();
      sel.dragStart(0);
      sel.dragMove(3);
      sel.dragEnd();
      expect(sel.isDragging).toBe(false);
      expect(sel.selectedRowIds.size).toBe(4);
    });

    it('dragStart replaces previous selection by default', () => {
      const { sel } = makeSetup();
      sel.selectAll();
      sel.dragStart(0);
      expect(sel.selectedRowIds.size).toBe(1);
    });

    it('dragStart preserves prior selection with extend=true', () => {
      const { sel } = makeSetup();
      sel.selectRow('5'); // last row
      sel.dragStart(0, true);
      expect(sel.isRowSelected('5')).toBe(true);
      expect(sel.isRowSelected('1')).toBe(true);
    });

    it('drag emits selectionChanged on each move', () => {
      const { sel, bus } = makeSetup();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.dragStart(0);  // 1 emit
      sel.dragMove(1);   // 1 emit
      sel.dragMove(2);   // 1 emit
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('drag does nothing in none mode', () => {
      const { sel } = makeSetup('none');
      sel.dragStart(0);
      expect(sel.isDragging).toBe(false);
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('drag does nothing in single mode', () => {
      const { sel } = makeSetup('single');
      sel.dragStart(0);
      expect(sel.isDragging).toBe(false);
    });

    it('dragMove before dragStart is a no-op', () => {
      const { sel } = makeSetup();
      expect(() => sel.dragMove(3)).not.toThrow();
      expect(sel.selectedRowIds.size).toBe(0);
    });

    it('deselect-drag: starting on a selected row with extend removes rows', () => {
      const { sel } = makeSetup();
      // Pre-select rows 0–3
      sel.dragStart(0);
      sel.dragMove(3);
      sel.dragEnd();
      expect(sel.selectedRowIds.size).toBe(4);
      // Ctrl+drag starting on row 1 (already selected) — should deselect range
      sel.dragStart(1, true);
      sel.dragMove(2);
      sel.dragEnd();
      // Rows 1 and 2 should now be deselected; rows 0 and 3 remain
      expect(sel.isRowSelected('2')).toBe(false);
      expect(sel.isRowSelected('3')).toBe(false);
      expect(sel.isRowSelected('1')).toBe(true);
      expect(sel.isRowSelected('4')).toBe(true);
    });

    it('deselect-drag: plain drag starting on selected row replaces selection', () => {
      const { sel } = makeSetup();
      sel.selectAll();
      // Plain drag (no extend) on already-selected row — clears and re-selects range only
      sel.dragStart(0);
      sel.dragMove(1);
      sel.dragEnd();
      expect(sel.selectedRowIds.size).toBe(2);
    });
  });

  // ─── moveFocus ────────────────────────────────────────────────────────────

  describe('moveFocus', () => {
    it('moves focus down and selects next row', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.setFocus({ rowId: '1', colId: 'name' });
      sel.moveFocus('down');
      expect(sel.isRowSelected('2')).toBe(true);
    });

    it('moves focus up and selects previous row', () => {
      const { sel } = makeSetup();
      sel.selectRow('3');
      sel.setFocus({ rowId: '3', colId: 'name' });
      sel.moveFocus('up');
      expect(sel.isRowSelected('2')).toBe(true);
    });

    it('clamps at first row', () => {
      const { sel } = makeSetup();
      sel.selectRow('1');
      sel.setFocus({ rowId: '1', colId: 'name' });
      sel.moveFocus('up');
      expect(sel.isRowSelected('1')).toBe(true);
      expect(sel.selectedRowIds.size).toBe(1);
    });

    it('clamps at last row', () => {
      const { sel } = makeSetup();
      sel.selectRow('5');
      sel.setFocus({ rowId: '5', colId: 'name' });
      sel.moveFocus('down');
      expect(sel.isRowSelected('5')).toBe(true);
      expect(sel.selectedRowIds.size).toBe(1);
    });

    it('no-op when no focused cell', () => {
      const { sel } = makeSetup();
      expect(() => sel.moveFocus('down')).not.toThrow();
    });
  });
});

// ─── Cell selection tests ─────────────────────────────────────────────────────

function makeCellSetup(mode: 'single' | 'multi' | 'range' | 'none' = 'multi') {
  const bus = new EventBus();
  const rowModel = new ClientRowModel<Row>(bus, 40, (d) => String(d.id));
  const data: Row[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob'   },
    { id: 3, name: 'Carol' },
    { id: 4, name: 'Dave'  },
    { id: 5, name: 'Eve'   },
  ];
  rowModel.setRowData(data);
  // Minimal column accessor matching the ColumnAccessor interface
  const colModel = {
    visible: [
      { colId: 'id' },
      { colId: 'name' },
    ] as const,
  };
  const sel = new SelectionModel(bus, rowModel, mode, 'cell', colModel);
  return { bus, rowModel, sel, colModel };
}

describe('SelectionModel — cell selection', () => {
  // ─── selectCell ──────────────────────────────────────────────────────────

  describe('selectCell', () => {
    it('sets focusedCell and anchorCell', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'name' });
      expect(sel.focusedCell).toEqual({ rowId: '1', colId: 'name' });
      expect(sel.anchorCell).toEqual({ rowId: '1', colId: 'name' });
    });

    it('creates a single-cell range', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'id' });
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.selectedRanges[0].start).toEqual({ rowId: '2', colId: 'id' });
      expect(sel.selectedRanges[0].end).toEqual({ rowId: '2', colId: 'id' });
    });

    it('replaces ranges when extend=false', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' });
      sel.selectCell({ rowId: '2', colId: 'name' });
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'name' });
    });

    it('adds a range when extend=true in multi mode', () => {
      const { sel } = makeCellSetup('multi');
      sel.selectCell({ rowId: '1', colId: 'id' });
      sel.selectCell({ rowId: '3', colId: 'name' }, true);
      expect(sel.selectedRanges).toHaveLength(2);
    });

    it('replaces even with extend=true in single mode', () => {
      const { sel } = makeCellSetup('single');
      sel.selectCell({ rowId: '1', colId: 'id' });
      sel.selectCell({ rowId: '2', colId: 'name' }, true);
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'name' });
    });

    it('does nothing in none mode', () => {
      const { sel } = makeCellSetup('none');
      sel.selectCell({ rowId: '1', colId: 'id' });
      expect(sel.focusedCell).toBeNull();
      expect(sel.selectedRanges).toHaveLength(0);
    });

    it('emits selectionChanged with focusedCell and selectedRanges', () => {
      const { sel, bus } = makeCellSetup();
      const handler = vi.fn();
      bus.on('selectionChanged', handler);
      sel.selectCell({ rowId: '1', colId: 'name' });
      expect(handler).toHaveBeenCalledOnce();
      const evt = handler.mock.calls[0][0];
      expect(evt.focusedCell).toEqual({ rowId: '1', colId: 'name' });
      expect(evt.selectedRanges).toHaveLength(1);
    });

    it('emits activeCellChanged', () => {
      const { sel, bus } = makeCellSetup();
      const handler = vi.fn();
      bus.on('activeCellChanged', handler);
      sel.selectCell({ rowId: '1', colId: 'id' });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].cell).toEqual({ rowId: '1', colId: 'id' });
      expect(handler.mock.calls[0][0].previous).toBeNull();
    });

    it('tracks row in selectedRowIds for backward compat', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'name' });
      expect(sel.isRowSelected('2')).toBe(true);
    });
  });

  // ─── isCellSelected ──────────────────────────────────────────────────────

  describe('isCellSelected', () => {
    it('returns true for the focused cell', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'name' });
      expect(sel.isCellSelected({ rowId: '1', colId: 'name' })).toBe(true);
    });

    it('returns false for other cells', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'name' });
      expect(sel.isCellSelected({ rowId: '1', colId: 'id' })).toBe(false);
      expect(sel.isCellSelected({ rowId: '2', colId: 'name' })).toBe(false);
    });

    it('returns false when nothing selected', () => {
      const { sel } = makeCellSetup();
      expect(sel.isCellSelected({ rowId: '1', colId: 'name' })).toBe(false);
    });
  });

  // ─── selectRange / isCellInRange ─────────────────────────────────────────

  describe('selectRange', () => {
    it('creates a range from anchor to focus', () => {
      const { sel } = makeCellSetup();
      sel.selectRange({ rowId: '1', colId: 'id' }, { rowId: '3', colId: 'name' });
      expect(sel.anchorCell).toEqual({ rowId: '1', colId: 'id' });
      expect(sel.focusedCell).toEqual({ rowId: '3', colId: 'name' });
      expect(sel.selectedRanges).toHaveLength(1);
    });

    it('isCellInRange returns true for cells within the range', () => {
      const { sel } = makeCellSetup();
      sel.selectRange({ rowId: '1', colId: 'id' }, { rowId: '3', colId: 'name' });
      // All cells in the 3×2 rectangle should be in range
      expect(sel.isCellInRange({ rowId: '1', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '1', colId: 'name' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '2', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '2', colId: 'name' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '3', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '3', colId: 'name' })).toBe(true);
    });

    it('isCellInRange returns false for cells outside the range', () => {
      const { sel } = makeCellSetup();
      sel.selectRange({ rowId: '2', colId: 'id' }, { rowId: '3', colId: 'id' });
      expect(sel.isCellInRange({ rowId: '1', colId: 'id' })).toBe(false);
      expect(sel.isCellInRange({ rowId: '4', colId: 'id' })).toBe(false);
      expect(sel.isCellInRange({ rowId: '2', colId: 'name' })).toBe(false);
    });

    it('replaces last range on subsequent selectRange calls (Shift behavior)', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' }); // creates initial range
      sel.selectRange({ rowId: '1', colId: 'id' }, { rowId: '2', colId: 'name' });
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.selectedRanges[0].end).toEqual({ rowId: '2', colId: 'name' });
    });

    it('preserves Ctrl-added ranges while replacing last', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' });
      sel.selectCell({ rowId: '4', colId: 'name' }, true); // Ctrl+click → 2 ranges
      expect(sel.selectedRanges).toHaveLength(2);
      // Shift+extend from second cell
      sel.selectRange({ rowId: '4', colId: 'name' }, { rowId: '5', colId: 'name' });
      expect(sel.selectedRanges).toHaveLength(2); // first Ctrl range + replaced last
      expect(sel.selectedRanges[0].start).toEqual({ rowId: '1', colId: 'id' }); // untouched
    });

    it('does nothing in none mode', () => {
      const { sel } = makeCellSetup('none');
      sel.selectRange({ rowId: '1', colId: 'id' }, { rowId: '3', colId: 'name' });
      expect(sel.selectedRanges).toHaveLength(0);
    });
  });

  // ─── moveFocus with columns ──────────────────────────────────────────────

  describe('moveFocus with column model', () => {
    it('moves focus left', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'name' });
      sel.moveFocus('left');
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'id' });
    });

    it('moves focus right', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'id' });
      sel.moveFocus('right');
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'name' });
    });

    it('clamps at leftmost column', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'id' });
      sel.moveFocus('left');
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'id' });
    });

    it('clamps at rightmost column', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'name' });
      sel.moveFocus('right');
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'name' });
    });

    it('moves focus up', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '3', colId: 'id' });
      sel.moveFocus('up');
      expect(sel.focusedCell).toEqual({ rowId: '2', colId: 'id' });
    });

    it('moves focus down', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '3', colId: 'id' });
      sel.moveFocus('down');
      expect(sel.focusedCell).toEqual({ rowId: '4', colId: 'id' });
    });

    it('Shift+arrow extends the range from anchor', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'id' });
      sel.moveFocus('down', true);
      sel.moveFocus('right', true);
      // Anchor stays at (2, id), focus moves to (3, name)
      expect(sel.anchorCell).toEqual({ rowId: '2', colId: 'id' });
      expect(sel.focusedCell).toEqual({ rowId: '3', colId: 'name' });
      // Range should cover 2×2 rectangle
      expect(sel.isCellInRange({ rowId: '2', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '2', colId: 'name' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '3', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '3', colId: 'name' })).toBe(true);
      // Outside the range
      expect(sel.isCellInRange({ rowId: '1', colId: 'id' })).toBe(false);
      expect(sel.isCellInRange({ rowId: '4', colId: 'id' })).toBe(false);
    });

    it('plain arrow after Shift+arrow resets to single cell', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '2', colId: 'id' });
      sel.moveFocus('down', true);  // extend
      sel.moveFocus('down');         // collapse
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.selectedRanges[0].start).toEqual(sel.selectedRanges[0].end);
    });
  });

  // ─── setFocus ──────────────────────────────────────────────────────────

  describe('setFocus', () => {
    it('sets focusedCell without changing ranges', () => {
      const { sel } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' });
      const rangesBefore = [...sel.selectedRanges];
      sel.setFocus({ rowId: '3', colId: 'name' });
      expect(sel.focusedCell).toEqual({ rowId: '3', colId: 'name' });
      expect(sel.selectedRanges).toEqual(rangesBefore);
    });

    it('emits activeCellChanged with previous cell', () => {
      const { sel, bus } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' });
      const handler = vi.fn();
      bus.on('activeCellChanged', handler);
      sel.setFocus({ rowId: '2', colId: 'name' });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].previous).toEqual({ rowId: '1', colId: 'id' });
      expect(handler.mock.calls[0][0].cell).toEqual({ rowId: '2', colId: 'name' });
    });

    it('does not emit activeCellChanged when cell is unchanged', () => {
      const { sel, bus } = makeCellSetup();
      sel.selectCell({ rowId: '1', colId: 'id' });
      const handler = vi.fn();
      bus.on('activeCellChanged', handler);
      sel.setFocus({ rowId: '1', colId: 'id' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── selectEntireRow ──────────────────────────────────────────────────────

  describe('selectEntireRow', () => {
    it('creates a range spanning all columns for the given row', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireRow('2');
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.selectedRanges[0].start).toEqual({ rowId: '2', colId: 'id' });
      expect(sel.selectedRanges[0].end).toEqual({ rowId: '2', colId: 'name' });
    });

    it('all cells in that row are in range', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireRow('3');
      expect(sel.isCellInRange({ rowId: '3', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '3', colId: 'name' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '2', colId: 'id' })).toBe(false);
    });

    it('extend=true adds a second range', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireRow('1');
      sel.selectEntireRow('3', true);
      expect(sel.selectedRanges).toHaveLength(2);
    });

    it('does nothing in none mode', () => {
      const { sel } = makeCellSetup('none');
      sel.selectEntireRow('1');
      expect(sel.selectedRanges).toHaveLength(0);
    });
  });

  // ─── selectEntireColumn ───────────────────────────────────────────────────

  describe('selectEntireColumn', () => {
    it('creates a range spanning all rows for the given column', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireColumn('name');
      expect(sel.selectedRanges).toHaveLength(1);
      expect(sel.selectedRanges[0].start).toEqual({ rowId: '1', colId: 'name' });
      expect(sel.selectedRanges[0].end).toEqual({ rowId: '5', colId: 'name' });
    });

    it('all cells in that column are in range', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireColumn('id');
      expect(sel.isCellInRange({ rowId: '1', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '5', colId: 'id' })).toBe(true);
      expect(sel.isCellInRange({ rowId: '1', colId: 'name' })).toBe(false);
    });

    it('extend=true adds a second range', () => {
      const { sel } = makeCellSetup();
      sel.selectEntireColumn('id');
      sel.selectEntireColumn('name', true);
      expect(sel.selectedRanges).toHaveLength(2);
    });

    it('does nothing in none mode', () => {
      const { sel } = makeCellSetup('none');
      sel.selectEntireColumn('id');
      expect(sel.selectedRanges).toHaveLength(0);
    });
  });
});
