import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualScrollEngine } from '../VirtualScrollEngine';

// Helper: build a number[] of `count` elements all set to `value`
function colArray(count: number, value: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < count; i++) arr.push(value);
  return arr;
}

// ─── Minimal HTMLElement stub for node environment ────────────────────────────
interface StubContainer extends HTMLElement {
  _listeners: Record<string, EventListenerOrEventListenerObject[]>;
}

function makeContainer(
  clientWidth = 800,
  clientHeight = 400,
): StubContainer {
  const _listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  const el: StubContainer = {
    clientWidth,
    clientHeight,
    scrollTop: 0,
    scrollLeft: 0,
    _listeners,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (!_listeners[type]) _listeners[type] = [];
      _listeners[type].push(listener);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (!_listeners[type]) return;
      _listeners[type] = _listeners[type].filter(
        (l: EventListenerOrEventListenerObject) => l !== listener,
      );
    },
  } as unknown as StubContainer;
  return el;
}

function makeViewport(overrides: Partial<{
  width: number; height: number; scrollLeft: number; scrollTop: number;
  rowOverscan: number; colOverscan: number;
}> = {}) {
  return {
    width: overrides.width ?? 800,
    height: overrides.height ?? 400,
    scrollLeft: overrides.scrollLeft ?? 0,
    scrollTop: overrides.scrollTop ?? 0,
    rowRange: { start: 0, end: 0 },
    colRange: { start: 0, end: 0 },
    rowOverscan: overrides.rowOverscan ?? 3,
    colOverscan: overrides.colOverscan ?? 2,
    totalHeight: 0,
    totalWidth: 0,
  };
}

