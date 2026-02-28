import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientRowModel } from '../ClientRowModel';
import { EventBus } from '../../events/EventBus';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Person {
  id: number;
  name: string;
  age: number;
  city: string;
  joined: string; // ISO date string
}

const ALICE:  Person = { id: 1, name: 'Alice',   age: 30, city: 'London',    joined: '2021-03-15' };
const BOB:    Person = { id: 2, name: 'Bob',     age: 25, city: 'Paris',     joined: '2022-07-01' };
const CAROL:  Person = { id: 3, name: 'Carol',   age: 35, city: 'London',    joined: '2020-01-10' };
const DAVE:   Person = { id: 4, name: 'Dave',    age: 28, city: 'Berlin',    joined: '2023-11-20' };
const EVE:    Person = { id: 5, name: 'Eve',     age: 22, city: 'Paris',     joined: '2019-06-05' };

const ALL = [ALICE, BOB, CAROL, DAVE, EVE];

function makeModel(rowIdFn?: (d: Person) => string) {
  const bus = new EventBus();
  const model = new ClientRowModel<Person>(bus, 40, rowIdFn ?? ((d) => String(d.id)));
  return { model, bus };
}

describe('ClientRowModel', () => {
  // ─── Construction ──────────────────────────────────────────────────────────

  describe('construction', () => {
    it('type is "client"', () => {
      const { model } = makeModel();
      expect(model.type).toBe('client');
    });

    it('starts empty', () => {
      const { model } = makeModel();
      expect(model.displayRowCount).toBe(0);
      expect(model.displayRows).toHaveLength(0);
    });
  });

  // ─── setRowData ────────────────────────────────────────────────────────────

  describe('setRowData', () => {
    it('populates displayRows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.displayRowCount).toBe(5);
    });

    it('assigns sequential displayIndex', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.displayRows.map((r) => r.displayIndex)).toEqual([0, 1, 2, 3, 4]);
    });

    it('uses provided rowIdFn', () => {
      const { model } = makeModel((d) => `person-${d.id}`);
      model.setRowData([ALICE]);
      expect(model.displayRows[0].rowId).toBe('person-1');
    });

    it('replacing data clears old rows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.setRowData([ALICE]);
      expect(model.displayRowCount).toBe(1);
      expect(model.getRowById('2')).toBeNull();
    });

    it('emits rowDataChanged event', () => {
      const { model, bus } = makeModel();
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.setRowData(ALL);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── getRowById / getRowByDisplayIndex ─────────────────────────────────────

  describe('lookup', () => {
    it('getRowById returns correct node', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.getRowById('3')!.data).toBe(CAROL);
    });

    it('getRowById returns null for unknown id', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.getRowById('999')).toBeNull();
    });

    it('getRowByDisplayIndex returns correct node', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.getRowByDisplayIndex(1)!.data).toBe(BOB);
    });

    it('getRowByDisplayIndex returns null for out-of-range index', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(model.getRowByDisplayIndex(99)).toBeNull();
    });
  });

  // ─── updateRows ───────────────────────────────────────────────────────────

  describe('updateRows', () => {
    it('merges partial data into existing node', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.updateRows([{ rowId: '1', data: { age: 31 } }]);
      expect(model.getRowById('1')!.data!.age).toBe(31);
      expect(model.getRowById('1')!.data!.name).toBe('Alice'); // unchanged
    });

    it('ignores updates for unknown rowId', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      expect(() => model.updateRows([{ rowId: 'nope', data: { age: 99 } }])).not.toThrow();
      expect(model.displayRowCount).toBe(5);
    });

    it('emits rowDataChanged', () => {
      const { model, bus } = makeModel();
      model.setRowData(ALL);
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.updateRows([{ rowId: '1', data: { age: 31 } }]);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── addRows ──────────────────────────────────────────────────────────────

  describe('addRows', () => {
    it('appends rows when no index given', () => {
      const { model } = makeModel();
      model.setRowData([ALICE, BOB]);
      const FRANK: Person = { id: 6, name: 'Frank', age: 40, city: 'Rome', joined: '2024-01-01' };
      model.addRows([FRANK]);
      expect(model.displayRowCount).toBe(3);
      expect(model.displayRows[2].data).toBe(FRANK);
    });

    it('inserts rows at specified index', () => {
      const { model } = makeModel();
      model.setRowData([ALICE, BOB, CAROL]);
      const FRANK: Person = { id: 6, name: 'Frank', age: 40, city: 'Rome', joined: '2024-01-01' };
      model.addRows([FRANK], 1);
      expect(model.displayRows[1].data).toBe(FRANK);
    });

    it('emits rowDataChanged', () => {
      const { model, bus } = makeModel();
      model.setRowData([ALICE]);
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.addRows([BOB]);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── removeRows ───────────────────────────────────────────────────────────

  describe('removeRows', () => {
    it('removes specified rows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.removeRows(['2', '4']);
      expect(model.displayRowCount).toBe(3);
      expect(model.getRowById('2')).toBeNull();
      expect(model.getRowById('4')).toBeNull();
    });

    it('remaining rows get contiguous displayIndex', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.removeRows(['1', '3', '5']);
      expect(model.displayRows.map((r) => r.displayIndex)).toEqual([0, 1]);
    });

    it('emits rowDataChanged', () => {
      const { model, bus } = makeModel();
      model.setRowData(ALL);
      const handler = vi.fn();
      bus.on('rowDataChanged', handler);
      model.removeRows(['1']);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── applySort ────────────────────────────────────────────────────────────

  describe('applySort', () => {
    it('sorts by single column asc', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([{ colId: 'age', direction: 'asc', index: 0 }]);
      expect(model.displayRows.map((r) => r.data!.age)).toEqual([22, 25, 28, 30, 35]);
    });

    it('sorts by single column desc', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([{ colId: 'age', direction: 'desc', index: 0 }]);
      expect(model.displayRows.map((r) => r.data!.age)).toEqual([35, 30, 28, 25, 22]);
    });

    it('sorts strings alphabetically asc', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([{ colId: 'name', direction: 'asc', index: 0 }]);
      expect(model.displayRows.map((r) => r.data!.name)).toEqual([
        'Alice', 'Bob', 'Carol', 'Dave', 'Eve',
      ]);
    });

    it('multi-column sort: primary city asc, secondary age asc', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([
        { colId: 'city', direction: 'asc', index: 0 },
        { colId: 'age',  direction: 'asc', index: 1 },
      ]);
      const names = model.displayRows.map((r) => r.data!.name);
      // Berlin: Dave; London: Alice(30), Carol(35); Paris: Eve(22), Bob(25)
      expect(names).toEqual(['Dave', 'Alice', 'Carol', 'Eve', 'Bob']);
    });

    it('clearing sort restores original order', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([{ colId: 'age', direction: 'asc', index: 0 }]);
      model.applySort([]);
      expect(model.displayRows.map((r) => r.data!.name)).toEqual([
        'Alice', 'Bob', 'Carol', 'Dave', 'Eve',
      ]);
    });

    it('sort re-assigns sequential displayIndex', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applySort([{ colId: 'age', direction: 'asc', index: 0 }]);
      expect(model.displayRows.map((r) => r.displayIndex)).toEqual([0, 1, 2, 3, 4]);
    });
  });

  // ─── applyFilter ──────────────────────────────────────────────────────────

  describe('applyFilter — text', () => {
    it('contains', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'contains', value: 'lon' } });
      expect(model.displayRowCount).toBe(2);
      expect(model.displayRows.map((r) => r.data!.city)).toEqual(['London', 'London']);
    });

    it('notContains', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'notContains', value: 'Paris' } });
      expect(model.displayRowCount).toBe(3);
    });

    it('equals (case-insensitive by default)', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'equals', value: 'LONDON' } });
      expect(model.displayRowCount).toBe(2);
    });

    it('equals (case-sensitive)', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'equals', value: 'LONDON', caseSensitive: true } });
      expect(model.displayRowCount).toBe(0);
    });

    it('startsWith', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ name: { type: 'text', operator: 'startsWith', value: 'a' } });
      expect(model.displayRowCount).toBe(1);
      expect(model.displayRows[0].data!.name).toBe('Alice');
    });

    it('endsWith', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ name: { type: 'text', operator: 'endsWith', value: 'e' } });
      // Alice, Dave, Eve
      expect(model.displayRowCount).toBe(3);
    });

    it('regex (case-insensitive by default)', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'regex', value: '^(l|p)', caseSensitive: false } });
      // London, Paris -> Alice, Bob, Carol, Eve
      expect(model.displayRowCount).toBe(4);
      const names = model.displayRows.map(r => r.data!.name).sort();
      expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Eve']);
    });

    it('regex (case-sensitive)', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'regex', value: '^L', caseSensitive: true } });
      // London -> Alice, Carol
      expect(model.displayRowCount).toBe(2);
      const names = model.displayRows.map(r => r.data!.name).sort();
      expect(names).toEqual(['Alice', 'Carol']);
    });
  });

  describe('applyFilter — number', () => {
    it('greaterThan', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ age: { type: 'number', operator: 'greaterThan', value: 28 } });
      expect(model.displayRowCount).toBe(2); // Alice(30), Carol(35)
    });

    it('lessThanOrEqual', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ age: { type: 'number', operator: 'lessThanOrEqual', value: 25 } });
      expect(model.displayRowCount).toBe(2); // Bob(25), Eve(22)
    });

    it('inRange', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ age: { type: 'number', operator: 'inRange', value: 25, valueTo: 30 } });
      expect(model.displayRowCount).toBe(3); // Bob(25), Dave(28), Alice(30)
    });
  });

  describe('applyFilter — date', () => {
    it('after', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ joined: { type: 'date', operator: 'after', value: '2022-01-01' } });
      // Bob(2022-07-01), Dave(2023-11-20)
      expect(model.displayRowCount).toBe(2);
    });

    it('inRange', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({
        joined: { type: 'date', operator: 'inRange', value: '2020-01-01', valueTo: '2022-12-31' },
      });
      // Carol(2020-01-10), Alice(2021-03-15), Bob(2022-07-01)
      expect(model.displayRowCount).toBe(3);
    });
  });

  describe('applyFilter — set', () => {
    it('matches values in the set', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'set', values: ['Paris', 'Berlin'] } });
      expect(model.displayRowCount).toBe(3); // Bob, Dave, Eve
    });
  });

  describe('applyFilter — custom', () => {
    it('applies custom predicate', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({
        age: {
          type: 'custom',
          predicate: (val) => typeof val === 'number' && val % 2 === 0,
        },
      });
      // Alice(30), Dave(28), Eve(22) — even ages
      expect(model.displayRowCount).toBe(3);
    });
  });

  describe('applyFilter — multi-column', () => {
    it('AND-combines multiple column filters', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({
        city: { type: 'text', operator: 'equals', value: 'paris' },
        age:  { type: 'number', operator: 'greaterThan', value: 23 },
      });
      // Paris: Bob(25), Eve(22) → only Bob passes age > 23
      expect(model.displayRowCount).toBe(1);
      expect(model.displayRows[0].data!.name).toBe('Bob');
    });

    it('clearing filter restores all rows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'equals', value: 'London' } });
      model.applyFilter({});
      expect(model.displayRowCount).toBe(5);
    });
  });

  // ─── sort + filter combined ────────────────────────────────────────────────

  describe('sort + filter combined', () => {
    it('filters first then sorts', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.applyFilter({ city: { type: 'text', operator: 'equals', value: 'paris' } });
      model.applySort([{ colId: 'age', direction: 'desc', index: 0 }]);
      expect(model.displayRows.map((r) => r.data!.name)).toEqual(['Bob', 'Eve']);
    });
  });

  // ─── pinnedTopRows / pinnedBottomRows ─────────────────────────────────────

  describe('pinned rows', () => {
    it('pinned rows do not appear in displayRows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      const node = model.getRowById('1')!;
      node.pinned = 'top';
      model.applySort([]); // trigger rebuild
      expect(model.displayRowCount).toBe(4);
      expect(model.pinnedTopRows).toHaveLength(1);
    });

    it('pinnedBottomRows separates bottom-pinned rows', () => {
      const { model } = makeModel();
      model.setRowData(ALL);
      model.getRowById('5')!.pinned = 'bottom';
      model.applySort([]);
      expect(model.pinnedBottomRows).toHaveLength(1);
      expect(model.pinnedBottomRows[0].data!.name).toBe('Eve');
    });
  });
});
