'use client';

import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';
import type { FulfillmentMethod } from '@/lib/calculation/types';

/**
 * Section F: US fulfillment only (FBT vs Self-Ship).
 *
 * Program enrollments such as pre-order and the Shipping Program live in
 * Section G, because they are not fulfillment choices.
 *
 * Note on the FBT fields: `fulfillmentMethod`, `productWeightLb` and
 * `dimensionsIn` exist on CalculatorInputs, but no engine reads them and the US
 * rate file carries no FBT fee, so they are collected without affecting the
 * result. The banner says so plainly rather than implying the choice matters.
 * The values are stored so engine support can be added without a form change.
 */
export function SectionF_Fulfillment({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, update, conditional } = calculator;

  if (!conditional.fulfillment) {
    return (
      <Collapsible headingLevel="h2" title="Fulfillment" description="How the order is fulfilled.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Fulfillment options are only modelled for the United States.
        </p>
      </Collapsible>
    );
  }

  return (
    <Collapsible headingLevel="h2" title="Fulfillment" description="How the order is fulfilled." defaultOpen>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            No Fulfilled by TikTok fee is currently in the rate data, so these choices do not change
            the calculation yet.
          </p>
          <p className="mt-1.5">
            FBT calculation support is planned for a future update. Until then, use the Self-Ship /
            Outbound Shipping Cost field to estimate your fulfillment cost.
          </p>
        </div>

        <RadioGroup
          label="Fulfillment method"
          value={inputs.fulfillmentMethod}
          options={[
            { value: 'selfShip', label: 'Self-ship', description: 'You pack and ship the order.' },
            { value: 'fbt', label: 'Fulfilled by TikTok', description: 'TikTok stores and ships it.' },
          ]}
          onChange={(value) => update('fulfillmentMethod', value as FulfillmentMethod)}
          helperText="United States only."
        />

        {conditional.fbtDetails ? (
          <>
            <Input
              label="Product weight"
              labelSuffix={
                <Tooltip
                  content="Shipping weight of one unit, used for warehouse fulfilment pricing once FBT fees are modelled."
                  label="About product weight"
                />
              }
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={inputs.productWeightLb ?? ''}
              onChange={(event) =>
                update(
                  'productWeightLb',
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
              suffix="lb"
              placeholder="0.00"
              helperText="Shown for Fulfilled by TikTok only."
            />

            <Input
              label="Dimensions (L x W x H)"
              type="text"
              inputMode="text"
              value={inputs.dimensionsIn ?? ''}
              onChange={(event) =>
                update('dimensionsIn', event.target.value === '' ? undefined : event.target.value)
              }
              placeholder="e.g. 8 x 6 x 4"
              helperText="In inches, longest side first. Shown for Fulfilled by TikTok only."
            />
          </>
        ) : null}
      </div>
    </Collapsible>
  );
}
