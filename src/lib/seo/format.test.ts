import { describe, it, expect } from 'vitest';
import {
  describeFeeRate,
  feeToLine,
  formatFeeAmount,
  formatIsoDate,
  formatRate,
  sourceHost,
} from './format';

describe('formatRate', () => {
  it('renders a fraction as a percentage', () => {
    expect(formatRate(0.06)).toBe('6%');
    expect(formatRate(0.09)).toBe('9%');
    expect(formatRate(0)).toBe('0%');
  });

  it('keeps the precision the rate files actually publish', () => {
    // These are the least precise rates in the dataset. Rounding them to fewer
    // places would misstate them; padding to more would be noise.
    expect(formatRate(0.0545)).toBe('5.45%');
    expect(formatRate(0.0436)).toBe('4.36%');
    expect(formatRate(0.05995)).toBe('5.995%');
    expect(formatRate(0.08175)).toBe('8.175%');
  });

  it('does not leak binary floating point noise', () => {
    // 0.0545 * 100 is 5.450000000000001 in binary floating point.
    expect(formatRate(0.0545)).not.toContain('0000');
    expect(formatRate(0.08175)).toBe('8.175%');
  });

  it('returns a dash for non-finite input rather than NaN', () => {
    expect(formatRate(Number.NaN)).toBe('—');
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatFeeAmount', () => {
  it('formats a positive amount with a symbol', () => {
    expect(formatFeeAmount(12.5, 'USD')).toBe('$12.50');
    expect(formatFeeAmount(0.54, 'MYR')).toBe('RM 0.54');
  });

  it('puts the sign ahead of the symbol', () => {
    expect(formatFeeAmount(-8, 'USD')).toBe('-$8.00');
  });

  it('handles a large cap without scientific notation', () => {
    expect(formatFeeAmount(650000, 'MYR')).toBe('RM 650,000.00');
  });

  it('normalises the non-breaking space Intl inserts after a lettered symbol', () => {
    expect(formatFeeAmount(12.5, 'MYR')).not.toContain('\u00a0');
  });
});

describe('describeFeeRate', () => {
  it('renders a percentage', () => {
    expect(describeFeeRate({ kind: 'percentage', rate: 0.0327 })).toBe('3.27%');
  });

  it('renders a per-order amount as an amount, not a percentage', () => {
    // The regression this guards: MY's platform support fee stores 0.54 in the
    // `rate` field, but it is a flat RM amount per order. Formatting it as a
    // percentage would print "54%".
    expect(describeFeeRate({ kind: 'perOrderAmount', amount: 0.54, currency: 'MYR' })).toBe(
      'RM 0.54 per order'
    );
  });

  it('renders a published range verbatim', () => {
    expect(describeFeeRate({ kind: 'range', rateRange: '4.00% - 6.00%' })).toBe('4.00% - 6.00%');
  });

  it('renders text as-is', () => {
    expect(describeFeeRate({ kind: 'text', text: 'Charged the standard rate' })).toBe(
      'Charged the standard rate'
    );
  });
});

describe('feeToLine', () => {
  it('reads a per-order fee as an amount, never as a percentage', () => {
    const line = feeToLine(
      'Platform Support Fee',
      { rate: 0.54, currency: 'MYR', perOrder: true, confidence: 'high' },
      'MYR'
    );

    expect(line.value).toEqual({ kind: 'perOrderAmount', amount: 0.54, currency: 'MYR' });
    expect(describeFeeRate(line.value)).toBe('RM 0.54 per order');
  });

  it('reads a plain rate as a percentage', () => {
    const line = feeToLine('Transaction fee', { rate: 0.0327, confidence: 'high' }, 'SGD');
    expect(line.value).toEqual({ kind: 'percentage', rate: 0.0327 });
  });

  it('uses a published range as the value when there is no single rate', () => {
    const line = feeToLine(
      'Dynamic Commission',
      { rateRange: '4.00% - 6.00%', capPerItem: 650000, currency: 'MYR', confidence: 'medium' },
      'MYR'
    );

    expect(line.value).toEqual({ kind: 'range', rateRange: '4.00% - 6.00%' });
    expect(line.details).toEqual(['Capped at RM 650,000.00 per item']);
  });

  it('falls back to a text value when the record has no number at all', () => {
    const line = feeToLine(
      'BXP Suspended Rate',
      { description: 'Charged the standard rate, no BXP service fee', confidence: 'high' },
      'SGD'
    );

    expect(line.value.kind).toBe('text');
    expect(describeFeeRate(line.value)).toBe('Charged the standard rate, no BXP service fee');
  });

  it('defaults confidence to needs-verification when the record omits it', () => {
    expect(feeToLine('Unknown fee', {}, 'USD').confidence).toBe('needs-verification');
  });

  it('carries through base, tax inclusivity and effective date', () => {
    const line = feeToLine(
      'Transaction fee',
      {
        rate: 0.0378,
        base: 'Customer Payment',
        taxInclusive: true,
        effectiveFrom: '2025-01-01',
        confidence: 'high',
      },
      'MYR'
    );

    expect(line.base).toBe('Customer Payment');
    expect(line.taxInclusive).toBe(true);
    expect(line.effectiveFrom).toBe('2025-01-01');
  });
});

describe('formatIsoDate', () => {
  it('formats an ISO date in a readable form', () => {
    expect(formatIsoDate('2026-09-26')).toBe('September 26, 2026');
  });

  it('returns a dash for missing or unparseable input', () => {
    expect(formatIsoDate(undefined)).toBe('—');
    expect(formatIsoDate('')).toBe('—');
    expect(formatIsoDate('not-a-date')).toBe('—');
  });
});

describe('sourceHost', () => {
  it('extracts a hostname without the www prefix', () => {
    expect(sourceHost('https://www.seller-us.tiktok.com/university/essay?x=1')).toBe(
      'seller-us.tiktok.com'
    );
  });

  it('returns a readable label when the URL is missing or malformed', () => {
    expect(sourceHost(undefined)).toBe('Seller Center');
    expect(sourceHost('nonsense')).toBe('nonsense');
  });
});
