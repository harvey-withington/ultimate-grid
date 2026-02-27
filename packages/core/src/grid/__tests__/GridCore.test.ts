import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GridCore } from '../GridCore';
import type { GridOptions, GridPlugin, GridPluginContext, ColumnDef } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Person { id: number; name: string; age: number; city: string }

const DEFS: ColumnDef<Person>[] = [
  { key: 'id',   field: 'id',   headerName: 'ID',   width: 80  },
  { key: 'name', field: 'name', headerName: 'Name', width: 200 },
  { key: 'age',  field: 'age',  headerName: 'Age',  width: 100 },
  { key: 'city', field: 'city', headerName: 'City', width: 150 },
];

const DATA: Person[] = [
  { id: 1, name: 'Alice', age: 30, city: 'London' },
  { id: 2, name: 'Bob',   age: 25, city: 'Paris'  },
  { id: 3, name: 'Carol', age: 35, city: 'London' },
];

function makeOptions(overrides: Partial<GridOptions<Person>> = {}): GridOptions<Person> {
  return {
    columnDefs: DEFS,
    rowData: DATA,
    getRowId: (d) => String(d.id),
    ...overrides,
  };
}

function makeCore(overrides: Partial<GridOptions<Person>> = {}) {
  const core = new GridCore<Person>(makeOptions(overrides));
  const api = core.getApi();
  return { core, api };
}

