import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatPercentPrecise, roundToFour, roundToTwo } from './utils';
import { formatMoney, formatPercent as formatPercentFromFraction } from '@/lib/results/format';

// The five markets with a working engine. Every one of these has to render with
// a real symbol and a separator.
const SUPPORTED = ['USD', 'GBP', 'SGD', 'MYR', 'PHP'] as const;

describe('formatCurrency', () => {
  it('renders every supported market with its own symbol', () => {
    expect(formatCurrency(12.5, 'USD')).toBe('$12.50');
    expect(formatCurrency(12.5, 'GBP')).toBe('£12.50');
    expect(formatCurrency(12.5, 'SGD')).toBe('$12.50');
    // The regression this fix addresses: the old hand-written table stored a
    // bare "RM" and concatenated it, producing "RM12.50" with no separator.
    expect(formatCurrency(12.5, 'MYR')).toBe('RM 12.50');
    expect(formatCurrency(12.5, 'PHP')).toBe('₱12.50');
  });

  it('defaults to USD when no currency is given', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });

  it('puts the minus sign ahead of the amount for losses', () => {
    expect(formatCurrency(-8, 'USD')).toBe('-$8.00');
    expect(formatCurrency(-8, 'MYR')).toBe('-RM 8.00');
  });

  it('groups thousands', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatCurrency(1_234_567.891, 'MYR')).toBe('RM 1,234,567.89');
  });

  it('emits no non-breaking space, so output stays diffable', () => {
    for (const currency of SUPPORTED) {
      expect(formatCurrency(1234.5, currency)).not.toContain('\u00a0');
    }
  });

  it('keeps a symbol and a separator for every supported currency', () => {
    for (const currency of SUPPORTED) {
      const output = formatCurrency(9.99, currency);
      expect(output).toContain('9.99');
      expect(output).toMatch(/^\S+\s?\S*9\.99$|^\S+9\.99$/);
      // Must not degrade to a bare number for a real market.
      expect(output).not.toBe('9.99');
    }
  });

  it('degrades gracefully for an empty or malformed currency code', () => {
    // The old table also produced a bare number here; that behaviour is kept
    // rather than silently pretending the value is USD.
    expect(formatCurrency(5, '')).toBe('5.00');
    expect(formatCurrency(5, 'not-a-code')).toBe('5.00');
  });

  it('labels a structurally valid but unknown code with that code', () => {
    expect(formatCurrency(5, 'XYZ')).toContain('XYZ');
    expect(formatCurrency(5, 'XYZ')).toContain('5.00');
  });

  it('returns an em dash for non-finite input instead of "$NaN"', () => {
    expect(formatCurrency(Number.NaN, 'USD')).toBe('—');
    expect(formatCurrency(Number.POSITIVE_INFINITY, 'USD')).toBe('—');
    expect(formatCurrency(Number.NEGATIVE_INFINITY, 'USD')).toBe('—');
  });

  it('keeps two decimal places and rounds half away from zero', () => {
    expect(formatCurrency(1, 'USD')).toBe('$1.00');
    expect(formatCurrency(1.005, 'USD')).toBe('$1.01');
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles zero without a negative sign', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    // Intl would render -0 as "-$0.00"; a negative zero is not a real loss.
    expect(formatCurrency(-0, 'USD')).toBe('$0.00');
    expect(formatCurrency(-0, 'MYR')).toBe('RM 0.00');
  });
});

// The results panel has its own formatter so that client code never reaches into
// the calculation package. These two must not drift apart.
describe('formatCurrency agrees with the results panel formatter', () => {
  const AMOUNTS = [0, -0, 9.99, 12.5, 1234.5, -8, -1234.56, 1_000_000];

  it('matches for every supported currency and amount', () => {
    for (const currency of SUPPORTED) {
      for (const amount of AMOUNTS) {
        expect(formatCurrency(amount, currency)).toBe(formatMoney(amount, currency));
      }
    }
  });

  it('matches on the non-finite cases too', () => {
    expect(formatCurrency(Number.NaN, 'USD')).toBe(formatMoney(Number.NaN, 'USD'));
  });
});

describe('percentage helpers are unchanged', () => {
  it('formatPercent scales a fraction to one decimal place', () => {
    expect(formatPercent(0.25)).toBe('25.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formatPercentPrecise honours the requested precision', () => {
    expect(formatPercentPrecise(0.123456)).toBe('12.3%');
    expect(formatPercentPrecise(0.123456, 3)).toBe('12.346%');
  });

  it('agrees with the results panel percent formatter', () => {
    expect(formatPercent(0.25)).toBe(formatPercentFromFraction(0.25));
    expect(formatPercentPrecise(0.1234, 2)).toBe(formatPercentFromFraction(0.1234, 2));
  });
});

// Guard that the rounding helpers this module also owns were not disturbed.
describe('rounding helpers are unchanged', () => {
  it('roundToTwo rounds to 2 decimals', () => {
    expect(roundToTwo(1.005)).toBe(1.01);
    expect(roundToTwo(2.345)).toBe(2.35);
    expect(roundToTwo(10)).toBe(10);
  });

  it('roundToFour rounds to 4 decimals', () => {
    expect(roundToFour(0.123456)).toBe(0.1235);
    expect(roundToFour(1)).toBe(1);
  });
});
