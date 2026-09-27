import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatShare,
} from './format';

describe('formatMoney', () => {
  it('formats each supported market currency with its own symbol', () => {
    expect(formatMoney(12.5, 'USD')).toBe('$12.50');
    expect(formatMoney(12.5, 'MYR')).toBe('RM 12.50');
    expect(formatMoney(12.5, 'SGD')).toBe('$12.50');
    // GBP and PHP are the two codes the old hand-written symbol table in
    // utils.ts got wrong; Intl renders both correctly.
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50');
    expect(formatMoney(12.5, 'PHP')).toBe('₱12.50');
  });

  it('places the minus sign ahead of the amount for losses', () => {
    expect(formatMoney(-8, 'USD')).toBe('-$8.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('falls back to a plain number for an unknown currency code', () => {
    expect(formatMoney(5, 'not-a-code')).toBe('5.00');
  });

  it('defaults to USD when the currency is empty', () => {
    expect(formatMoney(5, '')).toBe('$5.00');
  });

  it('returns an em dash for non-finite input instead of NaN', () => {
    expect(formatMoney(Number.NaN, 'USD')).toBe('—');
    expect(formatMoney(Number.POSITIVE_INFINITY, 'USD')).toBe('—');
  });
});

describe('formatPercent', () => {
  it('scales a fraction into a percentage', () => {
    expect(formatPercent(0.25)).toBe('25.0%');
    expect(formatPercent(0.0659)).toBe('6.6%');
  });

  it('honours a custom precision', () => {
    expect(formatPercent(0.123456, 2)).toBe('12.35%');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatShare', () => {
  it('expresses an amount as a share of the total', () => {
    expect(formatShare(25, 100)).toBe('25.0%');
    expect(formatShare(6, 100)).toBe('6.0%');
  });

  it('can exceed 100 when costs are larger than revenue', () => {
    expect(formatShare(150, 100)).toBe('150.0%');
  });

  it('returns an em dash for a zero or unusable total', () => {
    expect(formatShare(5, 0)).toBe('—');
    expect(formatShare(Number.NaN, 100)).toBe('—');
  });
});

describe('formatMoneyCompact', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatMoneyCompact(1500, 'USD')).toBe('$1.5k');
    expect(formatMoneyCompact(25_000, 'USD')).toBe('$25k');
    expect(formatMoneyCompact(2_500_000, 'USD')).toBe('$2.5M');
  });

  it('leaves small amounts at full precision', () => {
    expect(formatMoneyCompact(12.34, 'USD')).toBe('$12.34');
  });

  it('keeps the sign ahead of the abbreviation', () => {
    expect(formatMoneyCompact(-1500, 'USD')).toBe('-$1.5k');
  });
});

describe('formatDate', () => {
  it('formats an ISO date for reading', () => {
    // Asserted loosely on purpose: the abbreviated month token is ICU-version
    // dependent ("Sept" vs "Sep"), and the date itself must not drift.
    const formatted = formatDate('2026-09-26');
    expect(formatted).toContain('26');
    expect(formatted).toContain('2026');
    expect(formatted).not.toContain('undefined');
  });

  it('returns the raw string when the date cannot be parsed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('returns an em dash for an empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});
