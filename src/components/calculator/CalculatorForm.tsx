'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCalculator } from '@/hooks/useCalculator';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { Market } from '@/hooks/useCalculator';
import type { CalculatorInputs } from '@/lib/calculation/types';
import { DEFAULT_MONTHLY_UNITS, DEFAULT_TARGET_PROFIT, DEFAULT_TARGET_ROAS } from '@/lib/results/defaults';
import type { ResultSnapshot } from '@/lib/results/types';
import { runCalculation } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { ResultsPanel } from '@/components/results/ResultsPanel';
import { CalculationErrorState } from '@/components/results/CalculationErrorState';
import { SectionA_MarketProduct } from './SectionA_MarketProduct';
import { SectionB_DiscountsShipping } from './SectionB_DiscountsShipping';
import { SectionC_Costs } from './SectionC_Costs';
import { SectionD_AffiliateMarketing } from './SectionD_AffiliateMarketing';
import { SectionE_Advanced } from './SectionE_Advanced';
import { SectionF_Fulfillment } from './SectionF_Fulfillment';
import { SectionG_Programs } from './SectionG_Programs';

interface CalculatedResult {
  /**
   * A copy of the inputs the snapshot was produced from. Kept alongside the
   * snapshot so the panel can be told it is stale, and so a re-run of its
   * reverse calculators always uses a consistent base.
   */
  inputs: CalculatorInputs;
  snapshot: ResultSnapshot;
}

/**
 * Composes all seven input sections over a single shared calculator state, and
 * owns the calculate-and-display cycle.
 *
 * The state lives here rather than inside each section: if every section called
 * useCalculator itself it would own a separate copy, so changing the market in
 * Section A would not update Section B.
 *
 * The results panel is rendered *outside* the <form> because it contains its
 * own inputs (target profit, ROAS, monthly units) and nesting a second form's
 * worth of controls inside this one would be invalid HTML.
 */
export function CalculatorForm({
  ratesByMarket,
}: {
  ratesByMarket: Partial<Record<Market, MarketRateSummary>>;
}) {
  const calculator = useCalculator(ratesByMarket);
  const { inputs } = calculator;

  const [result, setResult] = useState<CalculatedResult | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [isPending, setIsPending] = useState(false);

  /**
   * Value comparison, not reference: `update()` rebuilds the object on every
   * keystroke, so identity would report "stale" while the user is still typing
   * inside a single field.
   */
  const isStale =
    result !== null && JSON.stringify(inputs) !== JSON.stringify(result.inputs);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);

    runCalculation({
      inputs,
      targetProfit: DEFAULT_TARGET_PROFIT,
      targetROAS: DEFAULT_TARGET_ROAS,
      monthlyUnits: DEFAULT_MONTHLY_UNITS,
    })
      .then((outcome) => {
        if (outcome.ok) {
          setResult({ inputs: { ...inputs }, snapshot: outcome.snapshot });
          setErrors(null);
        } else {
          setErrors(outcome.errors);
        }
      })
      .catch(() => {
        setErrors(['Could not reach the calculation service. Please try again.']);
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <SectionA_MarketProduct calculator={calculator} />
        <SectionB_DiscountsShipping calculator={calculator} />
        <SectionC_Costs calculator={calculator} />
        <SectionD_AffiliateMarketing calculator={calculator} />
        <SectionE_Advanced calculator={calculator} />
        <SectionF_Fulfillment calculator={calculator} />
        <SectionG_Programs calculator={calculator} />

        <div className="pt-1">
          <Button type="submit" size="lg" fullWidth disabled={isPending}>
            {isPending ? 'Calculating...' : 'Calculate Profit'}
          </Button>
        </div>
      </form>

      {/*
        Results are never rendered speculatively: the panel appears only after a
        successful calculation, and a validation failure shows the error list
        instead of a panel full of zeros.
      */}
      {errors && errors.length > 0 ? (
        <CalculationErrorState
          errors={errors}
          onDismiss={() => setErrors(null)}
        />
      ) : null}

      {result && !errors ? (
        <ResultsPanel
          // Remounting on each successful calculation resets the reverse
          // calculator and projection inputs back to their defaults.
          key={result.snapshot.calculatedAt}
          inputs={result.inputs}
          initialSnapshot={result.snapshot}
          isStale={isStale}
        />
      ) : null}
    </div>
  );
}
