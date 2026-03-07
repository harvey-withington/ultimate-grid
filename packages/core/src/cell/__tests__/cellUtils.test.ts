import { describe, it, expect } from 'vitest';
import { formatCellCoord, formatCellRange, countCellsInRanges } from '../cellUtils';
import type { CellCoord, CellRange, ColumnDef } from '../../types';

describe('cellUtils', () => {
  // ─── formatCellCoord ─────────────────────────────────────────────────────────

  describe('formatCellCoord', () => {
    it('returns en-dash for null', () => {
      expect(formatCellCoord(null)).toBe('\u2013');
    });

    it('formats a coord as colId + rowId', () => {
      const coord: CellCoord = { colId: 'B', rowId: '3' };
      expect(formatCellCoord(coord)).toBe('B3');
    });

    it('returns just rowId when coord is on a rowHeader column', () => {
      const cols = [
        { key: 'row', rowHeader: true },
        { key: 'A' },
      ];
      expect(formatCellCoord({ colId: 'row', rowId: '7' }, cols)).toBe('7');
    });

    it('still formats normally for non-header columns when columnDefs given', () => {
      const cols = [
        { key: 'row', rowHeader: true },
        { key: 'B' },
      ];
      expect(formatCellCoord({ colId: 'B', rowId: '3' }, cols)).toBe('B3');
    });
  });

  // ─── formatCellRange ─────────────────────────────────────────────────────────

  describe('formatCellRange', () => {
    it('returns en-dash for empty array', () => {
      expect(formatCellRange([])).toBe('\u2013');
    });

    it('formats a single-cell range without colon', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'A', rowId: '1' } },
      ];
      expect(formatCellRange(ranges)).toBe('A1');
    });

    it('formats a multi-cell range with colon', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'C', rowId: '5' } },
      ];
      expect(formatCellRange(ranges)).toBe('A1:C5');
    });

    it('joins multiple ranges with comma', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'B', rowId: '2' } },
        { start: { colId: 'D', rowId: '3' }, end: { colId: 'D', rowId: '3' } },
      ];
      expect(formatCellRange(ranges)).toBe('A1:B2, D3');
    });

    it('replaces row-header start with first data column', () => {
      const cols = [
        { key: 'row', rowHeader: true },
        { key: 'A' },
        { key: 'B' },
        { key: 'H' },
      ];
      const ranges: CellRange[] = [
        { start: { colId: 'row', rowId: '7' }, end: { colId: 'H', rowId: '7' } },
      ];
      expect(formatCellRange(ranges, cols)).toBe('A7:H7');
    });

    it('replaces row-header end with last data column', () => {
      const cols = [
        { key: 'A' },
        { key: 'B' },
        { key: 'row', rowHeader: true },
      ];
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'row', rowId: '3' } },
      ];
      expect(formatCellRange(ranges, cols)).toBe('A1:B3');
    });

    it('still works without columnDefs even when colId is "row"', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'row', rowId: '7' }, end: { colId: 'H', rowId: '7' } },
      ];
      // Without columnDefs, no substitution happens
      expect(formatCellRange(ranges)).toBe('row7:H7');
    });
  });

  // ─── countCellsInRanges ──────────────────────────────────────────────────────

  describe('countCellsInRanges', () => {
    it('returns 0 for empty array', () => {
      expect(countCellsInRanges([])).toBe(0);
    });

    it('counts a single cell without columnDefs', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'A', rowId: '1' } },
      ];
      // Without columnDefs, colSpan defaults to 1
      expect(countCellsInRanges(ranges)).toBe(1);
    });

    it('counts cells with columnDefs for column span', () => {
      const cols: ColumnDef[] = [
        { key: 'row', headerName: '', width: 50 },
        { key: 'A', headerName: 'A', width: 100 },
        { key: 'B', headerName: 'B', width: 100 },
        { key: 'C', headerName: 'C', width: 100 },
      ];
      // A1:C3 → 3 cols × 3 rows = 9
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'C', rowId: '3' } },
      ];
      expect(countCellsInRanges(ranges, cols)).toBe(9);
    });

    it('handles reversed row range', () => {
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '5' }, end: { colId: 'A', rowId: '2' } },
      ];
      // 4 rows × 1 col = 4
      expect(countCellsInRanges(ranges)).toBe(4);
    });

    it('sums across multiple ranges', () => {
      const cols: ColumnDef[] = [
        { key: 'A', headerName: 'A', width: 100 },
        { key: 'B', headerName: 'B', width: 100 },
      ];
      const ranges: CellRange[] = [
        { start: { colId: 'A', rowId: '1' }, end: { colId: 'B', rowId: '2' } }, // 2×2 = 4
        { start: { colId: 'A', rowId: '5' }, end: { colId: 'A', rowId: '5' } }, // 1×1 = 1
      ];
      expect(countCellsInRanges(ranges, cols)).toBe(5);
    });
  });
});
