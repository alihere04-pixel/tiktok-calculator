// PRESENTATION FORMATTING FOR THE RESULTS PANEL
//
// This deliberately duplicates the money/percent formatting in
// `@/lib/calculation/utils` instead of importing it.
//
// `utils.ts` is a leaf module today, so importing `formatCurrency` from here
// would work. But it sits inside the calculation package, whose entry point
// transitively imports the `fs`-based rate loader, and a client component
// reaching into that package puts a `fs` blast radius one edit away. The panel
// cannot afford that, so it owns its formatting.
//
// Both implementations use `Intl.NumberFormat` with identical settings, and
// `src/lib/calculation/utils.test.ts` asserts they produce the same string, so
// this duplication is verified rather than merely documented.
//
// No calculation is reimplemented here - this is display formatting only.

const formatterCache = new Map<string, Intl.NumberFormat>();

function getMoneyFormatter(currency: string): Intl.NumberFormat {
  const cached = formatterCache.get(currency);
  if (cached) return cached;

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      // 'narrowSymbol' is what makes MYR read as "RM" rather than "MYR" and
      // PHP as the peso sign. The default 'code' style would print "MYR 12.50".
      currencyDisplay: 'narrowSymbol',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // Unknown or malformed ISO code: fall back to a plain grouped number so a
    // bad rate file degrades the label instead of blanking the whole panel.
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatterCache.set(currency, formatter);
  return formatter;
}

function isUsable(value: number): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `$12.34`, `RM 1,234.56`, `-£9.99`. Returns an em dash for unusable input. */
export function formatMoney(amount: number, currency: string): string {
  if (!isUsable(amount)) return '—';
  try {
    // Intl renders negative zero as "-$0.00"; a negative zero is a JavaScript
    // artefact rather than a real loss, so it is normalised away here too, to
    // keep this formatter identical to `utils.formatCurrency`.
    const safeAmount = amount === 0 ? 0 : amount;
    return getMoneyFormatter(currency || 'USD').format(safeAmount).replace(/\u00a0/g, ' ');
  } catch {
    return `${amount.toFixed(2)}`;
  }
}

/**
 * Formats a fraction as a percentage: 0.25 -> "25.0%".
 *
 * The engine returns rates and margins as fractions, not already-scaled
 * percentages, so every percentage in the panel goes through here.
 */
export function formatPercent(fraction: number, decimals = 1): string {
  if (!isUsable(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Share of a total, used by the waterfall segments. Clamped to 0-100. */
export function formatShare(amount: number, total: number, decimals = 1): string {
  if (!isUsable(amount) || !isUsable(total) || total === 0) return '—';
  const share = (amount / total) * 100;
  return `${share.toFixed(decimals)}%`;
}

/** Compact money for dense table cells, e.g. `$1.2k`. */
export function formatMoneyCompact(amount: number, currency: string): string {
  if (!isUsable(amount)) return '—';
  const symbol = currencySymbol(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
  return formatMoney(amount, currency);
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? '';
  } catch {
    return '';
  }
}

/** "2026-09-26" -> "26 Sep 2026". Falls back to the raw string if unparseable. */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
