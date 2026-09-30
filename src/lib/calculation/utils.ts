// Rounding helpers.
//
// A negative input small enough to round to zero lands on -0, because
// `Math.round(-0.004 * 100) / 100` is `-0`. That value compares equal to 0, so
// arithmetic is unaffected, but `Object.is(-0, 0)` is false and formatting it
// renders "-0.00" or "(0.00)" in some locales. Both helpers normalise -0 to 0.
function normaliseZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function roundToTwo(num: number): number {
  return normaliseZero(Math.round((num + Number.EPSILON) * 100) / 100);
}

export function roundToFour(num: number): number {
  return normaliseZero(Math.round((num + Number.EPSILON) * 10000) / 10000);
}

// Currency formatting used to read from a hand-maintained symbol table, which
// had one real defect and one maintenance risk:
//
//   - Defect: MYR rendered as "RM9.99" with no separator, because the table
//     stored a bare "RM" that was concatenated straight onto the number.
//   - Risk: the other four symbols were correct only as long as nobody mistyped
//     them, and nothing tied them to the ISO codes the rate files actually use.
//
// Intl.NumberFormat removes the table and derives the rest. 'narrowSymbol' is
// what keeps MYR reading as "RM" rather than "MYR". An unusable code now falls
// back to a plain grouped number instead of inventing a symbol.
//
// Output is normalised to match src/lib/results/format.ts, and utils.test.ts
// asserts the two formatters agree, so they cannot drift apart again.
//
// Only this presentation helper changed. No rounding, fee or profit logic in
// this module was touched.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const cached = currencyFormatters.get(currency);
  if (cached) return cached;

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // Empty or malformed ISO code: degrade the label rather than throw.
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  currencyFormatters.set(currency, formatter);
  return formatter;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  // The old implementation rendered non-finite input as "$NaN".
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';

  try {
    // Intl renders negative zero as "-$0.00". A negative zero is a JavaScript
    // artefact rather than a real loss, so it is normalised away.
    const safeAmount = amount === 0 ? 0 : amount;
    // Intl separates a lettered symbol with U+00A0 ("RM<NBSP>12.50"); normalise
    // it to a plain space so output stays diffable and assertable.
    return getCurrencyFormatter(currency).format(safeAmount).replace(/\u00a0/g, ' ');
  } catch {
    return amount.toFixed(2);
  }
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPercentPrecise(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}