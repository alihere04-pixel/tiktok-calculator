'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';

/** Discounts the seller funds, plus what the buyer pays for shipping. */
export function SectionB_DiscountsShipping({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, update, conditional, marketOptions } = calculator;

  const currency = marketOptions.find((m) => m.value === inputs.market)?.currency ?? '';

  const parseNumber = useCallback(
    (value: string) => (value === '' ? 0 : Number(value)),
    []
  );

  const sellerDiscountError =
    inputs.sellerDiscount > inputs.sellingPrice && inputs.sellingPrice > 0
      ? 'Seller discount cannot be more than the selling price'
      : undefined;

  return (
    <Collapsible
      headingLevel="h2"
      title="Discounts & shipping"
      description="Money taken off the price, and what the buyer pays for delivery."
      defaultOpen
    >
      <div className="space-y-4">
      <Input
        label="Seller discount"
        labelSuffix={
          <Tooltip
            content="A markdown you fund yourself, such as a sale or coupon. It lowers your commission base as well as your revenue."
            label="About seller discount"
          />
        }
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={inputs.sellerDiscount}
        onChange={(event) => update('sellerDiscount', parseNumber(event.target.value))}
        error={sellerDiscountError}
        prefix={currency || undefined}
        placeholder="0.00"
        helperText="Optional. Money you take off the listed price."
      />

      {conditional.platformDiscount ? (
        <Input
          label="Platform discount"
          labelSuffix={
            <Tooltip
              content="A voucher TikTok funds. It reduces the platform's cut but not your cost, so it usually raises your margin. Not applied in the Philippines or Malaysia."
              label="About platform discount"
            />
          }
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={inputs.platformDiscount}
          onChange={(event) => update('platformDiscount', parseNumber(event.target.value))}
          prefix={currency || undefined}
          placeholder="0.00"
          helperText="Optional. A voucher paid by TikTok rather than by you."
        />
      ) : null}

      <Input
        label="Customer shipping"
        labelSuffix={
          <Tooltip
            content="What the buyer pays for delivery. It is added to your commission base in the Philippines, Singapore, Malaysia and the UK, and excluded in the US."
            label="About customer shipping"
          />
        }
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={inputs.customerShipping}
        onChange={(event) => update('customerShipping', parseNumber(event.target.value))}
        prefix={currency || undefined}
        placeholder="0.00"
        helperText="Optional. Charged to the buyer, not deducted from your profit."
      />
      </div>
    </Collapsible>
  );
}
