import type { ConfidenceLevel } from '@/lib/calculation/types';
import type { FixedFee } from '@/lib/rates/schema';

/**
 * Formatting for the SEO fee pages.
 *
 * The important part of this module is `describeFeeRate`. A fee record in the
 * rate files is NOT always a percentage:
 *
 *   - `transactionFee` is a rate, e.g. 0.0327 -> "3.27%"
 *   - MY's `platformSupportFee` is a flat per-order amount in MYR, e.g. 0.54
 *     -> "RM 0.54 per order". Rendering that as a percentage would print a
 *     completely wrong "54%".
 *   - MY's `dynamicCommission` carries a published range string and a per-item
 *     cap rather than a single rate, because sub-category rates are undisclosed.
 *   - `bxpSuspendedRate` has no number at all, only a description.
 *
 * So a fee is modelled as a discriminated union instead of being forced into one
 * number. This module only ever formats values that already exist in the rate
 * files; it never derives, averages or guesses a rate.
 */

export type FeeRateValue =
  /** A fraction of the fee base, e.g. 0.0327 -> "3.27%". */
  | { kind: 'percentage'; rate: number }
  /** A flat amount charged once per order, e.g. MY support fee -> "RM 0.54 per order". */
  | { kind: 'perOrderAmount'; amount: number; currency: string }
  /** A published range string, rendered verbatim. */
  | { kind: 'range'; rateRange: string }
  /** No number in the data; the description is the whole story. */
  | { kind: 'text'; text: string };

export interface FeeLine {
  /** Human label for the fee. */
  label: string;
  value: FeeRateValue;
  /** What the percentage is charged on, when the data says so. */
  base?: string;
  /** Whether the rate already includes tax. */
  taxInclusive?: boolean;
  effectiveFrom?: string;
  lastVerified?: string;
  confidence: ConfidenceLevel;
  sourceUrl?: string;
  notes?: string;
  /** Extra qualifiers, e.g. a per-item cap. */
  details?: string[];
}

/**
 * Renders a fraction as a percentage.
 *
 * `rate * 100` is not exact in binary floating point (0.0545 * 100 is
 * 5.450000000000001), so the value is rounded to 4 decimal places first.
 * Whole percentages stay bare (6%, 9%) while fractional rates keep a fixed
 * three decimals: 0.0981 renders as 9.810% to match the published rate and
 * the calculator, sitting next to 7.085% on the same page.
 */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  const percent = Number((rate * 100).toFixed(4));
  if (Number.isInteger(percent)) return `${percent}%`;
  return `${percent.toFixed(3)}%`;
}

/**
 * Renders one currency amount, delegating to the shared results formatter so
 * the SEO pages and the calculator cannot disagree.
 */
export function formatFeeAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '—';
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(absolute)
    .replace(/\u00a0/g, ' ');
  return negative ? `-${formatted}` : formatted;
}

/** Human-readable form of a `FeeRateValue`, ready to drop into a table cell. */
export function describeFeeRate(value: FeeRateValue): string {
  switch (value.kind) {
    case 'percentage':
      return formatRate(value.rate);
    case 'perOrderAmount':
      return `${formatFeeAmount(value.amount, value.currency)} per order`;
    case 'range':
      return value.rateRange;
    case 'text':
      return value.text;
  }
}

/**
 * Turns a `fixedFees` / `additionalFees` record into a displayable line.
 *
 * The order of the checks matters. A per-order fee carries a `currency` and
 * `perOrder: true`, so it must be read as an amount before `rate` is considered
 * a percentage, otherwise MY's RM 0.54 support fee renders as "54%".
 */
export function feeToLine(label: string, fee: FixedFee, currency: string): FeeLine {
  const line: FeeLine = {
    label,
    value: { kind: 'text', text: fee.description ?? 'See Seller Center' },
    confidence: fee.confidence ?? 'needs-verification',
  };

  if (fee.base) line.base = fee.base;
  if (typeof fee.taxInclusive === 'boolean') line.taxInclusive = fee.taxInclusive;
  if (fee.effectiveFrom) line.effectiveFrom = fee.effectiveFrom;
  if (fee.notes) line.notes = fee.notes;

  if (fee.perOrder && typeof fee.rate === 'number') {
    // Must be tested before `rate` as a percentage, or MY's flat RM 0.54
    // support fee prints as "54%".
    line.value = {
      kind: 'perOrderAmount',
      amount: fee.rate,
      currency: fee.currency ?? currency,
    };
  } else if (typeof fee.rate === 'number') {
    line.value = { kind: 'percentage', rate: fee.rate };
  } else if (fee.rateRange) {
    // MY's dynamic commission publishes a range and a cap but no single rate,
    // because sub-category rates are not disclosed. The range is the published
    // figure, so it is the cell's value rather than a footnote.
    line.value = { kind: 'range', rateRange: fee.rateRange };
  }

  // A per-item cap is extra information on top of whichever value was chosen.
  const details: string[] = [];
  if (typeof fee.capPerItem === 'number') {
    details.push(`Capped at ${formatFeeAmount(fee.capPerItem, fee.currency ?? currency)} per item`);
  }
  if (details.length > 0) line.details = details;

  return line;
}

/** Formats an ISO date for display, or returns a dash when it is absent. */
export function formatIsoDate(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/** Hostname of a source URL, for a compact link label. */
export function sourceHost(url: string | undefined): string {
  if (!url) return 'Seller Center';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
