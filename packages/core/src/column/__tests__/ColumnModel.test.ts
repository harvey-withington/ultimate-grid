import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnModel } from '../ColumnModel';
import { EventBus } from '../../events/EventBus';
import type { ColumnDef } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Row { id: number; name: string; age: number; city: string; score: number }

const DEFS: ColumnDef<Row>[] = [
  { key: 'id',    field: 'id',    headerName: 'ID',    width: 80  },
  { key: 'name',  field: 'name',  headerName: 'Name',  width: 200 },
  { key: 'age',   field: 'age',   headerName: 'Age',   width: 100 },
  { key: 'city',  field: 'city',  headerName: 'City',  width: 150 },
  { key: 'score', field: 'score', headerName: 'Score', width: 120 },
];

function makeModel(defs = DEFS) {
  const bus = new EventBus();
  const model = new ColumnModel<Row>(defs, bus);
  return { model, bus };
}

describe('ColumnModel', () => {
  // ─── Construction ──────────────────────────────────────────────────────────

  describe('construction', () => {
    it('builds columns from defs in order', () => {
      const { model } = makeModel();
      expect(model.all.map((c) => c.colId)).toEqual(['id', 'name', 'age', 'city', 'score']);
    });

    it('all columns visible by default', () => {
      const { model } = makeModel();
      expect(model.visible).toHaveLength(5);
    });

    it('hidden: true starts column invisible', () => {
      const { model } = makeModel([
        { key: 'a', width: 100 },
        { key: 'b', width: 100, hidden: true },
      ]);
      expect(model.visible.map((c) => c.colId)).toEqual(['a']);
    });

    it('uses def.width when provided', () => {
      const { model } = makeModel();
      expect(model.getById('id')!.width).toBe(80);
      expect(model.getById('name')!.width).toBe(200);
    });

    it('falls back to defaultColWidth when no width in def', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'x' }], bus, 120);
      expect(model.getById('x')!.width).toBe(120);
    });

    it('pinned defaults to null', () => {
      const { model } = makeModel();
      expect(model.getById('id')!.pinned).toBeNull();
    });

    it('respects pinned: left in def', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'a', pinned: 'left', width: 100 }], bus);
      expect(model.getById('a')!.pinned).toBe('left');
      expect(model.pinnedLeft).toHaveLength(1);
    });

    it('sortDirection and sortIndex are null initially', () => {
      const { model } = makeModel();
      const col = model.getById('name')!;
      expect(col.sortDirection).toBeNull();
      expect(col.sortIndex).toBeNull();
    });
  });

  // ─── Accessors ─────────────────────────────────────────────────────────────

  describe('accessors', () => {
    it('totalWidth sums all visible column widths', () => {
      const { model } = makeModel();
      expect(model.totalWidth).toBe(80 + 200 + 100 + 150 + 120); // 650
    });

    it('totalWidth excludes hidden columns', () => {
      const { model } = makeModel();
      model.setVisible('age', false);
      expect(model.totalWidth).toBe(80 + 200 + 150 + 120); // 550
    });

    it('centerWidth excludes pinned columns', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100, pinned: 'left' },
        { key: 'b', width: 200 },
        { key: 'c', width: 150 },
        { key: 'd', width: 80, pinned: 'right' },
      ], bus);
      expect(model.centerWidth).toBe(200 + 150); // 350
    });

    it('pinnedLeft returns only left-pinned visible columns', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100, pinned: 'left' },
        { key: 'b', width: 100 },
        { key: 'c', width: 100, pinned: 'left' },
      ], bus);
      expect(model.pinnedLeft.map((c) => c.colId)).toEqual(['a', 'c']);
    });

    it('pinnedRight returns only right-pinned visible columns', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100, pinned: 'right' },
        { key: 'b', width: 100 },
      ], bus);
      expect(model.pinnedRight.map((c) => c.colId)).toEqual(['a']);
    });

    it('center returns only non-pinned visible columns', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100, pinned: 'left' },
        { key: 'b', width: 100 },
        { key: 'c', width: 100 },
        { key: 'd', width: 100, pinned: 'right' },
      ], bus);
      expect(model.center.map((c) => c.colId)).toEqual(['b', 'c']);
    });

    it('getById returns null for unknown colId', () => {
      const { model } = makeModel();
      expect(model.getById('nonexistent')).toBeNull();
    });
  });

  // ─── Left offsets ──────────────────────────────────────────────────────────

  describe('left offsets', () => {
    it('assigns correct left offsets to center columns', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100 },
        { key: 'b', width: 200 },
        { key: 'c', width: 150 },
      ], bus);
      expect(model.getById('a')!.left).toBe(0);
      expect(model.getById('b')!.left).toBe(100);
      expect(model.getById('c')!.left).toBe(300);
    });

    it('pinned-left columns have independent left offsets from 0', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'pin1', width: 80, pinned: 'left' },
        { key: 'pin2', width: 60, pinned: 'left' },
        { key: 'center', width: 200 },
      ], bus);
      expect(model.getById('pin1')!.left).toBe(0);
      expect(model.getById('pin2')!.left).toBe(80);
      expect(model.getById('center')!.left).toBe(0); // center starts fresh
    });

    it('recalculates left offsets after setWidth', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100 },
        { key: 'b', width: 200 },
      ], bus);
      model.setWidth('a', 50);
      expect(model.getById('b')!.left).toBe(50);
    });

    it('recalculates left offsets after setVisible', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100 },
        { key: 'b', width: 200 },
        { key: 'c', width: 150 },
      ], bus);
      model.setVisible('b', false);
      expect(model.getById('c')!.left).toBe(100); // b skipped
    });
  });

  // ─── setWidth ─────────────────────────────────────────────────────────────

  describe('setWidth', () => {
    it('updates the column width', () => {
      const { model } = makeModel();
      model.setWidth('name', 300);
      expect(model.getById('name')!.width).toBe(300);
    });

    it('clamps to minWidth', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'a', width: 100, minWidth: 60 }], bus);
      model.setWidth('a', 20);
      expect(model.getById('a')!.width).toBe(60);
    });

    it('clamps to maxWidth', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'a', width: 100, maxWidth: 200 }], bus);
      model.setWidth('a', 500);
      expect(model.getById('a')!.width).toBe(200);
    });

    it('defaults minWidth to 50', () => {
      const { model } = makeModel();
      model.setWidth('id', 10);
      expect(model.getById('id')!.width).toBe(50);
    });

    it('emits columnResized event', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('columnResized', handler);
      model.setWidth('name', 250);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'columnResized',
        colId: 'name',
        width: 250,
        finished: true,
      }));
    });

    it('does not emit event when width is unchanged', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('columnResized', handler);
      model.setWidth('name', 200); // already 200
      expect(handler).not.toHaveBeenCalled();
    });

    it('throws for unknown colId', () => {
      const { model } = makeModel();
      expect(() => model.setWidth('unknown', 100)).toThrow();
    });
  });

  // ─── setVisible ───────────────────────────────────────────────────────────

  describe('setVisible', () => {
    it('hides a visible column', () => {
      const { model } = makeModel();
      model.setVisible('age', false);
      expect(model.getById('age')!.visible).toBe(false);
      expect(model.visible.map((c) => c.colId)).not.toContain('age');
    });

    it('shows a hidden column', () => {
      const { model } = makeModel([{ key: 'a', hidden: true, width: 100 }]);
      model.setVisible('a', true);
      expect(model.getById('a')!.visible).toBe(true);
    });

    it('does not emit when visibility unchanged', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.setVisible('name', true); // already visible
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── setPinned ────────────────────────────────────────────────────────────

  describe('setPinned', () => {
    it('pins a column to the left', () => {
      const { model } = makeModel();
      model.setPinned('name', 'left');
      expect(model.getById('name')!.pinned).toBe('left');
      expect(model.pinnedLeft.map((c) => c.colId)).toContain('name');
    });

    it('unpins a column', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'a', width: 100, pinned: 'left' }], bus);
      model.setPinned('a', null);
      expect(model.getById('a')!.pinned).toBeNull();
      expect(model.pinnedLeft).toHaveLength(0);
    });

    it('respects lockPinned', () => {
      const bus = new EventBus();
      const model = new ColumnModel([{ key: 'a', width: 100, lockPinned: true }], bus);
      model.setPinned('a', 'right');
      expect(model.getById('a')!.pinned).toBeNull(); // unchanged
    });

    it('does not emit when pinned state unchanged', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.setPinned('name', null); // already null
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── moveColumn ───────────────────────────────────────────────────────────

  describe('moveColumn', () => {
    it('moves a column to the specified index', () => {
      const { model } = makeModel();
      model.moveColumn('score', 0);
      expect(model.all[0].colId).toBe('score');
    });

    it('emits columnMoved event', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('columnMoved', handler);
      model.moveColumn('age', 0);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'columnMoved',
        colId: 'age',
      }));
    });

    it('does not move a locked column', () => {
      const bus = new EventBus();
      const model = new ColumnModel([
        { key: 'a', width: 100, lockPosition: true },
        { key: 'b', width: 100 },
      ], bus);
      const handler = vi.fn();
      bus.on('columnMoved', handler);
      model.moveColumn('a', 1);
      expect(model.all[0].colId).toBe('a');
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not emit when moving to the same index', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('columnMoved', handler);
      model.moveColumn('id', 0); // already at 0
      expect(handler).not.toHaveBeenCalled();
    });

    it('clamps toIndex to valid range', () => {
      const { model } = makeModel();
      model.moveColumn('id', 999);
      expect(model.all[model.all.length - 1].colId).toBe('id');
    });
  });

  // ─── setSort ─────────────────────────────────────────────────────────────

  describe('setSort', () => {
    it('sets sort direction on a column', () => {
      const { model } = makeModel();
      model.setSort('name', 'asc');
      expect(model.getById('name')!.sortDirection).toBe('asc');
      expect(model.getById('name')!.sortIndex).toBe(0);
    });

    it('clears sort when direction is null', () => {
      const { model } = makeModel();
      model.setSort('name', 'asc');
      model.setSort('name', null);
      expect(model.getById('name')!.sortDirection).toBeNull();
      expect(model.getById('name')!.sortIndex).toBeNull();
    });

    it('single sort clears other column sorts', () => {
      const { model } = makeModel();
      model.setSort('name', 'asc');
      model.setSort('age', 'desc');
      expect(model.getById('name')!.sortDirection).toBeNull();
      expect(model.getById('age')!.sortDirection).toBe('desc');
    });

    it('multiSort preserves other column sorts', () => {
      const { model } = makeModel();
      model.setSort('name', 'asc', true);
      model.setSort('age', 'desc', true);
      expect(model.getById('name')!.sortDirection).toBe('asc');
      expect(model.getById('age')!.sortDirection).toBe('desc');
    });

    it('emits sortChanged with full sort state', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      model.setSort('name', 'asc');
      expect(handler).toHaveBeenCalledOnce();
      const payload = handler.mock.calls[0][0];
      expect(payload.sortState).toHaveLength(1);
      expect(payload.sortState[0]).toMatchObject({ colId: 'name', direction: 'asc' });
    });

    it('emits empty sortState when all sorts cleared', () => {
      const { model, bus } = makeModel();
      model.setSort('name', 'asc');
      const handler = vi.fn();
      bus.on('sortChanged', handler);
      model.setSort('name', null);
      const payload = handler.mock.calls[0][0];
      expect(payload.sortState).toHaveLength(0);
    });
  });

  // ─── setFilter ────────────────────────────────────────────────────────────

  describe('setFilter', () => {
    it('marks column as filterActive when value is set', () => {
      const { model } = makeModel();
      model.setFilter('name', { type: 'text', operator: 'contains', value: 'alice' });
      expect(model.getById('name')!.filterActive).toBe(true);
    });

    it('clears filterActive when value is null', () => {
      const { model } = makeModel();
      model.setFilter('name', { type: 'text', operator: 'contains', value: 'x' });
      model.setFilter('name', null);
      expect(model.getById('name')!.filterActive).toBe(false);
    });

    it('emits filterChanged event', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('filterChanged', handler);
      model.setFilter('age', { type: 'number', operator: 'greaterThan', value: 18 });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].type).toBe('filterChanged');
    });
  });
});
