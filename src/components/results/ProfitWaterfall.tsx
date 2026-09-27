'use client';

import { formatMoney, formatPercent, formatShare } from '@/lib/results/format';
import type { CalculatorInputs } from '@/lib/calculation/types';
import type { ResultSnapshot } from '@/lib/results/types';

interface Segment {
  key: string;
  label: string;
  amount: number;
  color: string;
}

const BAR_HEIGHT = 'h-8';

/**
 * PRD section 10, item 3: a horizontal stacked bar walking the selling price
 * down to net profit.
 *
 * The segment order mirrors the engine's own net-profit formula in
 * `src/lib/calculation/index.ts` exactly - price minus platform fees, COGS,
 * outbound shipping and ad spend - so the bar always reconciles with the
 * Net Profit summary card rather than telling a second, divergent story.
 */
export function ProfitWaterfall({
  snapshot,
  inputs,
}: {
  snapshot: ResultSnapshot;
  inputs: CalculatorInputs;
}) {
  const { currency, totalPlatformFees, netProfit } = snapshot;
  const { sellingPrice, cogs, outboundShipping, cpa } = inputs;

  const selling = formatMoney(sellingPrice, currency);
  const deductions: Segment[] = [
    { key: 'fees', label: 'Platform fees', amount: totalPlatformFees, color: 'bg-red-500' },
    { key: 'cogs', label: 'COGS', amount: cogs, color: 'bg-amber-500' },
    { key: 'shipping', label: 'Outbound shipping', amount: outboundShipping, color: 'bg-blue-500' },
    { key: 'ads', label: 'Ad spend', amount: cpa, color: 'bg-purple-500' },
  ];

  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return null;
  }

  // A loss means the deductions are wider than the price, so the bar is scaled
  // to the larger of the two and clamped. Without this the segments would
  // overflow their container and misreport their relative size.
  const totalDeducted = deductions.reduce((sum, segment) => sum + segment.amount, 0);
  const scale = Math.max(sellingPrice, totalDeducted);
  const isLoss = netProfit < 0;

  const rows = [
    { key: 'price', label: 'Selling price', amount: sellingPrice, color: 'bg-zinc-800 dark:bg-zinc-200' },
    ...deductions,
  ];

  return (
    <div className="space-y-3">
      <div
        aria-hidden="true"
        className={`flex w-full overflow-hidden rounded-md ${BAR_HEIGHT}`}
      >
        {rows.map((row) => {
          const width = Math.max(0, Math.min(100, (row.amount / scale) * 100));
          if (width === 0) return null;
          return (
            <div
              key={row.key}
              style={{ width: `${width}%` }}
              className={`${row.color} h-full ${isLoss ? 'opacity-90' : ''}`}
            />
          );
        })}
      </div>

      {/*
        The bar is decorative, so the numbers live in a real list instead. Screen
        reader users get every amount and percentage without needing the
        aria-label on a div full of empty colour.
      */}
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm bg-zinc-800 dark:bg-zinc-200" aria-hidden="true" />
            <span className="font-medium">Selling price</span>
          </span>
          <span className="shrink-0 tabular-nums">
            {selling} <span className="text-zinc-500 dark:text-zinc-400">({formatPercent(1)})</span>
          </span>
        </li>

        {deductions.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-sm ${segment.color}`} aria-hidden="true" />
              <span className="text-zinc-600 dark:text-zinc-400">− {segment.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatMoney(segment.amount, currency)}{' '}
              <span className="text-zinc-500">({formatShare(segment.amount, sellingPrice)})</span>
            </span>
          </li>
        ))}

        <li className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
          <span
            className={`font-semibold ${isLoss ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
          >
            = Net profit
          </span>
          <span
            className={`shrink-0 font-semibold tabular-nums ${isLoss ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
          >
            {formatMoney(netProfit, currency)} ({formatShare(netProfit, sellingPrice)})
          </span>
        </li>
      </ul>

      {isLoss ? (
        <p className="text-xs text-red-700 dark:text-red-400">
          Your costs exceed the selling price, so the bar is scaled to the larger of the two. The
          percentages above are still shares of your selling price.
        </p>
      ) : null}

      {inputs.customerShipping > 0 ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Shipping charged to the customer is not shown as a cost. The buyer pays it, and it only
          increases the base that some fees are applied to.
        </p>
      ) : null}
    </div>
  );
}
