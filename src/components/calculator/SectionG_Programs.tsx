'use client';

import { Toggle } from '@/components/ui/Toggle';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';

/**
 * Section G: program enrollments.
 *
 * These are opt-in programs that add a fee, not fulfillment choices, so they
 * are kept out of Section F. Each toggle is gated on MARKET_CAPABILITIES
 * because each fee exists only in specific markets:
 *   - Pre-order: PH, SG, MY
 *   - Shipping Program: PH only
 *   - GMV Max: disabled everywhere for Phase 2
 */
export function SectionG_Programs({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, update, conditional } = calculator;

  const showsAny = conditional.preOrder || conditional.shippingProgram || conditional.gmvMax;

  if (!showsAny) {
    return (
      <Collapsible headingLevel="h2" title="Programs & promotions" description="Optional paid program enrollments.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No optional programs are modelled for the selected market.
        </p>
      </Collapsible>
    );
  }

  return (
    <Collapsible
      headingLevel="h2"
      title="Programs & promotions"
      description="Optional paid program enrollments."
      defaultOpen
    >
      <div className="space-y-4">
        {conditional.preOrder ? (
          <Toggle
            label="This is a pre-order product"
            checked={inputs.isPreOrder}
            onChange={(checked) => update('isPreOrder', checked)}
            description="Adds the pre-order service fee: 2% in the Philippines, 1.09% in Singapore, 2% in Malaysia."
          />
        ) : null}

        {conditional.shippingProgram ? (
          <Toggle
            label="Enrolled in the TikTok Shipping Program"
            checked={inputs.isShippingProgramEnrolled}
            onChange={(checked) => update('isShippingProgramEnrolled', checked)}
            description="Adds the Philippines shipping service fee, a percentage of net price plus a fixed amount per order."
          />
        ) : null}

        {conditional.gmvMax ? (
          <Toggle
            label="GMV Max active"
            checked={inputs.isGMVMaxActive}
            onChange={(checked) => update('isGMVMaxActive', checked)}
            description="Caps your commission on qualifying orders."
          />
        ) : null}
      </div>
    </Collapsible>
  );
}
