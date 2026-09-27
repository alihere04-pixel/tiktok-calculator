'use client';

import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/results/format';
import type { ConfidenceLevel, ResultFeeLine } from '@/lib/results/types';

/**
 * PRD section 10, item 6: where every number came from.
 *
 * Deliberately sorted worst-confidence-first rather than in fee order. The fee
 * table answers "what did I pay"; this panel answers "can I trust it", and the
 * fees that need verification are the reason a seller would open it at all.
 * Putting them at the top is the only ordering that makes that useful.
 */
const SEVERITY: Record<ConfidenceLevel, number> = {
  'needs-verification': 0,
  low: 1,
  medium: 2,
  high: 3,
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourceAttributionPanel({ fees }: { fees: ResultFeeLine[] }) {
  const sorted = [...fees].sort((a, b) => SEVERITY[a.confidence] - SEVERITY[b.confidence]);
  const unverified = fees.filter(
    (fee) => fee.confidence === 'needs-verification' || fee.confidence === 'low'
  ).length;

  if (fees.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {fees.length} fee{fees.length === 1 ? '' : 's'} priced, sorted by how well verified each
        source is.
        {unverified > 0 ? (
          <>
            {' '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {unverified} of them need verification - treat those numbers as an estimate.
            </span>
          </>
        ) : (
          <> All sources are verified against an official page.</>
        )}
      </p>

      <ul className="space-y-2">
        {sorted.map((fee, index) => (
          <li
            key={`${fee.name}-${index}`}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{fee.name}</p>
              <Badge level={fee.confidence} />
            </div>

            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Rate</dt>
                <dd className="text-zinc-800 sm:mt-0.5 dark:text-zinc-200">{fee.rate}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Effective from</dt>
                <dd className="sm:mt-0.5">{formatDate(fee.effectiveDate)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Last verified</dt>
                <dd className="sm:mt-0.5">{formatDate(fee.lastVerified)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-zinc-600 dark:text-zinc-400">Source</dt>
                <dd className="sm:mt-0.5">
                  <a
                    href={fee.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {hostOf(fee.sourceUrl)}
                    <span className="sr-only"> - official source for {fee.name}</span>
                  </a>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