describe('GridCore', () => {
  // ─── Construction ──────────────────────────────────────────────────────────

  describe('construction', () => {
    it('exposes eventBus, columnModel, rowModel, virtualScrollEngine', () => {
      const { core } = makeCore();
      expect(core.eventBus).toBeDefined();
      expect(core.columnModel).toBeDefined();
      expect(core.rowModel).toBeDefined();
      expect(core.virtualScrollEngine).toBeDefined();
    });

    it('loads rowData from options', () => {
      const { core } = makeCore();
      expect(core.rowModel.displayRowCount).toBe(3);
    });

    it('applies initialSort from options', () => {
      const { api } = makeCore({
        initialSort: [{ colId: 'age', direction: 'asc', index: 0 }],
      });
      expect(api.getSortModel()).toHaveLength(1);
      expect(api.getSortModel()[0].colId).toBe('age');
    });

    it('applies initialFilter from options', () => {
      const { api } = makeCore({
        initialFilter: { city: { type: 'text', operator: 'equals', value: 'london' } },
      });
      expect(api.getFilterModel()).toHaveProperty('city');
    });

    it('calls onGridReady with api', () => {
      const handler = vi.fn();
      makeCore({ onGridReady: handler });
      expect(handler).toHaveBeenCalledOnce();
      expect(typeof handler.mock.calls[0][0].setRowData).toBe('function');
    });
  });

  // ─── GridApi — row data ────────────────────────────────────────────────────

  describe('api.setRowData', () => {
    it('replaces all rows', () => {
      const { core, api } = makeCore();
      api.setRowData([{ id: 9, name: 'Zara', age: 20, city: 'Oslo' }]);
      expect(core.rowModel.displayRowCount).toBe(1);
    });

    it('emits rowDataChanged', () => {
      const { core, api } = makeCore();
      const handler = vi.fn();
      core.eventBus.on('rowDataChanged', handler);
      api.setRowData([]);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('api.updateRows', () => {
    it('merges partial data', () => {
      const { core, api } = makeCore();
      api.updateRows([{ rowId: '1', data: { age: 31 } }]);
      expect(core.rowModel.getRowById('1')!.data!.age).toBe(31);
    });
  });

  describe('api.addRows', () => {
    it('appends new rows', () => {
      const { core, api } = makeCore();
      api.addRows([{ id: 4, name: 'Dave', age: 28, city: 'Berlin' }]);
      expect(core.rowModel.displayRowCount).toBe(4);
    });
  });

  describe('api.removeRows', () => {
    it('removes specified rows', () => {
      const { core, api } = makeCore();
      api.removeRows(['1', '3']);
      expect(core.rowModel.displayRowCount).toBe(1);
    });
  });

  describe('api.getRowNode', () => {
    it('returns the row node for a valid id', () => {
      const { api } = makeCore();
      expect(api.getRowNode('2')!.data!.name).toBe('Bob');
    });

    it('returns null for unknown id', () => {
      const { api } = makeCore();
      expect(api.getRowNode('999')).toBeNull();
    });
  });

  // ─── GridApi — sort ────────────────────────────────────────────────────────

  describe('api.setSortModel / getSortModel', () => {
    it('sorts rows and updates sort model', () => {
      const { core, api } = makeCore();
      api.setSortModel([{ colId: 'age', direction: 'asc', index: 0 }]);
      expect(api.getSortModel()[0].colId).toBe('age');
      expect(core.rowModel.displayRows.map((r) => r.data!.age)).toEqual([25, 30, 35]);
    });

    it('clearing sort model removes sort', () => {
      const { api } = makeCore();
      api.setSortModel([{ colId: 'age', direction: 'asc', index: 0 }]);
      api.setSortModel([]);
      expect(api.getSortModel()).toHaveLength(0);
    });

    it('setSortModel emits sortChanged', () => {
      const { core, api } = makeCore();
      const handler = vi.fn();
      core.eventBus.on('sortChanged', handler);
      api.setSortModel([{ colId: 'name', direction: 'desc', index: 0 }]);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── GridApi — filter ──────────────────────────────────────────────────────

  describe('api.setFilterModel / getFilterModel', () => {
    it('filters rows and updates filter model', () => {
      const { core, api } = makeCore();
      api.setFilterModel({ city: { type: 'text', operator: 'equals', value: 'london' } });
      expect(core.rowModel.displayRowCount).toBe(2);
      expect(api.getFilterModel()).toHaveProperty('city');
    });

    it('clearing filter model restores all rows', () => {
      const { core, api } = makeCore();
      api.setFilterModel({ city: { type: 'text', operator: 'equals', value: 'london' } });
      api.setFilterModel({});
      expect(core.rowModel.displayRowCount).toBe(3);
    });

    it('setFilterModel emits filterChanged', () => {
      const { core, api } = makeCore();
      const handler = vi.fn();
      core.eventBus.on('filterChanged', handler);
      api.setFilterModel({ age: { type: 'number', operator: 'greaterThan', value: 28 } });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── GridApi — column mutations ────────────────────────────────────────────

  describe('api column mutations', () => {
    it('setColumnVisible hides a column', () => {
      const { core, api } = makeCore();
      api.setColumnVisible('age', false);
      expect(core.columnModel.getById('age')!.visible).toBe(false);
    });

    it('setColumnWidth updates column width', () => {
      const { core, api } = makeCore();
      api.setColumnWidth('name', 300);
      expect(core.columnModel.getById('name')!.width).toBe(300);
    });

    it('setColumnPinned pins a column', () => {
      const { core, api } = makeCore();
      api.setColumnPinned('id', 'left');
      expect(core.columnModel.getById('id')!.pinned).toBe('left');
    });

    it('moveColumn reorders columns', () => {
      const { core, api } = makeCore();
      api.moveColumn('city', 0);
      expect(core.columnModel.all[0].colId).toBe('city');
    });
  });

  // ─── GridApi — on (event subscription) ────────────────────────────────────

  describe('api.on', () => {
    it('subscribes to events and returns unsubscribe fn', () => {
      const { api } = makeCore();
      const handler = vi.fn();
      const unsub = api.on('rowDataChanged', handler);
      api.setRowData([]);
      expect(handler).toHaveBeenCalledOnce();
      unsub();
      api.setRowData([]);
      expect(handler).toHaveBeenCalledOnce(); // still 1 — not called again
    });
  });

  // ─── GridApi — getState / applyState ──────────────────────────────────────

  describe('api.getState / applyState', () => {
    it('getState returns column, sort, filter snapshots', () => {
      const { api } = makeCore();
      api.setSortModel([{ colId: 'age', direction: 'asc', index: 0 }]);
      const state = api.getState();
      expect(state.columns).toHaveLength(4);
      expect(state.sort).toHaveLength(1);
    });

    it('applyState restores sort', () => {
      const { core, api } = makeCore();
      api.applyState({ sort: [{ colId: 'age', direction: 'desc', index: 0 }] });
      expect(core.rowModel.displayRows[0].data!.age).toBe(35);
    });

    it('applyState restores filter', () => {
      const { core, api } = makeCore();
      api.applyState({
        filter: { city: { type: 'text', operator: 'equals', value: 'paris' } },
      });
      expect(core.rowModel.displayRowCount).toBe(1);
    });

    it('applyState restores column widths', () => {
      const { core, api } = makeCore();
      const state = api.getState();
      state.columns[1].width = 350; // name column
      api.applyState({ columns: state.columns });
      expect(core.columnModel.getById('name')!.width).toBe(350);
    });
  });

  // ─── Plugin system ─────────────────────────────────────────────────────────

  describe('plugin system', () => {
    it('calls plugin.init with context on construction', () => {
      const initFn = vi.fn();
      const plugin: GridPlugin = {
        pluginId: 'test-plugin',
        init: initFn,
        destroy: vi.fn(),
      };
      makeCore({ plugins: [plugin] });
      expect(initFn).toHaveBeenCalledOnce();
      const ctx: GridPluginContext = initFn.mock.calls[0][0];
      expect(ctx.eventBus).toBeDefined();
      expect(ctx.rowModel).toBeDefined();
      expect(ctx.columnModel).toBeDefined();
    });

    it('calls plugin.destroy on grid destroy', () => {
      const destroyFn = vi.fn();
      const plugin: GridPlugin = {
        pluginId: 'test-plugin',
        init: vi.fn(),
        destroy: destroyFn,
      };
      const { core } = makeCore({ plugins: [plugin] });
      core.getApi().destroy();
      expect(destroyFn).toHaveBeenCalledOnce();
    });

    it('does not register the same plugin twice', () => {
      const initFn = vi.fn();
      const plugin: GridPlugin = {
        pluginId: 'dupe-plugin',
        init: initFn,
        destroy: vi.fn(),
      };
      makeCore({ plugins: [plugin, plugin] });
      expect(initFn).toHaveBeenCalledOnce();
    });

    it('plugin can access other plugins via getPlugin', () => {
      let capturedGetPlugin: ((id: string) => GridPlugin | null) | null = null;
      const plugin: GridPlugin = {
        pluginId: 'ctx-test',
        init(ctx: GridPluginContext) { capturedGetPlugin = ctx.getPlugin; },
        destroy: vi.fn(),
      };
      makeCore({ plugins: [plugin] });
      expect(capturedGetPlugin).not.toBeNull();
      expect(capturedGetPlugin!('ctx-test')).toBe(plugin);
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears all event bus listeners on destroy', () => {
      const { core } = makeCore();
      core.eventBus.on('rowDataChanged', vi.fn());
      expect(core.eventBus.listenerCount('rowDataChanged')).toBeGreaterThan(0);
      core.getApi().destroy();
      expect(core.eventBus.listenerCount('rowDataChanged')).toBe(0);
    });

    it('calling destroy twice is safe', () => {
      const { api } = makeCore();
      api.destroy();
      expect(() => api.destroy()).not.toThrow();
    });
  });
});
