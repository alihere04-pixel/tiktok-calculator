'use client';

import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatMoney } from '@/lib/results/format';
import type { ResultSnapshot } from '@/lib/results/types';

/** PRD section 10, item 5: monthly units in, monthly money out. */
export function MonthlyProjectionCard({
  snapshot,
  monthlyUnits,
  onMonthlyUnitsChange,
  isPending,
}: {
  snapshot: ResultSnapshot;
  monthlyUnits: number;
  onMonthlyUnitsChange: (value: number) => void;
  isPending: boolean;
}) {
  const { currency, projection, netProfit } = snapshot;

  const rows: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'GMV', value: formatMoney(projection.gmv, currency) },
    { label: 'Total fees', value: formatMoney(projection.totalFees, currency) },
    {
      label: 'Total profit',
      value: formatMoney(projection.totalProfit, currency),
      tone: projection.totalProfit < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400',
    },
    { label: 'Avg profit / unit', value: formatMoney(projection.avgProfitPerUnit, currency) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <Input
          label="Monthly units"
          labelSuffix={
            <Tooltip
              content="How many units you expect to sell in a month. Every figure here is your per-unit result multiplied by this number."
              label="About monthly units"
            />
          }
          type="number"
          inputMode="numeric"
          min={0}
          step="10"
          value={monthlyUnits}
          onChange={(event) =>
            onMonthlyUnitsChange(event.target.value === '' ? 0 : Number(event.target.value))
          }
          helperText="Straight-line projection. It does not model seasonality, ad budget changes or stock limits."
        />
        {monthlyUnits === 0 ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Enter a unit count above to see a projection.
          </p>
        ) : null}
      </div>

      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-zinc-600 dark:text-zinc-400">{row.label}</dt>
            <dd className={`font-medium tabular-nums ${row.tone ?? 'text-zinc-900 dark:text-zinc-100'}`}>
              {row.value}
            </dd>
          </div>
        ))}
        <p className="border-t border-zinc-200 pt-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {isPending ? 'Updating projection... ' : ''}
          Based on {formatMoney(netProfit, currency)} profit per unit.
        </p>
      </dl>
    </div>
  );
}
