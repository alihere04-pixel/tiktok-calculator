'use client';

import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';

/**
 * Section F: fulfillment.
 *
 * This section used to offer a US-only FBT vs Self-ship radio plus product
 * weight and dimensions. None of those three inputs were read by any engine and
 * the US rate file carries no FBT fee, so the control asked a question whose
 * answer could not change the result. The section collected the values anyway
 * "so engine support could be added without a form change", which only meant
 * dead state that every caller and test had to carry.
 *
 * The inputs have been removed rather than hidden behind a flag, so the shape of
 * `CalculatorInputs` now matches what the engines actually use. The explanation
 * stays: sellers still need to know where to put their fulfillment cost, and
 * the honest answer is the outbound shipping field.
 */
export function SectionF_Fulfillment({ calculator }: { calculator: UseCalculatorReturn }) {
  const { conditional } = calculator;

  return (
    <Collapsible
      headingLevel="h2"
      title="Fulfillment"
      description="How the order is fulfilled."
    >
      {conditional.fulfillment ? null : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            Fulfilled by TikTok fees are not in the rate data for any market yet, so there is
            nothing to choose here: a fulfillment selector would not change the result.
          </p>
          <p className="mt-1.5">
            FBT calculation support is planned for a future update. Until then, use the
            Self-Ship / Outbound Shipping Cost field to estimate your fulfillment cost.
          </p>
        </div>
      )}
    </Collapsible>
  );
}
