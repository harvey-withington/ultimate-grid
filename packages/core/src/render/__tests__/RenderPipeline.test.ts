import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderPipeline } from '../RenderPipeline';
import { EventBus } from '../../events/EventBus';
import { ColumnModel } from '../../column/ColumnModel';
import { ClientRowModel } from '../../row/ClientRowModel';
import { SelectionModel } from '../../selection/SelectionModel';
import type { ColumnDef, GridApi } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Person { id: number; name: string; age: number; city: string }

const DEFS: ColumnDef<Person>[] = [
  { key: 'id',   field: 'id',   headerName: 'ID',   width: 60  },
  { key: 'name', field: 'name', headerName: 'Name', width: 200 },
  { key: 'age',  field: 'age',  headerName: 'Age',  width: 100 },
  { key: 'city', field: 'city', headerName: 'City', width: 150 },
];

const DATA: Person[] = [
  { id: 1, name: 'Alice', age: 30, city: 'London' },
  { id: 2, name: 'Bob',   age: 25, city: 'Paris'  },
  { id: 3, name: 'Carol', age: 35, city: 'London' },
  { id: 4, name: 'Dave',  age: 28, city: 'Berlin' },
  { id: 5, name: 'Eve',   age: 22, city: 'Paris'  },
];

function makeStubApi(rowModel: ClientRowModel<Person>, colModel: ColumnModel<Person>): GridApi<Person> {
  return {
    setRowData: (d: Person[]) => rowModel.setRowData(d),
    updateRows: (u: import('../../types').RowUpdate<Person>[]) => rowModel.updateRows(u),
    addRows: (r: Person[], i?: number) => rowModel.addRows(r, i),
    removeRows: (ids: string[]) => rowModel.removeRows(ids),
    getRowNode: (id: string) => rowModel.getRowById(id),
    selectAll: vi.fn(),
    deselectAll: vi.fn(),
    getSelectedRowIds: () => [],
    getSelectedRows: () => [],
    setSortModel: vi.fn(),
    getSortModel: () => [],
    setFilterModel: vi.fn(),
    getFilterModel: () => ({}),
    setColumnVisible: vi.fn(),
    setColumnWidth: vi.fn(),
    setColumnPinned: vi.fn(),
    moveColumn: vi.fn(),
    autoSizeColumn: vi.fn(),
    autoSizeAllColumns: vi.fn(),
    scrollToRow: vi.fn(),
    scrollToColumn: vi.fn(),
    ensureCellVisible: vi.fn(),
    startEditing: vi.fn(),
    stopEditing: vi.fn(),
    exportToCsv: vi.fn(),
    exportToExcel: vi.fn(),
    getState: vi.fn(),
    applyState: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  } as unknown as GridApi<Person>;
}

