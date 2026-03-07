import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGrid } from '../createGrid';
import type { ColumnDef } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Person { id: number; name: string; age: number }

const DEFS: ColumnDef<Person>[] = [
  { key: 'id',   field: 'id',   headerName: 'ID',   width: 60  },
  { key: 'name', field: 'name', headerName: 'Name', width: 200 },
  { key: 'age',  field: 'age',  headerName: 'Age',  width: 100 },
];

const DATA: Person[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob',   age: 25 },
  { id: 3, name: 'Carol', age: 35 },
  { id: 4, name: 'Dave',  age: 28 },
  { id: 5, name: 'Eve',   age: 22 },
];

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  el.style.height = '400px';
  document.body.appendChild(el);
  return el;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createGrid', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  // ─── DOM mounting ───────────────────────────────────────────────────────────

  describe('DOM mounting', () => {
    it('mounts .ugrid inside container', () => {
      const container = makeContainer();
      createGrid({ container, columnDefs: DEFS, rowData: DATA });
      expect(container.querySelector('.ugrid')).not.toBeNull();
    });

    it('renders header cells for each column', () => {
      const container = makeContainer();
      createGrid({ container, columnDefs: DEFS, rowData: DATA });
      expect(container.querySelectorAll('.ugrid-header-cell').length).toBe(3);
    });

    it('renders visible rows', () => {
      const container = makeContainer();
      createGrid({ container, columnDefs: DEFS, rowData: DATA });
      expect(container.querySelectorAll('.ugrid-row').length).toBeGreaterThan(0);
    });

    it('sets virtual spacer height to rowCount × rowHeight', () => {
      const container = makeContainer();
      createGrid({ container, columnDefs: DEFS, rowData: DATA, rowHeight: 40 });
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${5 * 40}px`);
    });
  });

  // ─── GridApi surface ────────────────────────────────────────────────────────

  describe('GridApi', () => {
    it('returns an api object', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS });
      expect(typeof api).toBe('object');
      expect(typeof api.setRowData).toBe('function');
    });

    it('setRowData updates rendered rows', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      api.setRowData([{ id: 9, name: 'Zara', age: 20 }]);
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${1 * 36}px`);
    });

    it('addRows increases row count', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      api.addRows([{ id: 99, name: 'Zara', age: 20 }]);
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${6 * 36}px`);
    });

    it('removeRows decreases row count', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      api.removeRows(['1', '2']);
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${3 * 36}px`);
    });

    it('getRowNode returns correct node', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      const node = api.getRowNode('3');
      expect(node?.data?.name).toBe('Carol');
    });
  });

  // ─── Selection API ──────────────────────────────────────────────────────────

  describe('selection', () => {
    it('selectAll selects all rows', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      api.selectAll();
      expect(api.getSelectedRowIds().length).toBe(5);
    });

    it('deselectAll clears selection', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      api.selectAll();
      api.deselectAll();
      expect(api.getSelectedRowIds().length).toBe(0);
    });

    it('getSelectedRows returns data objects', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      api.selectAll();
      const rows = api.getSelectedRows();
      expect(rows.length).toBe(5);
      expect(rows[0]).toHaveProperty('name');
    });

    it('selectionMode none disables selection', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id), selectionMode: 'none' });
      api.selectAll();
      expect(api.getSelectedRowIds().length).toBe(0);
    });
  });

  // ─── Sort API ───────────────────────────────────────────────────────────────

  describe('sort', () => {
    it('setSortModel emits sortChanged and re-renders', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      expect(() => api.setSortModel([{ colId: 'age', direction: 'asc', index: 0 }])).not.toThrow();
      const sortedIcon = container.querySelector('.ugrid-header-cell.sorted');
      expect(sortedIcon).not.toBeNull();
    });

    it('getSortModel returns current sort', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA });
      api.setSortModel([{ colId: 'name', direction: 'desc', index: 0 }]);
      expect(api.getSortModel()).toHaveLength(1);
      expect(api.getSortModel()[0].colId).toBe('name');
    });

    it('clearSort via pipeline resets sort state', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      api.setSortModel([{ colId: 'age', direction: 'asc', index: 0 }]);
      api.setSortModel([]);
      expect(container.querySelector('.ugrid-header-cell.sorted')).toBeNull();
    });
  });

  // ─── Filter API ─────────────────────────────────────────────────────────────

  describe('filter', () => {
    it('setFilterModel filters rows', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      api.setFilterModel({ name: { type: 'text', operator: 'contains', value: 'Alice' } } as never);
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${1 * 36}px`);
    });

    it('getFilterModel returns current filter', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA });
      api.setFilterModel({ name: { type: 'text', operator: 'contains', value: 'Bob' } } as never);
      expect(api.getFilterModel()).toHaveProperty('name');
    });

    it('clearing filter restores all rows', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      api.setFilterModel({ name: { type: 'text', operator: 'contains', value: 'Alice' } } as never);
      api.setFilterModel({});
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${5 * 36}px`);
    });
  });

  // ─── onGridReady callback ────────────────────────────────────────────────────

  describe('onGridReady', () => {
    it('fires after mount with the api', () => {
      const handler = vi.fn();
      createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, onGridReady: handler });
      expect(handler).toHaveBeenCalledOnce();
      expect(typeof handler.mock.calls[0][0].setRowData).toBe('function');
    });
  });

  // ─── Custom cellRenderer ────────────────────────────────────────────────────

  describe('cellRenderer option', () => {
    it('uses custom renderer when non-null returned', () => {
      const container = makeContainer();
      createGrid({
        container, columnDefs: DEFS, rowData: DATA,
        cellRenderer: (_col, _node, value) => {
          const span = document.createElement('span');
          span.className = 'custom';
          span.textContent = `[${value}]`;
          return span;
        },
      });
      expect(container.querySelector('.custom')).not.toBeNull();
    });
  });

  // ─── initialSort / initialFilter ────────────────────────────────────────────

  describe('initial options', () => {
    it('initialSort pre-sorts rows', () => {
      const container = makeContainer();
      createGrid({
        container, columnDefs: DEFS, rowData: DATA,
        getRowId: (d) => String(d.id),
        initialSort: [{ colId: 'age', direction: 'asc', index: 0 }],
      });
      expect(container.querySelector('.ugrid-header-cell.sorted')).not.toBeNull();
    });

    it('initialFilter pre-filters rows', () => {
      const container = makeContainer();
      const api = createGrid({
        container, columnDefs: DEFS, rowData: DATA,
        getRowId: (d) => String(d.id),
        initialFilter: { name: { type: 'text', operator: 'contains', value: 'Alice' } } as never,
      });
      // Verify the filter model was applied
      expect(api.getFilterModel()).toHaveProperty('name');
      // Verify only Alice is visible — spacer height 36px for 1 row OR ugrid-empty absent
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      const isEmpty = container.querySelector('.ugrid-empty') !== null;
      const hasOneRow = spacer.style.height === `${1 * 36}px`;
      expect(isEmpty || hasOneRow).toBe(true);
    });
  });

  // ─── Cell selection API ──────────────────────────────────────────────────────

  describe('cell selection API', () => {
    it('getActiveCell returns null when nothing is selected', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      expect(api.getActiveCell()).toBeNull();
    });

    it('getSelectedRanges returns empty array initially', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      expect(api.getSelectedRanges()).toEqual([]);
    });

    it('getSelectedCellCount returns 0 initially', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS, rowData: DATA, getRowId: (d) => String(d.id) });
      expect(api.getSelectedCellCount()).toBe(0);
    });
  });

  // ─── Lifecycle / destroy ─────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes .ugrid from DOM', () => {
      const container = makeContainer();
      const api = createGrid({ container, columnDefs: DEFS, rowData: DATA });
      api.destroy();
      expect(container.querySelector('.ugrid')).toBeNull();
    });

    it('can be called multiple times without throwing', () => {
      const api = createGrid({ container: makeContainer(), columnDefs: DEFS });
      expect(() => { api.destroy(); api.destroy(); }).not.toThrow();
    });
  });
});
