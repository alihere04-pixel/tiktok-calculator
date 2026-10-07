'use client';

import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';

/** Time-limited rate promotions. */
export function SectionE_Advanced({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, update, money, conditional } = calculator;

  if (!conditional.newSellerPromo) {
    return (
      <Collapsible
        headingLevel="h2"
        title="Promotions"
        description="Time-limited rate reductions."
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No promotional rate programs are modelled for the selected market.
        </p>
      </Collapsible>
    );
  }

  return (
    <Collapsible
      headingLevel="h2"
      title="Promotions"
      description="Time-limited rate reductions."
      defaultOpen
    >
      <div className="space-y-4">
      <Toggle
        label="New seller promo active"
        checked={inputs.newSellerPromo}
        onChange={(checked) => update('newSellerPromo', checked)}
        description="Applies the reduced new-seller commission instead of the standard rate."
      />

      {conditional.promoDays ? (
        <Input
          label="Promo days remaining"
          labelSuffix={
            <Tooltip
              content="The promo only counts while days remain. Once it reaches zero the standard rate applies again. The US promo rate is currently unverified, so treat it as an estimate."
              label="About promo days"
            />
          }
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          step={1}
          required
          value={money.value('promoDaysRemaining')}
          onChange={money.onChange('promoDaysRemaining')}
          error={
            inputs.promoDaysRemaining < 1 || inputs.promoDaysRemaining > 90
              ? 'Must be between 1 and 90 days'
              : undefined
          }
          suffix="days"
          placeholder="30"
          helperText="1 to 90. A promo with no days left is treated as inactive."
        />
      ) : null}
      </div>
    </Collapsible>
  );
}
