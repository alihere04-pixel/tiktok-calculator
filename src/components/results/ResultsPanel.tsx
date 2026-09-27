'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { runCalculation } from '@/app/actions';
import type { CalculatorInputs } from '@/lib/calculation/types';
import { formatDate } from '@/lib/results/format';
import type { ResultSnapshot } from '@/lib/results/types';
import { SummaryCards } from './SummaryCards';
import { ProfitWaterfall } from './ProfitWaterfall';
import { FeeBreakdownTable } from './FeeBreakdownTable';
import { ReverseCalculatorCards } from './ReverseCalculatorCards';
import { MonthlyProjectionCard } from './MonthlyProjectionCard';
import { SourceAttributionPanel } from './SourceAttributionPanel';

const REFRESH_DELAY_MS = 300;

/**
 * PRD section 10. Renders only when a calculation has already succeeded; the
 * form decides that, and this component is never mounted otherwise.
 *
 * `inputs` must be the snapshot of inputs that produced `initialSnapshot`, not
 * the live form state. That guarantee is what lets the reverse-calculator cards
 * re-run against a consistent base even after the user has edited the form.
 */
export function ResultsPanel({
  inputs,
  initialSnapshot,
  isStale,
}: {
  inputs: CalculatorInputs;
  initialSnapshot: ResultSnapshot;
  isStale: boolean;
}) {
  // Frozen on mount so later form edits cannot change what a re-run calculates.
  const [calculationInputs] = useState(inputs);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [targetProfit, setTargetProfit] = useState(initialSnapshot.reverse.targetProfitInput);
  const [targetROAS, setTargetROAS] = useState(initialSnapshot.reverse.targetROAS);
  const [monthlyUnits, setMonthlyUnits] = useState(initialSnapshot.projection.monthlyUnits);
  const [isPending, setIsPending] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // The mount snapshot already reflects these three values, so the first effect
  // pass is skipped instead of firing an identical request.
  const isFirstPass = useRef(true);

  useEffect(() => {
    if (isFirstPass.current) {
      isFirstPass.current = false;
      return;
    }

    let cancelled = false;
    // Debounced so typing a target profit does not fire one request per keystroke.
    const timer = setTimeout(() => {
      setIsPending(true);
      runCalculation({ inputs: calculationInputs, targetProfit, targetROAS, monthlyUnits })
        .then((outcome) => {
          if (cancelled) return;
          if (outcome.ok) {
            setSnapshot(outcome.snapshot);
            setRefreshError(null);
          } else {
            // Keep the last good numbers on screen: a failed refresh should not
            // wipe a valid result the user is still reading.
            setRefreshError(outcome.errors[0] ?? 'Could not update these figures.');
          }
        })
        .catch(() => {
          if (!cancelled) setRefreshError('Could not reach the calculation service.');
        })
        .finally(() => {
          if (!cancelled) setIsPending(false);
        });
    }, REFRESH_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [calculationInputs, monthlyUnits, targetProfit, targetROAS]);

  return (
    <div aria-live="polite" className="space-y-3">
      {isStale ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          You changed the inputs after this result was calculated, so these figures are out of date.
          Use the Calculate Profit button above to refresh them.
        </p>
      ) : null}

      {refreshError ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {refreshError} The figures below are from your last successful calculation.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Your result"
          description={`Per unit, in ${snapshot.currency}. Rates: ${snapshot.rateVersion}, last verified ${formatDate(
            snapshot.calculatedAt.slice(0, 10)
          )}.`}
        />
        <CardBody>
          <SummaryCards snapshot={snapshot} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Profit waterfall"
          description="Where the selling price goes on the way to net profit."
        />
        <CardBody>
          <ProfitWaterfall snapshot={snapshot} inputs={calculationInputs} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Fee breakdown"
          description="Every fee the engine charged. Expand a row for its full audit trail."
        />
        <CardBody>
          <FeeBreakdownTable snapshot={snapshot} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Reverse calculator"
          description="Work backwards from the profit or ad spend you want."
        />
        <CardBody>
          <ReverseCalculatorCards
            snapshot={snapshot}
            targetProfit={targetProfit}
            targetROAS={targetROAS}
            onTargetProfitChange={setTargetProfit}
            onTargetROASChange={setTargetROAS}
            isPending={isPending}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Monthly projection"
          description="Straight-line volume projection at your current per-unit result."
        />
        <CardBody>
          <MonthlyProjectionCard
            snapshot={snapshot}
            monthlyUnits={monthlyUnits}
            onMonthlyUnitsChange={setMonthlyUnits}
            isPending={isPending}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Source attribution"
          description="The rate behind every line above, and how much to trust it."
        />
        <CardBody>
          <SourceAttributionPanel fees={snapshot.fees} />
        </CardBody>
      </Card>
    </div>
  );
}
