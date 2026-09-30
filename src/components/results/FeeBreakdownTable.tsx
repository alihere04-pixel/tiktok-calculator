'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatMoney, formatMoneyCompact } from '@/lib/results/format';
import type { ResultFeeLine, ResultSnapshot } from '@/lib/results/types';

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M12 3a1 1 0 0 0 0 2h1.586l-5.293 5.293a1 1 0 1 0 1.414 1.414L15 6.414V8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-4Z" />
      <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 1 0 0-2H5Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * PRD section 10, item 2: every fee the engine charged, with the rate, the base
 * it was applied to, the resulting amount, an official-source link and notes.
 *
 * Rows expand to reveal the full audit trail for that one fee. The row itself
 * stays a real `<table>` (with a caption and column scopes) so the relationship
 * between a fee and its numbers survives; the wrapper only allows horizontal
 * scrolling on narrow screens.
 */
export function FeeBreakdownTable({ snapshot }: { snapshot: ResultSnapshot }) {
  const { currency, fees, totalPlatformFees } = snapshot;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (fees.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No platform fees apply to this market with your current settings.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">
          Fee breakdown for this product, with the rate, the amount it was applied to, and the
          resulting fee.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="py-2 pr-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Fee
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Rate
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Base
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Amount
            </th>
            <th scope="col" className="px-2 py-2 text-center font-medium text-zinc-600 dark:text-zinc-400">
              Source
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Details
            </th>
          </tr>
        </thead>

        <tbody>
          {fees.map((fee: ResultFeeLine, index) => {
            const key = `${index}-${fee.name}`;
            const isOpen = expanded[key] === true;
            const detailId = `fee-detail-${index}`;
            const isUnpriced = fee.pricing === 'unpriced';

            return (
              <tr
                key={key}
                className={`border-b align-top dark:border-zinc-800/60 ${
                  isUnpriced ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20' : 'border-zinc-100'
                }`}
              >
                <th scope="row" className="py-2.5 pr-2 text-left font-medium">
                  <span className="block">{fee.name}</span>
                  <Badge level={fee.confidence} className="mt-1" />
                  {isUnpriced ? (
                    // F-04: an unpriced line contributes 0 to the total, so it
                    // must never read as a fee that was genuinely charged at
                    // that amount.
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Not priced
                    </span>
                  ) : null}
                </th>
                <td className="px-2 py-2.5 text-zinc-600 dark:text-zinc-400">{fee.rate}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                  {isUnpriced ? (
                    <span className="text-amber-700 dark:text-amber-400">&mdash;</span>
                  ) : (
                    formatMoneyCompact(fee.base, currency)
                  )}
                </td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                  {isUnpriced ? (
                    <span className="text-amber-700 dark:text-amber-400">Not charged</span>
                  ) : (
                    formatMoney(fee.amount, currency)
                  )}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <a
                    href={fee.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Official source for ${fee.name}`}
                    className="inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-50"
                  >
                    <ExternalLinkIcon />
                  </a>
                </td>
                <td className="py-2.5 pl-2 text-right">
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-50"
                  >
                    <ChevronIcon open={isOpen} />
                    {isOpen ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-zinc-300 dark:border-zinc-700">
            <th scope="row" className="py-2.5 pr-2 text-left font-semibold">
              Total platform fees
            </th>
            <td className="px-2 py-2.5" />
            <td className="px-2 py-2.5" />
            <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
              {formatMoney(totalPlatformFees, currency)}
            </td>
            <td className="px-2 py-2.5" />
            <td className="py-2.5 pl-2" />
          </tr>
        </tfoot>
      </table>

      {snapshot.unpricedFees.length > 0 ? (
        // The total above is a floor, not a complete figure. Saying so here
        // stops the table from being read as the full cost of selling.
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong className="font-semibold">This total is incomplete.</strong>{' '}
          {snapshot.unpricedFees.length === 1 ? 'One fee is' : `${snapshot.unpricedFees.length} fees are`}{' '}
          not published in the rate data, so {snapshot.unpricedFees.length === 1 ? 'it is' : 'they are'} shown
          as &ldquo;not priced&rdquo; and excluded from the total:{' '}
          {snapshot.unpricedFees.join(', ')}. The real total will be higher, so treat net profit as an
          upper bound until {snapshot.unpricedFees.length === 1 ? 'that rate is' : 'those rates are'}{' '}
          verified in Seller Centre.
        </p>
      ) : null}

      {/*
        The expanded audit trail is rendered once, below the table, rather than as
        a per-row detail row. It keeps the table markup valid (a detail row would
        need a colSpan tied to the live column count) and reads better on mobile,
        where the table itself is horizontally scrolled.
      */}
      {fees.map((fee: ResultFeeLine, index) => {
        const key = `${index}-${fee.name}`;
        if (expanded[key] !== true) return null;

        return (
          <div
            key={`${key}-detail`}
            id={`fee-detail-${index}`}
            className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40"
          >
            <p className="font-medium">{fee.name}</p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Rate</dt>
                <dd className="sm:mt-0.5">{fee.rate}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Applied to</dt>
                <dd className="sm:mt-0.5 tabular-nums">{formatMoney(fee.base, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Effective from</dt>
                <dd className="sm:mt-0.5">{formatDate(fee.effectiveDate)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Last verified</dt>
                <dd className="sm:mt-0.5">{formatDate(fee.lastVerified)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-600 dark:text-zinc-400">Official source</dt>
                <dd className="mt-0.5">
                  <a
                    href={fee.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {fee.sourceUrl}
                    <ExternalLinkIcon />
                  </a>
                </dd>
              </div>
              {fee.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Notes</dt>
                  <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">{fee.notes}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