describe('VirtualScrollEngine', () => {
  let engine: VirtualScrollEngine;
  let container: StubContainer;

  beforeEach(() => {
    engine = new VirtualScrollEngine();
    container = makeContainer();
    engine.init(container, makeViewport());
  });

  // ─── Row height index ───────────────────────────────────────────────────────

  describe('row height index', () => {
    it('getTotalHeight returns 0 before initRows', () => {
      expect(engine.getTotalHeight()).toBe(0);
    });

    it('initRows sets uniform heights', () => {
      engine.initRows(10, 40);
      expect(engine.getTotalHeight()).toBe(400);
      expect(engine.getRowOffset(0)).toBe(0);
      expect(engine.getRowOffset(1)).toBe(40);
      expect(engine.getRowOffset(9)).toBe(360);
    });

    it('getRowOffset returns 0 for index 0', () => {
      engine.initRows(5, 40);
      expect(engine.getRowOffset(0)).toBe(0);
    });

    it('getRowOffset accumulates correctly', () => {
      engine.initRows(3, 40);
      engine.setRowHeight(1, 80); // [40, 80, 40]
      expect(engine.getRowOffset(0)).toBe(0);
      expect(engine.getRowOffset(1)).toBe(40);
      expect(engine.getRowOffset(2)).toBe(120);
    });

    it('setRowHeight updates total and offsets', () => {
      engine.initRows(4, 40);      // total = 160
      engine.setRowHeight(2, 100); // total = 220
      expect(engine.getTotalHeight()).toBe(220);
      expect(engine.getRowOffset(3)).toBe(180); // 40+40+100 = offset of row 3
    });

    it('setRowHeight no-op when height unchanged', () => {
      engine.initRows(4, 40);
      engine.setRowHeight(0, 40); // same value
      expect(engine.getTotalHeight()).toBe(160);
    });

    it('getRowAtOffset maps pixel to row index (uniform)', () => {
      engine.initRows(5, 40); // offsets: 0, 40, 80, 120, 160
      expect(engine.getRowAtOffset(0)).toBe(0);
      expect(engine.getRowAtOffset(20)).toBe(0);
      expect(engine.getRowAtOffset(39)).toBe(0);
      expect(engine.getRowAtOffset(40)).toBe(1);
      expect(engine.getRowAtOffset(79)).toBe(1);
      expect(engine.getRowAtOffset(80)).toBe(2);
      expect(engine.getRowAtOffset(160)).toBe(4);
      expect(engine.getRowAtOffset(199)).toBe(4);
    });

    it('getRowAtOffset maps pixel to row index (variable)', () => {
      engine.initRows(4, 40);
      engine.setRowHeight(1, 80); // [40, 80, 40, 40] → offsets [0, 40, 120, 160]
      expect(engine.getRowAtOffset(0)).toBe(0);
      expect(engine.getRowAtOffset(39)).toBe(0);
      expect(engine.getRowAtOffset(40)).toBe(1);
      expect(engine.getRowAtOffset(119)).toBe(1);
      expect(engine.getRowAtOffset(120)).toBe(2);
      expect(engine.getRowAtOffset(160)).toBe(3);
    });

    it('getRowAtOffset clamps to valid range', () => {
      engine.initRows(3, 40);
      expect(engine.getRowAtOffset(-10)).toBe(0);
      expect(engine.getRowAtOffset(10000)).toBe(2);
    });

    it('ignores setRowHeight for out-of-range index (no throw)', () => {
      engine.initRows(3, 40);
      expect(() => engine.setRowHeight(-1, 100)).not.toThrow();
      expect(() => engine.setRowHeight(99, 100)).not.toThrow();
      expect(engine.getTotalHeight()).toBe(120);
    });
  });

  // ─── Column width index ─────────────────────────────────────────────────────

  describe('column width index', () => {
    it('getTotalWidth returns 0 before initColumns', () => {
      expect(engine.getTotalWidth()).toBe(0);
    });

    it('initColumns sets widths and computes offsets', () => {
      engine.initColumns([100, 150, 200]);
      expect(engine.getTotalWidth()).toBe(450);
      expect(engine.getColumnOffset(0)).toBe(0);
      expect(engine.getColumnOffset(1)).toBe(100);
      expect(engine.getColumnOffset(2)).toBe(250);
    });

    it('setColumnWidth updates total correctly', () => {
      engine.initColumns([100, 100, 100]); // total 300
      engine.setColumnWidth(1, 200);       // total 400
      expect(engine.getTotalWidth()).toBe(400);
      expect(engine.getColumnOffset(2)).toBe(300);
    });

    it('getColumnAtOffset maps pixel to column index', () => {
      engine.initColumns([100, 150, 200]); // offsets [0, 100, 250, 450]
      expect(engine.getColumnAtOffset(0)).toBe(0);
      expect(engine.getColumnAtOffset(99)).toBe(0);
      expect(engine.getColumnAtOffset(100)).toBe(1);
      expect(engine.getColumnAtOffset(249)).toBe(1);
      expect(engine.getColumnAtOffset(250)).toBe(2);
      expect(engine.getColumnAtOffset(449)).toBe(2);
    });

    it('getColumnAtOffset clamps to valid range', () => {
      engine.initColumns([100, 100]);
      expect(engine.getColumnAtOffset(-10)).toBe(0);
      expect(engine.getColumnAtOffset(9999)).toBe(1);
    });

    it('setColumnWidth is no-op when value unchanged', () => {
      engine.initColumns([100, 200]);
      engine.setColumnWidth(0, 100);
      expect(engine.getTotalWidth()).toBe(300);
    });
  });

  // ─── Visible range computation ──────────────────────────────────────────────

  describe('visible range computation', () => {
    it('returns empty range before init', () => {
      const fresh = new VirtualScrollEngine();
      fresh.init(makeContainer(), makeViewport());
      const rr = fresh.getVisibleRowRange();
      const cr = fresh.getVisibleColRange();
      expect(rr).toEqual({ start: 0, end: -1 });
      expect(cr).toEqual({ start: 0, end: -1 });
    });

    it('computes row range with overscan at scrollTop=0', () => {
      engine.initRows(100, 40); // viewport 400px → shows rows 0–10, overscan 3 → 0–13
      engine.initColumns([100]);
      const range = engine.getVisibleRowRange();
      expect(range.start).toBe(0);
      expect(range.end).toBe(13); // rows 0–10 visible (scrollTop+height lands on row 10 boundary), +3 overscan
    });

    it('computes row range after scroll', () => {
      engine.initRows(100, 40); // rows 0–99, each 40px
      engine.onScroll(400, 0);  // scrolled to row 10
      const range = engine.getVisibleRowRange();
      // visible: 10–20 (scrollTop+height=800 lands on row 20 boundary), overscan: start-3=7, end+3=23
      expect(range.start).toBe(7);
      expect(range.end).toBe(23);
    });

    it('clamps row range start to 0', () => {
      engine.initRows(50, 40);
      engine.onScroll(0, 0);
      expect(engine.getVisibleRowRange().start).toBe(0);
    });

    it('clamps row range end to rowCount - 1', () => {
      engine.initRows(5, 40); // only 5 rows
      const range = engine.getVisibleRowRange();
      expect(range.end).toBe(4);
    });

    it('computes col range after horizontal scroll', () => {
      engine.initRows(10, 40);
      const cols20 = colArray(20, 100);
      engine.initColumns(cols20); // 20 cols × 100px
      engine.onScroll(0, 500); // scrolled 500px right → col 5
      const range = engine.getVisibleColRange();
      // visible: col 5–13 (scrollLeft+width=1300 lands on col 13 boundary), overscan 2 → start=3, end=15
      expect(range.start).toBe(3);
      expect(range.end).toBe(15);
    });
  });

  // ─── scrollToRow ────────────────────────────────────────────────────────────

  describe('scrollToRow', () => {
    it('sets container scrollTop to row offset (top)', () => {
      engine.initRows(20, 40);
      engine.scrollToRow(5);
      expect(container.scrollTop).toBe(200);
    });

    it('scrollToRow middle positions row in center', () => {
      engine.initRows(20, 40);
      engine.scrollToRow(10, 'middle');
      // rowTop=400, rowHeight=40, viewportHeight=400 → target = 400 - (400-40)/2 = 220
      expect(container.scrollTop).toBe(220);
    });

    it('scrollToRow bottom aligns row to bottom of viewport', () => {
      engine.initRows(20, 40);
      engine.scrollToRow(10, 'bottom');
      // rowTop=400, rowHeight=40, viewportHeight=400 → target = 400-400+40 = 40
      expect(container.scrollTop).toBe(40);
    });

    it('scrollToRow clamps negative result to 0', () => {
      engine.initRows(20, 40);
      engine.scrollToRow(0, 'bottom'); // rowTop=0, result would be negative
      expect(container.scrollTop).toBe(0);
    });

    it('scrollToRow clamps index to valid range', () => {
      engine.initRows(5, 40);
      engine.scrollToRow(999);
      expect(container.scrollTop).toBe(160); // last row offset
    });
  });

  // ─── scrollToColumn ─────────────────────────────────────────────────────────

  describe('scrollToColumn', () => {
    it('scrolls left when column is before viewport', () => {
      engine.initColumns(colArray(20, 100));
      container.scrollLeft = 500;
      engine.onScroll(0, 500);
      engine.scrollToColumn(2); // col at offset 200 < scrollLeft 500
      expect(container.scrollLeft).toBe(200);
    });

    it('no scroll when column is already visible', () => {
      engine.initColumns(colArray(20, 100));
      container.scrollLeft = 0;
      engine.onScroll(0, 0);
      engine.scrollToColumn(3); // col at 300, visible in 800px viewport
      expect(container.scrollLeft).toBe(0);
    });

    it('scrolls right when column is past viewport', () => {
      engine.initColumns(colArray(20, 100));
      container.scrollLeft = 0;
      engine.onScroll(0, 0);
      engine.scrollToColumn(15); // col at 1500, past 800px viewport
      // colLeft=1500, colWidth=100, scrollLeft=0, viewport=800 → target = 1500+100-800 = 800
      expect(container.scrollLeft).toBe(800);
    });
  });

  // ─── recalculate ────────────────────────────────────────────────────────────

  describe('recalculate', () => {
    it('updates viewport dimensions from container', () => {
      engine.initRows(100, 40);
      // Simulate container resize
      Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
      engine.recalculate();
      // After resize, more rows should be visible
      const range = engine.getVisibleRowRange();
      // 600px / 40px = 15 visible rows (0–15 boundary), + 3 overscan = end 18
      expect(range.end).toBe(18);
    });
  });

  // ─── destroy ─────────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes scroll listener on destroy', () => {
      const el = makeContainer();
      const eng = new VirtualScrollEngine();
      eng.init(el, makeViewport());
      expect(el._listeners['scroll']?.length).toBe(1);
      eng.destroy();
      expect(el._listeners['scroll']?.length ?? 0).toBe(0);
    });
  });
});