function makeSetup() {
  const bus      = new EventBus();
  const colModel = new ColumnModel<Person>(DEFS, bus);
  const rowModel = new ClientRowModel<Person>(bus, 36, (d) => String(d.id));
  rowModel.setRowData(DATA);
  const selModel = new SelectionModel(bus, rowModel, 'multi', 'row');
  const api      = makeStubApi(rowModel, colModel);
  const container = document.createElement('div');
  container.style.height = '400px';
  document.body.appendChild(container);

  const pipeline = new RenderPipeline<Person>(
    container, bus, colModel, rowModel, selModel, api,
    { rowHeight: 36, overscan: 2 },
  );
  pipeline.mount();

  return { bus, colModel, rowModel, selModel, api, container, pipeline };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RenderPipeline', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── DOM structure ──────────────────────────────────────────────────────────

  describe('DOM structure', () => {
    it('mounts .ugrid inside container', () => {
      const { container } = makeSetup();
      expect(container.querySelector('.ugrid')).not.toBeNull();
    });

    it('renders .ugrid-header', () => {
      const { container } = makeSetup();
      expect(container.querySelector('.ugrid-header')).not.toBeNull();
    });

    it('renders .ugrid-filter-row', () => {
      const { container } = makeSetup();
      expect(container.querySelector('.ugrid-filter-row')).not.toBeNull();
    });

    it('renders .ugrid-body', () => {
      const { container } = makeSetup();
      expect(container.querySelector('.ugrid-body')).not.toBeNull();
    });

    it('removes .ugrid on destroy', () => {
      const { container, pipeline } = makeSetup();
      pipeline.destroy();
      expect(container.querySelector('.ugrid')).toBeNull();
    });
  });

  // ─── Header ─────────────────────────────────────────────────────────────────

  describe('header', () => {
    it('renders one header cell per visible column', () => {
      const { container } = makeSetup();
      const cells = container.querySelectorAll('.ugrid-header-cell');
      expect(cells.length).toBe(4);
    });

    it('header cells have correct column labels', () => {
      const { container } = makeSetup();
      const labels = [...container.querySelectorAll('.ugrid-header-label')]
        .map((el) => (el as HTMLElement).textContent);
      expect(labels).toEqual(['ID', 'Name', 'Age', 'City']);
    });

    it('header cells carry data-col-id', () => {
      const { container } = makeSetup();
      const ids = [...container.querySelectorAll<HTMLElement>('.ugrid-header-cell')]
        .map((el) => el.dataset.colId);
      expect(ids).toEqual(['id', 'name', 'age', 'city']);
    });
  });

  // ─── Filter row ─────────────────────────────────────────────────────────────

  describe('filter row', () => {
    it('renders one input per visible column', () => {
      const { container } = makeSetup();
      const inputs = container.querySelectorAll('.ugrid-filter-row input');
      expect(inputs.length).toBe(4);
    });

    it('typing in filter input calls api.setFilterModel', () => {
      const { container, api } = makeSetup();
      const input = container.querySelector<HTMLInputElement>('.ugrid-filter-cell input')!;
      input.value = 'lon';
      input.dispatchEvent(new Event('input'));
      expect(api.setFilterModel).toHaveBeenCalled();
    });
  });

  // ─── Row rendering ──────────────────────────────────────────────────────────

  describe('row rendering', () => {
    it('renders visible rows inside .ugrid-rows', () => {
      const { container } = makeSetup();
      const rows = container.querySelectorAll('.ugrid-row');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(5);
    });

    it('rows carry data-row-id and data-display-index', () => {
      const { container } = makeSetup();
      const firstRow = container.querySelector<HTMLElement>('.ugrid-row')!;
      expect(firstRow.dataset.rowId).toBeDefined();
      expect(firstRow.dataset.displayIndex).toBeDefined();
    });

    it('renders one cell per column in each row', () => {
      const { container } = makeSetup();
      const firstRow = container.querySelector('.ugrid-row')!;
      expect(firstRow.querySelectorAll('.ugrid-cell').length).toBe(4);
    });

    it('cells contain the correct field values', () => {
      const { container } = makeSetup();
      const firstRow = container.querySelector('.ugrid-row')!;
      const cells = firstRow.querySelectorAll('.ugrid-cell');
      expect(cells[0].textContent).toBe('1');   // id
      expect(cells[1].textContent).toBe('Alice'); // name
    });

    it('re-renders on rowDataChanged event', () => {
      const { bus, rowModel, container } = makeSetup();
      rowModel.setRowData([{ id: 9, name: 'Zara', age: 20, city: 'Oslo' }]);
      const rows = container.querySelectorAll('.ugrid-row');
      expect(rows.length).toBe(1);
      const cell = rows[0].querySelectorAll('.ugrid-cell')[1];
      expect(cell.textContent).toBe('Zara');
    });

    it('shows empty state when no rows match', () => {
      const { rowModel, container } = makeSetup();
      rowModel.setRowData([]);
      expect(container.querySelector('.ugrid-empty')).not.toBeNull();
      expect(container.querySelectorAll('.ugrid-row').length).toBe(0);
    });
  });

  // ─── Virtual spacer ─────────────────────────────────────────────────────────

  describe('virtual spacer', () => {
    it('spacer height = rowCount × rowHeight', () => {
      const { container } = makeSetup();
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${5 * 36}px`);
    });

    it('spacer height updates when rows are removed', () => {
      const { rowModel, container } = makeSetup();
      rowModel.removeRows(['1', '2']);
      const spacer = container.querySelector<HTMLElement>('.ugrid-spacer')!;
      expect(spacer.style.height).toBe(`${3 * 36}px`);
    });
  });

  // ─── Selection ──────────────────────────────────────────────────────────────

  describe('selection', () => {
    it('selected rows get ugrid-row--selected class', () => {
      const { selModel, bus, container } = makeSetup();
      selModel.selectRow('1');
      // selectionChanged fires → _refreshSelectionClasses
      const selectedRows = container.querySelectorAll('.ugrid-row--selected');
      expect(selectedRows.length).toBe(1);
      expect((selectedRows[0] as HTMLElement).dataset.rowId).toBe('1');
    });

    it('clicking a row toggles selection', () => {
      const { selModel, container } = makeSetup();
      const firstRow = container.querySelector<HTMLElement>('.ugrid-row')!;
      firstRow.click();
      expect(selModel.selectedRowIds.size).toBe(1);
    });

    it('clicking selected row deselects it', () => {
      const { selModel, container } = makeSetup();
      const firstRow = container.querySelector<HTMLElement>('.ugrid-row')!;
      firstRow.click(); // select
      firstRow.click(); // deselect
      expect(selModel.selectedRowIds.size).toBe(0);
    });

    it('ctrl+mousedown on unselected row adds to selection', () => {
      const { selModel, container } = makeSetup();
      const rows = container.querySelectorAll<HTMLElement>('.ugrid-row');
      const first  = rows[0];
      const second = rows[1];
      first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: false }));
      second.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: true }));
      expect(selModel.selectedRowIds.size).toBe(2);
    });

    it('ctrl+mousedown on selected row deselects it', () => {
      const { selModel, container } = makeSetup();
      const rows = container.querySelectorAll<HTMLElement>('.ugrid-row');
      const first  = rows[0];
      const second = rows[1];
      // Select both rows first
      first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: false }));
      second.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: true }));
      expect(selModel.selectedRowIds.size).toBe(2);
      // Ctrl+click first row to deselect it
      first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: true }));
      expect(selModel.selectedRowIds.size).toBe(1);
      expect(selModel.isRowSelected(second.dataset.rowId!)).toBe(true);
      expect(selModel.isRowSelected(first.dataset.rowId!)).toBe(false);
    });
  });

  // ─── Sort ───────────────────────────────────────────────────────────────────

  describe('sort indicators', () => {
    it('sortChanged event updates header sort icon', () => {
      const { bus, container } = makeSetup();
      bus.emit('sortChanged', {
        type: 'sortChanged',
        source: 'api',
        sortState: [{ colId: 'age', direction: 'asc', index: 0 }],
      });
      const ageHeader = container.querySelector<HTMLElement>(
        '.ugrid-header-cell[data-col-id="age"]',
      )!;
      expect(ageHeader.classList.contains('sorted')).toBe(true);
      expect(ageHeader.querySelector('.ugrid-sort-icon')!.textContent).toContain('↑');
    });

    it('clearing sort removes icon', () => {
      const { bus, container } = makeSetup();
      bus.emit('sortChanged', {
        type: 'sortChanged', source: 'api',
        sortState: [{ colId: 'age', direction: 'asc', index: 0 }],
      });
      bus.emit('sortChanged', { type: 'sortChanged', source: 'api', sortState: [] });
      const ageHeader = container.querySelector<HTMLElement>(
        '.ugrid-header-cell[data-col-id="age"]',
      )!;
      expect(ageHeader.classList.contains('sorted')).toBe(false);
    });

    it('plain header click replaces sort', () => {
      const { container, colModel } = makeSetup();
      const nameHeader = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="name"]')!;
      const ageHeader  = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="age"]')!;
      nameHeader.click(); // sort by name asc
      ageHeader.click();  // replaces — sort by age asc only
      expect(colModel.sortState.length).toBe(1);
      expect(colModel.sortState[0].colId).toBe('age');
    });

    it('ctrl+click header adds secondary sort', () => {
      const { container, colModel } = makeSetup();
      const nameHeader = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="name"]')!;
      const ageHeader  = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="age"]')!;
      nameHeader.click(); // primary sort: name asc
      ageHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      expect(colModel.sortState.length).toBe(2);
      const colIds = colModel.sortState.map((s) => s.colId);
      expect(colIds).toContain('name');
      expect(colIds).toContain('age');
    });

    it('ctrl+click already-sorted header cycles its direction without clearing other sorts', () => {
      const { container, colModel } = makeSetup();
      const nameHeader = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="name"]')!;
      const ageHeader  = container.querySelector<HTMLElement>('.ugrid-header-cell[data-col-id="age"]')!;
      nameHeader.click(); // name asc
      ageHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); // age asc (secondary)
      ageHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); // age desc
      expect(colModel.sortState.length).toBe(2);
      const age = colModel.sortState.find((s) => s.colId === 'age')!;
      expect(age.direction).toBe('desc');
    });
  });

  // ─── Custom cell renderer ────────────────────────────────────────────────────

  describe('cellRenderer option', () => {
    it('uses custom renderer when provided and returns non-null', () => {
      const bus      = new EventBus();
      const colModel = new ColumnModel<Person>(DEFS, bus);
      const rowModel = new ClientRowModel<Person>(bus, 36, (d) => String(d.id));
      rowModel.setRowData(DATA);
      const selModel = new SelectionModel(bus, rowModel, 'multi', 'row');
      const api      = makeStubApi(rowModel, colModel);
      const container = document.createElement('div');
      document.body.appendChild(container);

      const pipeline = new RenderPipeline<Person>(
        container, bus, colModel, rowModel, selModel, api,
        {
          rowHeight: 36,
          cellRenderer: (_col, _node, value) => {
            const span = document.createElement('span');
            span.className = 'custom-cell';
            span.textContent = `[${value}]`;
            return span;
          },
        },
      );
      pipeline.mount();

      const custom = container.querySelector('.custom-cell');
      expect(custom).not.toBeNull();
      expect(custom!.textContent).toMatch(/^\[.+\]$/);
    });

    it('resolves built-in "spreadsheet" renderer by name', () => {
      const bus      = new EventBus();
      const SPREAD_DEFS = [
        { key: 'row', field: 'row', headerName: '', width: 50, rowHeader: true },
        { key: 'A',   field: 'A',   headerName: 'A', width: 100 },
      ];
      const colModel = new ColumnModel(SPREAD_DEFS, bus);
      const rowModel = new ClientRowModel(bus, 28, (d: any) => String(d.row));
      rowModel.setRowData([{ row: 1, A: 42 }]);
      const selModel = new SelectionModel(bus, rowModel, 'multi', 'cell');
      const api      = makeStubApi(rowModel, colModel);
      const container = document.createElement('div');
      document.body.appendChild(container);

      const pipeline = new RenderPipeline(
        container, bus, colModel, rowModel, selModel, api,
        { rowHeight: 28, cellRenderer: 'spreadsheet' },
      );
      pipeline.mount();

      // Row header cell should contain a span with the row number
      const rowHeaderCell = container.querySelector('.ugrid-cell--row-header');
      expect(rowHeaderCell).not.toBeNull();
      expect(rowHeaderCell!.querySelector('span')!.textContent).toBe('1');

      // Numeric cell should have tabular-nums styling
      const cells = container.querySelectorAll('.ugrid-cell:not(.ugrid-cell--row-header)');
      const numSpan = cells[0]?.querySelector('span');
      expect(numSpan).not.toBeNull();
      expect(numSpan!.style.fontVariantNumeric).toBe('tabular-nums');
      expect(numSpan!.textContent).toBe('42');
    });

    it('falls back to default when custom renderer returns null', () => {
      const bus      = new EventBus();
      const colModel = new ColumnModel<Person>(DEFS, bus);
      const rowModel = new ClientRowModel<Person>(bus, 36, (d) => String(d.id));
      rowModel.setRowData([DATA[0]]);
      const selModel = new SelectionModel(bus, rowModel, 'multi', 'row');
      const api      = makeStubApi(rowModel, colModel);
      const container = document.createElement('div');
      document.body.appendChild(container);

      const pipeline = new RenderPipeline<Person>(
        container, bus, colModel, rowModel, selModel, api,
        { rowHeight: 36, cellRenderer: () => null },
      );
      pipeline.mount();

      const cells = container.querySelectorAll('.ugrid-cell');
      expect(cells[1].textContent).toBe('Alice');
    });
  });

  // ─── clearFilters / clearSort ─────────────────────────────────────────────

  describe('imperative API', () => {
    it('clearFilters resets all filter inputs and calls api.setFilterModel', () => {
      const { container, api, pipeline } = makeSetup();
      const input = container.querySelector<HTMLInputElement>('.ugrid-filter-cell input')!;
      input.value = 'test';
      input.dispatchEvent(new Event('input'));
      pipeline.clearFilters();
      expect(input.value).toBe('');
      expect(api.setFilterModel).toHaveBeenLastCalledWith({});
    });

    it('clearSort calls api.setSortModel with empty array', () => {
      const { api, pipeline } = makeSetup();
      pipeline.clearSort();
      expect(api.setSortModel).toHaveBeenCalledWith([]);
    });

    it('refresh re-renders header and rows', () => {
      const { pipeline, container } = makeSetup();
      expect(() => pipeline.refresh()).not.toThrow();
      expect(container.querySelectorAll('.ugrid-header-cell').length).toBe(4);
    });
  });

  // ─── Accessors ───────────────────────────────────────────────────────────────

  describe('accessors', () => {
    it('rootEl returns the .ugrid element', () => {
      const { pipeline } = makeSetup();
      expect(pipeline.rootEl.classList.contains('ugrid')).toBe(true);
    });

    it('bodyEl returns the .ugrid-body element', () => {
      const { pipeline } = makeSetup();
      expect(pipeline.bodyEl.classList.contains('ugrid-body')).toBe(true);
    });
  });
});
