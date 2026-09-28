import { Badge } from '@/components/ui/Badge';
import { describeFeeRate, formatIsoDate, sourceHost, type FeeLine } from '@/lib/seo/format';
import type { CategoryRateRow, CategoryExceptionRow } from '@/lib/seo/market-pages';

/**
 * Fee tables for the SEO pages.
 *
 * All of these are static server components: the data is resolved at build time
 * from the rate files, so nothing here ships JavaScript.
 *
 * Mobile-first: each table is a real `<table>` with a `<caption>`, and the
 * layout is a single stacked column on the narrowest screens that widens to a
 * multi-column grid from `sm` up. The category name is allowed to wrap rather
 * than being truncated, because a truncated category name is a wrong category
 * name.
 */

const TH = 'px-2 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400';
const TD = 'px-2 py-2 text-sm align-top';

function tableClasses(): string {
  return 'w-full border-collapse text-left';
}

/**
 * The headline category commission table.
 *
 * `showParentLabel` prints the parent category above each sub-category name. UK
 * is the only market that needs it: its Excel lists sub-categories such as
 * "Accessories" 116 times under Beauty & Personal Care, and on its own that name
 * does not identify a category. The other four markets keep a single label per
 * row, so this stays off by default.
 */
export function CategoryRateTable({
  rows,
  currency,
  showParentLabel = false,
}: {
  rows: CategoryRateRow[];
  currency: string;
  showParentLabel?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No category rates published.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClasses()}>
        <caption className="pb-2 text-left text-sm text-zinc-600 dark:text-zinc-400">
          Commission rate by category, in {currency}.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className={TH}>
              Category
            </th>
            <th scope="col" className={TH}>
              Rate
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only sm:not-sr-only">Confidence</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              // Search text for `CategoryTableFilter`. Carried in the markup
              // rather than held in React state so the filter is additive: the
              // rows render identically whether or not the client component
              // that reads this attribute ever runs.
              data-search={`${row.parentLabel ?? ''} ${row.name}`.trim().toLowerCase()}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <th scope="row" className={`${TD} font-medium text-zinc-900 dark:text-zinc-100`}>
                {showParentLabel && row.parentLabel ? (
                  <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-500">
                    {row.parentLabel}
                  </span>
                ) : null}
                <span className="block">{row.name}</span>
                {row.tier ? (
                  <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-500">
                    {row.tier}
                  </span>
                ) : null}
              </th>
              <td className={TD}>
                <span className="font-medium">{row.rateLabel}</span>
                {row.secondaryRateLabel ? (
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    {row.secondaryRateLabel}
                  </span>
                ) : null}
              </td>
              <td className={TD}>
                <Badge level={row.confidence} label="" />
                <span className="sr-only">{row.confidence}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Transaction and fixed fees.
 *
 * A fee's "rate" is not always a percentage, so the rate cell is rendered by
 * `describeFeeRate`, which switches on the shape of the underlying record. That
 * is what keeps MY's flat RM 0.54 per-order support fee from being printed as
 * "54%".
 */
export function FeeLineTable({ lines, caption }: { lines: FeeLine[]; caption: string }) {
  if (lines.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className={tableClasses()}>
        <caption className="pb-2 text-left text-sm text-zinc-600 dark:text-zinc-400">{caption}</caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className={TH}>
              Fee
            </th>
            <th scope="col" className={TH}>
              Rate
            </th>
            <th scope="col" className={TH}>
              Effective
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">Confidence</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr
              key={`${line.label}-${index}`}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <th scope="row" className={`${TD} font-medium text-zinc-900 dark:text-zinc-100`}>
                <span className="block">{line.label}</span>
                {line.base ? (
                  <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">
                    Base: {line.base}
                    {line.taxInclusive === true ? ' (tax inclusive)' : null}
                    {line.taxInclusive === false ? ' (excl. tax)' : null}
                  </span>
                ) : null}
                {line.details?.map((detail) => (
                  <span
                    key={detail}
                    className="block text-xs font-normal text-zinc-600 dark:text-zinc-400"
                  >
                    {detail}
                  </span>
                ))}
                {line.sourceUrl ? (
                  <a
                    href={line.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-normal underline underline-offset-2 dark:text-zinc-300"
                  >
                    {sourceHost(line.sourceUrl)}
                    <span className="sr-only"> - official source, opens in a new tab</span>
                  </a>
                ) : null}
                {line.notes ? (
                  <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-500">
                    {line.notes}
                  </span>
                ) : null}
              </th>
              <td className={`${TD} font-medium`}>{describeFeeRate(line.value)}</td>
              <td className={`${TD} text-xs text-zinc-600 dark:text-zinc-400`}>
                {line.effectiveFrom ? formatIsoDate(line.effectiveFrom) : '—'}
              </td>
              <td className={TD}>
                <Badge level={line.confidence} label="" />
                <span className="sr-only">{line.confidence}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Category exceptions: thresholds, dual rates and promotional zero rates. */
export function CategoryExceptionList({ rows }: { rows: CategoryExceptionRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => (
        <li
          key={`${row.category}-${index}`}
          className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.category}</p>
            <Badge level={row.confidence} label="" />
            <span className="sr-only">{row.confidence}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Tier summary and dated default rates, e.g. BXP vs Standard in SG. */
export function TierNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {notes.map((note) => (
        <li key={note} className="text-sm text-zinc-700 dark:text-zinc-300">
          {note}
        </li>
      ))}
    </ul>
  );
}

/** Markets that publish a rate range instead of a single number. */
export function KnownRangeList({
  ranges,
}: {
  ranges: { key: string; label: string }[];
}) {
  if (ranges.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {ranges.map((range) => (
        <li key={range.key} className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{range.key}</span>:{' '}
          {range.label}
        </li>
      ))}
    </ul>
  );
}
