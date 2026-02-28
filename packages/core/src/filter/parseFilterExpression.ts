import type { ColumnFilterValue } from '../types';

/**
 * parseFilterExpression
 *
 * Converts a raw filter-input string into a typed ColumnFilterValue.
 * No eval — expressions are parsed with a small finite grammar.
 *
 * Supported syntax
 * ────────────────
 *  Text (default)
 *    alice              → contains "alice"
 *    =alice             → equals "alice"
 *    !=alice            → notEquals "alice"
 *    ^alice             → startsWith "alice"
 *    alice$             → endsWith "alice"
 *
 *  Numeric
 *    >50                → greaterThan 50
 *    >=50               → greaterThanOrEqual 50
 *    <50                → lessThan 50
 *    <=50               → lessThanOrEqual 50
 *    =50  or 50         → equals 50
 *    !=50               → notEquals 50
 *    10..20             → inRange 10–20
 *
 *  Date (ISO yyyy-mm-dd or yyyy)
 *    >2020-01-01        → greaterThan date
 *    >=2020             → greaterThanOrEqual year boundary
 *    2020..2022         → inRange years
 *    =2022-06-01        → equals date
 *
 * Returns null if the expression is empty or cannot be parsed (caller should
 * show an error indicator on the input).
 */
export function parseFilterExpression(raw: string): ColumnFilterValue | null {
  const s = raw.trim();
  if (!s) return null;

  // ── Date range (must come before numeric range): 2020..2022 ────────────
  const dateRangeMatch = s.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*\.\.\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?)$/);
  if (dateRangeMatch) {
    const lo = normDate(dateRangeMatch[1], 'start');
    const hi = normDate(dateRangeMatch[2], 'end');
    if (lo && hi) {
      return { type: 'date', operator: 'inRange', value: lo, valueTo: hi };
    }
  }

  // ── Numeric range: 10..20 ────────────────────────────────────────────────
  const rangeMatch = s.match(/^(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/);
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    if (!isNaN(lo) && !isNaN(hi)) {
      return { type: 'number', operator: 'inRange', value: lo, valueTo: hi };
    }
  }

  // ── Comparison prefix: >=, <=, !=, >, <, = ──────────────────────────────
  const cmpMatch = s.match(/^(>=|<=|!=|>|<|=)(.+)$/);
  if (cmpMatch) {
    const op  = cmpMatch[1];
    const val = cmpMatch[2].trim();

    // Try numeric
    const n = Number(val);
    if (!isNaN(n) && val !== '') {
      return { type: 'number', operator: cmpToNumOp(op), value: n };
    }

    // Try date
    const d = normDate(val, op === '>=' || op === '=' ? 'start' : 'end');
    if (d) {
      return { type: 'date', operator: cmpToDateOp(op), value: d };
    }

    // Text equality / inequality
    if (op === '=')  return { type: 'text', operator: 'equals',    value: val };
    if (op === '!=') return { type: 'text', operator: 'notEquals', value: val };
  }

  // ── Regex ─────────────────────────────────────────────────────────────────
  const regexMatch = s.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    const pattern = regexMatch[1];
    const flags = regexMatch[2];
    const caseSensitive = !flags.includes('i');
    return { type: 'text', operator: 'regex', value: pattern, caseSensitive };
  }

  // ── Text prefix anchors ───────────────────────────────────────────────────
  if (s.startsWith('^')) {
    return { type: 'text', operator: 'startsWith', value: s.slice(1) };
  }
  if (s.endsWith('$') && s.length > 1) {
    return { type: 'text', operator: 'endsWith', value: s.slice(0, -1) };
  }

  // ── Plain number (no operator = equals) ──────────────────────────────────
  const plainNum = Number(s);
  if (!isNaN(plainNum) && s !== '') {
    return { type: 'number', operator: 'equals', value: plainNum };
  }

  // ── Default: text contains ────────────────────────────────────────────────
  return { type: 'text', operator: 'contains', value: s };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NumOp  = 'equals' | 'notEquals' | 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual' | 'inRange';
type DateOp = 'equals' | 'before' | 'beforeOrEqual' | 'after' | 'afterOrEqual' | 'inRange';

function cmpToNumOp(op: string): NumOp {
  switch (op) {
    case '>':  return 'greaterThan';
    case '>=': return 'greaterThanOrEqual';
    case '<':  return 'lessThan';
    case '<=': return 'lessThanOrEqual';
    case '!=': return 'notEquals';
    default:   return 'equals';
  }
}

function cmpToDateOp(op: string): DateOp {
  switch (op) {
    case '>':  return 'after';
    case '>=': return 'afterOrEqual';
    case '<':  return 'before';
    case '<=': return 'beforeOrEqual';
    default:   return 'equals';
  }
}

/**
 * Normalize a partial date string to a full ISO string.
 * '2020'        → '2020-01-01' (start) or '2020-12-31' (end)
 * '2020-06'     → '2020-06-01' (start) or '2020-06-30' (end)
 * '2020-06-15'  → '2020-06-15'
 * Returns null if not parseable.
 */
function normDate(s: string, edge: 'start' | 'end'): string | null {
  const yearOnly  = s.match(/^(\d{4})$/);
  const yearMonth = s.match(/^(\d{4})-(\d{2})$/);
  const full      = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (full) return s;

  if (yearMonth) {
    const [, y, m] = yearMonth;
    if (edge === 'start') return `${y}-${m}-01`;
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  }

  if (yearOnly) {
    const [, y] = yearOnly;
    return edge === 'start' ? `${y}-01-01` : `${y}-12-31`;
  }

  return null;
}
