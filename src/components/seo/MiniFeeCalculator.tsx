'use client';

import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { runCalculation } from '@/app/actions';
import { formatMoney, formatPercent } from '@/lib/results/format';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { ResultSnapshot } from '@/lib/results/types';

/**
 * Mini fee estimator for the SEO pages: price + category -> platform fees.
 *
 * This does not contain any fee maths. It calls the same `runCalculation` server
 * action the main calculator uses, which calls the same engine, so a figure
 * quoted here and a figure from the full calculator are the same figure by
 * construction rather than by agreement.
 *
 * It cannot import the engine directly: `@/lib/calculation` reaches
 * `@/lib/rates/loader` and therefore `fs`, which does not exist in a browser
 * bundle. The server action is the boundary, exactly as on the home page.
 *
 * Every input other than price and category is pinned to zero. That is
 * deliberate: this widget estimates platform fees, which is what a reader
 * comparing fee tables wants, and leaving cost fields at zero keeps the number
 * from implying a profit estimate it cannot support. Cost inputs belong in the
 * full calculator, which the panel links to.
 */
export function MiniFeeCalculator({ rates }: { rates: MarketRateSummary }) {
  const priceId = useId();
  const [price, setPrice] = useState('25');
  const [categoryId, setCategoryId] = useState(rates.categories[0]?.id ?? '');
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // MY stores four categories that share the name "Electronics (example:
  // Guitar)", differing only by seller tier. Left alone the category picker
  // would show four identical rows, so a name that repeats gets its tier
  // appended.
  const nameCounts = new Map<string, number>();
  for (const category of rates.categories) {
    nameCounts.set(category.name, (nameCounts.get(category.name) ?? 0) + 1);
  }

  const options: SelectOption[] = rates.categories.map((category) => ({
    value: category.id,
    label:
      (nameCounts.get(category.name) ?? 0) > 1 && category.tier
        ? `${category.name} - ${category.tier}`
        : category.name,
    group: category.parentCategory,
  }));

  const selected = rates.categories.find((c) => c.id === categoryId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrors(['Enter a price greater than 0 to estimate fees.']);
      setSnapshot(null);
      return;
    }

    startTransition(async () => {
      const outcome = await runCalculation({
        inputs: {
          market: rates.market,
          sellerTier: null,
          categoryId,
          sellingPrice: parsed,
          sellerDiscount: 0,
          platformDiscount: 0,
          customerShipping: 0,
          cogs: 0,
          outboundShipping: 0,
          affiliateMode: 'none',
          affiliateRate: 0,
          returnRate: 0,
          cpa: 0,
          newSellerPromo: false,
          promoDaysRemaining: 0,
          fulfillmentMethod: 'selfShip',
          isPreOrder: false,
          isShippingProgramEnrolled: false,
          isGMVMaxActive: false,
        },
        targetProfit: 5,
        targetROAS: 4,
        monthlyUnits: 500,
      });

      if (outcome.ok) {
        setSnapshot(outcome.snapshot);
        setErrors([]);
      } else {
        setSnapshot(null);
        setErrors(outcome.errors);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id={priceId}
          label={`Selling price (${rates.currency})`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          helperText="What the buyer pays, before any seller discount."
        />

        <Select
          label="Category"
          value={categoryId}
          options={options}
          onChange={setCategoryId}
          searchable
          helperText={
            selected?.tier ? `Seller tier: ${selected.tier}` : 'Pick the category you sell in.'
          }
        />
      </div>

      <Button type="submit" disabled={pending} fullWidth>
        {pending ? 'Calculating…' : 'Estimate platform fees'}
      </Button>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
        >
          <p className="font-medium">Could not estimate fees</p>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot ? (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Estimated platform fees</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMoney(snapshot.totalPlatformFees, snapshot.currency)}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatPercent(snapshot.effectiveTakeRate)} of the {formatMoney(Number(price), snapshot.currency)} price
          </p>

          {snapshot.fees.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {snapshot.fees.map((fee, index) => (
                <li
                  key={`${fee.name}-${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">{fee.name}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMoney(fee.amount, snapshot.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              This category and price produced no separate fee lines in the engine.
            </p>
          )}

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Platform fees only. This is not a profit estimate - add your costs in the full calculator.
          </p>
        </div>
      ) : null}
    </form>
  );
}
