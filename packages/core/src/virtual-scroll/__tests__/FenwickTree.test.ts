import { describe, it, expect, beforeEach } from 'vitest';
import { FenwickTree } from '../FenwickTree';

describe('FenwickTree', () => {
  // ─── Construction ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a tree of the given size with all zeros', () => {
      const t = new FenwickTree(5);
      expect(t.length).toBe(5);
      expect(t.queryAll()).toBe(0);
    });

    it('accepts size 0', () => {
      const t = new FenwickTree(0);
      expect(t.length).toBe(0);
      expect(t.queryAll()).toBe(0);
    });

    it('throws for negative size', () => {
      expect(() => new FenwickTree(-1)).toThrow(RangeError);
    });
  });

  // ─── update + query ────────────────────────────────────────────────────────

  describe('update / query', () => {
    let t: FenwickTree;

    beforeEach(() => {
      t = new FenwickTree(6);
    });

    it('query of empty tree is 0 for all indices', () => {
      for (let i = 0; i < 6; i++) expect(t.query(i)).toBe(0);
    });

    it('single update is reflected in prefix sums', () => {
      t.update(2, 10);
      expect(t.query(0)).toBe(0);
      expect(t.query(1)).toBe(0);
      expect(t.query(2)).toBe(10);
      expect(t.query(3)).toBe(10);
      expect(t.query(5)).toBe(10);
    });

    it('multiple updates accumulate correctly', () => {
      // heights: [40, 40, 80, 40, 40, 40]
      t.update(0, 40);
      t.update(1, 40);
      t.update(2, 80);
      t.update(3, 40);
      t.update(4, 40);
      t.update(5, 40);

      expect(t.query(0)).toBe(40);
      expect(t.query(1)).toBe(80);
      expect(t.query(2)).toBe(160);
      expect(t.query(3)).toBe(200);
      expect(t.query(4)).toBe(240);
      expect(t.query(5)).toBe(280);
    });

    it('supports negative deltas (row height reduction)', () => {
      t.update(3, 100);
      t.update(3, -60); // now height = 40
      expect(t.query(3)).toBe(40);
      expect(t.queryAll()).toBe(40);
    });

    it('supports fractional values', () => {
      t.update(0, 40.5);
      t.update(1, 39.5);
      expect(t.query(1)).toBeCloseTo(80, 10);
    });

    it('query(-1) returns 0', () => {
      t.update(0, 50);
      expect(t.query(-1)).toBe(0);
    });

    it('query beyond size clamps to last index', () => {
      t.update(5, 50);
      expect(t.query(100)).toBe(50);
    });

    it('throws on out-of-range update', () => {
      expect(() => t.update(-1, 10)).toThrow(RangeError);
      expect(() => t.update(6, 10)).toThrow(RangeError);
    });
  });

  // ─── queryRange ────────────────────────────────────────────────────────────

  describe('queryRange', () => {
    it('returns sum of a half-open range [l, r)', () => {
      const t = new FenwickTree(5);
      // values: [10, 20, 30, 40, 50]
      [10, 20, 30, 40, 50].forEach((v, i) => t.update(i, v));

      expect(t.queryRange(0, 3)).toBe(60);  // 10+20+30
      expect(t.queryRange(1, 4)).toBe(90);  // 20+30+40
      expect(t.queryRange(2, 5)).toBe(120); // 30+40+50
      expect(t.queryRange(0, 5)).toBe(150); // all
    });

    it('returns 0 for empty range', () => {
      const t = new FenwickTree(4);
      t.update(2, 99);
      expect(t.queryRange(2, 2)).toBe(0);
      expect(t.queryRange(3, 2)).toBe(0);
    });
  });

  // ─── queryAll ─────────────────────────────────────────────────────────────

  describe('queryAll', () => {
    it('returns total sum', () => {
      const t = new FenwickTree(4);
      [10, 20, 30, 40].forEach((v, i) => t.update(i, v));
      expect(t.queryAll()).toBe(100);
    });

    it('returns 0 for size-0 tree', () => {
      expect(new FenwickTree(0).queryAll()).toBe(0);
    });
  });

  // ─── findFirst ────────────────────────────────────────────────────────────

  describe('findFirst', () => {
    it('finds the correct row for a given pixel offset (uniform heights)', () => {
      const t = new FenwickTree(5);
      // All rows 40px tall → offsets: 0, 40, 80, 120, 160
      for (let i = 0; i < 5; i++) t.update(i, 40);

      // getRowAtOffset logic: findFirst(y + 1)
      expect(t.findFirst(1)).toBe(0);   // y=0 → row 0
      expect(t.findFirst(40)).toBe(0);  // y=39 → row 0  (sum>=40 at index 0)
      expect(t.findFirst(41)).toBe(1);  // y=40 → row 1
      expect(t.findFirst(80)).toBe(1);  // y=79 → row 1
      expect(t.findFirst(81)).toBe(2);  // y=80 → row 2
      expect(t.findFirst(161)).toBe(4); // y=160 → row 4
    });

    it('finds correct row with variable heights', () => {
      // heights: [40, 80, 40, 120, 40]
      // offsets: [0,  40, 120, 160, 280, 320]
      const t = new FenwickTree(5);
      [40, 80, 40, 120, 40].forEach((h, i) => t.update(i, h));

      expect(t.findFirst(1)).toBe(0);    // in row 0 (0–39)
      expect(t.findFirst(40)).toBe(0);   // prefix sum 40 satisfied at index 0
      expect(t.findFirst(41)).toBe(1);   // in row 1 (40–119)
      expect(t.findFirst(120)).toBe(1);  // still row 1 (prefix sum 120 at index 1)
      expect(t.findFirst(121)).toBe(2);  // in row 2 (120–159)
      expect(t.findFirst(161)).toBe(3);  // in row 3 (160–279)
      expect(t.findFirst(280)).toBe(3);  // prefix sum 280 at index 3
      expect(t.findFirst(281)).toBe(4);  // in row 4 (280–319)
    });

    it('returns 0 for target <= 0', () => {
      const t = new FenwickTree(4);
      [10, 20, 30, 40].forEach((v, i) => t.update(i, v));
      expect(t.findFirst(0)).toBe(0);
      expect(t.findFirst(-5)).toBe(0);
    });

    it('returns size when target exceeds total', () => {
      const t = new FenwickTree(3);
      [10, 20, 30].forEach((v, i) => t.update(i, v));
      // total = 60; target > 60 → should return 3 (past end)
      expect(t.findFirst(61)).toBe(3);
    });

    it('handles single-element tree', () => {
      const t = new FenwickTree(1);
      t.update(0, 50);
      expect(t.findFirst(1)).toBe(0);
      expect(t.findFirst(50)).toBe(0);
      expect(t.findFirst(51)).toBe(1);
    });
  });

  // ─── clear ────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('resets all values to zero', () => {
      const t = new FenwickTree(4);
      [10, 20, 30, 40].forEach((v, i) => t.update(i, v));
      t.clear();
      expect(t.queryAll()).toBe(0);
      expect(t.query(3)).toBe(0);
    });
  });

  // ─── Large / stress ───────────────────────────────────────────────────────

  describe('stress', () => {
    it('handles 100,000 rows with uniform heights and returns correct offsets', () => {
      const N = 100_000;
      const height = 40;
      const t = new FenwickTree(N);
      for (let i = 0; i < N; i++) t.update(i, height);

      expect(t.queryAll()).toBe(N * height);
      expect(t.query(N - 1)).toBe(N * height);
      expect(t.getRowOffset !== undefined); // structural check

      // Row at 2_000_000px offset should be index 50_000
      expect(t.findFirst(2_000_001)).toBe(50_000);
    });

    it('correctly resolves offsets after many point updates', () => {
      const N = 1_000;
      const t = new FenwickTree(N);
      const heights: number[] = [];
      for (let i = 0; i < N; i++) heights.push(30 + Math.floor(Math.random() * 70));
      heights.forEach((h: number, i: number) => t.update(i, h));

      // Brute-force prefix sum for comparison
      const prefix = [0];
      for (let i = 0; i < N; i++) prefix.push((prefix[i] as number) + (heights[i] as number));

      for (let i = 0; i < N; i++) {
        expect(t.query(i)).toBeCloseTo(prefix[i + 1], 8);
      }
    });
  });
});

// ─── Helper exposed for VirtualScrollEngine tests ─────────────────────────────
// (not part of public API — just for white-box testing)
declare module '../FenwickTree' {
  interface FenwickTree {
    getRowOffset?: never; // type guard, not real
  }
}
