'use client';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatMoney } from '@/lib/results/format';
import type { ResultSnapshot } from '@/lib/results/types';

/**
 * PRD section 10, item 4: the engine's three reverse calculators.
 *
 * All three numbers come from `CalculationResult` closures that the server
 * already evaluated - this component only collects the two inputs it needs and
 * asks for a re-run. It never re-derives a price itself.
 */
export function ReverseCalculatorCards({
  snapshot,
  targetProfit,
  targetROAS,
  onTargetProfitChange,
  onTargetROASChange,
  isPending,
}: {
  snapshot: ResultSnapshot;
  targetProfit: number;
  targetROAS: number;
  onTargetProfitChange: (value: number) => void;
  onTargetROASChange: (value: number) => void;
  isPending: boolean;
}) {
  const { currency, breakEvenPrice, reverse } = snapshot;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card as="div" className="p-4 sm:p-5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Break-even price</h3>
          <Tooltip
            content="The lowest price at which you neither make nor lose money, with your current costs, fees and ad spend."
            label="About break-even price"
          />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(breakEvenPrice, currency)}</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Minimum selling price for zero profit.
        </p>
      </Card>

      <Card as="div" className="p-4 sm:p-5">
        <Input
          label="Target profit price"
          labelSuffix={
            <Tooltip
              content="Enter the profit you want per unit. We find the lowest price that still delivers it after every fee, your costs and ad spend."
              label="About target profit price"
            />
          }
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={targetProfit}
          onChange={(event) =>
            onTargetProfitChange(event.target.value === '' ? 0 : Number(event.target.value))
          }
          prefix={currency || undefined}
          helperText="Target profit per unit, in your currency."
        />
        {reverse.targetProfitAchievable ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sell at{' '}
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatMoney(reverse.targetProfitPrice, currency)}
            </span>{' '}
            to make {formatMoney(targetProfit, currency)} per unit.
            {/*
              F-04/F-11: this price is solved from the fees the engine could
              price. With any fee missing it is a floor, not a quote, and the
              difference is large enough to change a go/no-go decision.
            */}
            {snapshot.unpricedFees.length > 0 ? (
              <span className="mt-1 block text-amber-700 dark:text-amber-400">
                Best case: {snapshot.unpricedFees.length === 1 ? 'one fee is' : `${snapshot.unpricedFees.length} fees are`}{' '}
                not priced, so the real price to hit this target is higher.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {formatMoney(targetProfit, currency)} profit per unit is not reachable at any price with
            these costs. Try a smaller target.
          </p>
        )}
      </Card>

      <Card as="div" className="p-4 sm:p-5">
        <Input
          label="Max CPA"
          labelSuffix={
            <Tooltip
              content="The most you can spend to acquire one sale and still hit your target return on ad spend. The lower of your ROAS limit and your profit limit wins."
              label="About max CPA"
            />
          }
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={targetROAS}
          onChange={(event) =>
            onTargetROASChange(event.target.value === '' ? 0 : Number(event.target.value))
          }
          suffix="x ROAS"
          helperText="Target return on ad spend. The PRD default is 4x."
        />
        {reverse.maxCPA > 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Up to{' '}
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatMoney(reverse.maxCPA, currency)}
            </span>{' '}
            per sale at {reverse.targetROAS}x ROAS.
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            There is no room for ad spend at this price - fees and costs already use it all.
          </p>
        )}
      </Card>

      {isPending ? (
        <p role="status" className="text-xs text-zinc-500 lg:col-span-3 dark:text-zinc-400">
          Updating reverse calculations...
        </p>
      ) : null}
    </div>
  );
}
