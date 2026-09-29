'use client';

import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';

/** The two costs that hit every sale regardless of how it sells. */
export function SectionC_Costs({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, money, marketOptions } = calculator;
  const currency = marketOptions.find((m) => m.value === inputs.market)?.currency ?? '';

  return (
    <Collapsible headingLevel="h2" title="Costs" description="What the unit costs you to buy and deliver." defaultOpen>
      <div className="space-y-4">
      <Input
        label="Cost of goods (COGS)"
        labelSuffix={
          <Tooltip
            content="What you pay the supplier per unit, including packaging. This is not a platform fee, but it is the main reason a sale can be unprofitable."
            label="About cost of goods"
          />
        }
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        required
        value={money.value('cogs')}
        onChange={money.onChange('cogs')}
        prefix={currency || undefined}
        placeholder="0.00"
        helperText="Your landed cost per unit."
      />

      <Input
        label="Outbound shipping cost"
        labelSuffix={
          <Tooltip
            content="What you pay to ship the unit to the buyer. If the buyer pays the courier instead, leave this at zero and set customer shipping instead."
            label="About outbound shipping"
          />
        }
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        required
        value={money.value('outboundShipping')}
        onChange={money.onChange('outboundShipping')}
        prefix={currency || undefined}
        placeholder="0.00"
        helperText="Your shipping cost per unit. Enter 0 if the customer pays it."
      />
      </div>
    </Collapsible>
  );
}
