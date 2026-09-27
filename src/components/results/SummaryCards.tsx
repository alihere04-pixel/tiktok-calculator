'use client';

import { Tooltip } from '@/components/ui/Tooltip';
import { formatMoney, formatPercent } from '@/lib/results/format';
import type { ResultSnapshot } from '@/lib/results/types';

type Tone = 'positive' | 'negative' | 'neutral' | 'warning' | 'info';

const TONE_STYLES: Record<Tone, string> = {
  positive:
    'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
  negative: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
  neutral: 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  info: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40',
};

const TONE_VALUE: Record<Tone, string> = {
  positive: 'text-green-700 dark:text-green-400',
  negative: 'text-red-700 dark:text-red-400',
  neutral: 'text-zinc-700 dark:text-zinc-300',
  warning: 'text-amber-700 dark:text-amber-400',
  info: 'text-blue-700 dark:text-blue-400',
};

function StatCard({
  label,
  value,
  detail,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  tooltip: string;
}) {
  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-zinc-600 sm:text-sm dark:text-zinc-400">{label}</p>
        <Tooltip content={tooltip} label={`About ${label.toLowerCase()}`} />
      </div>
      <p
        className={`mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl ${TONE_VALUE[tone]}`}
      >
        {value}
      </p>
      {/*
        The word is the non-colour signal: the tone is decorative reinforcement,
        so the card still reads correctly in greyscale or with colour-blindness.
      */}
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

function profitTone(netProfit: number): Tone {
  if (netProfit > 0) return 'positive';
  if (netProfit < 0) return 'negative';
  return 'neutral';
}

function profitDetail(netProfit: number): string {
  if (netProfit > 0) return 'Profit per unit';
  if (netProfit < 0) return 'Loss per unit';
  return 'Break even';
}

/** PRD section 10 thresholds: green at 20% and above, amber from 10%, red below. */
function marginTone(margin: number): Tone {
  if (margin >= 0.2) return 'positive';
  if (margin >= 0.1) return 'warning';
  return 'negative';
}

function marginDetail(margin: number): string {
  if (margin >= 0.2) return 'Healthy margin';
  if (margin >= 0.1) return 'Thin margin';
  return 'Below 10% margin';
}

/** The four always-visible headline numbers (PRD section 10, item 1). */
export function SummaryCards({ snapshot }: { snapshot: ResultSnapshot }) {
  const { currency, netProfit, profitMargin, effectiveTakeRate, breakEvenPrice } = snapshot;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Net profit / unit"
        value={formatMoney(netProfit, currency)}
        detail={profitDetail(netProfit)}
        tone={profitTone(netProfit)}
        tooltip="Selling price minus every platform fee, COGS, outbound shipping and ad spend. A negative number means you lose money on every sale."
      />
      <StatCard
        label="Profit margin"
        value={formatPercent(profitMargin)}
        detail={marginDetail(profitMargin)}
        tone={marginTone(profitMargin)}
        tooltip="Net profit as a percentage of your selling price. 20% or more is shown as healthy, 10-20% as thin, below 10% as a warning."
      />
      <StatCard
        label="Effective take rate"
        value={formatPercent(effectiveTakeRate)}
        detail="All fees combined"
        tone="info"
        tooltip="Every platform fee added together as a percentage of your selling price - the single number that tells you what the platform actually takes."
      />
      <StatCard
        label="Break-even price"
        value={formatMoney(breakEvenPrice, currency)}
        detail="Minimum for 0 profit"
        tone="neutral"
        tooltip="The lowest selling price at which profit is exactly zero, found by the engine by re-pricing your product with your current settings."
      />
    </div>
  );
}
