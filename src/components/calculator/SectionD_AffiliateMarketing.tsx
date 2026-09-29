'use client';

import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';
import type { AffiliateMode } from '@/lib/calculation/types';

const AFFILIATE_MODES: Array<{ value: AffiliateMode; label: string; description: string }> = [
  { value: 'none', label: 'None', description: 'No affiliate or creator commission.' },
  { value: 'open', label: 'Open collaboration', description: 'Any creator can promote you.' },
  { value: 'targeted', label: 'Targeted collaboration', description: 'Invited creators only.' },
  { value: 'shopAds', label: 'TikTok Shop Ads', description: 'You pay per ad-attributed sale.' },
];

/** Affiliate commission, return rate and ad spend. */
export function SectionD_AffiliateMarketing({ calculator }: { calculator: UseCalculatorReturn }) {
  const { inputs, update, money, conditional, marketOptions } = calculator;
  const currency = marketOptions.find((m) => m.value === inputs.market)?.currency ?? '';

  const affiliateRateError =
    inputs.affiliateRate < 0 || inputs.affiliateRate > 80
      ? 'Commission rate must be between 0 and 80 percent'
      : undefined;

  return (
    <Collapsible
      headingLevel="h2"
      title="Affiliate & marketing"
      description="Creator commission, returns and ad spend."
    >
      <div className="space-y-4">
      <RadioGroup
        label="Affiliate mode"
        value={inputs.affiliateMode}
        options={AFFILIATE_MODES}
        onChange={(value) => update('affiliateMode', value as AffiliateMode)}
        helperText="Applied on your net selling price in every market."
      />

      {conditional.affiliateRate ? (
        <Input
          label="Affiliate commission rate"
          labelSuffix={
            <Tooltip
              content="The percentage you pay the creator. Typical creator deals sit well below this ceiling. The exact official ranges differ per market and are not published in our rate data."
              label="About affiliate rate"
            />
          }
          type="number"
          inputMode="decimal"
          min={0}
          max={80}
          step="0.1"
          value={inputs.affiliateRate}
          onChange={(event) =>
            update('affiliateRate', event.target.value === '' ? 0 : Number(event.target.value))
          }
          error={affiliateRateError}
          suffix="%"
          placeholder="0.0"
          helperText="0 to 80 percent of the net selling price."
        />
      ) : null}

      {conditional.returnRate ? (
        <Input
          label="Return / refund rate"
          labelSuffix={
            <Tooltip
              content="Share of orders that come back, as a percentage. Used only in the US, where the refund administration fee is modelled at 20 percent of the referral fee, capped at 5 currency units per SKU."
              label="About return rate"
            />
          }
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.1"
          value={inputs.returnRate}
          onChange={(event) =>
            update('returnRate', event.target.value === '' ? 0 : Number(event.target.value))
          }
          error={inputs.returnRate < 0 || inputs.returnRate > 100 ? 'Must be between 0 and 100' : undefined}
          suffix="%"
          helperText="United States only. Default 5 percent."
        />
      ) : null}

      <Input
        label="Ad spend per unit (CPA)"
        labelSuffix={
          <Tooltip
            content="What you spend on ads to acquire one sale, in the same currency as your price. It is subtracted from profit, so enter your true blended cost per order."
            label="About ad spend"
          />
        }
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={money.value('cpa')}
        onChange={money.onChange('cpa')}
        error={inputs.cpa < 0 ? 'Ad spend cannot be negative' : undefined}
        prefix={currency || undefined}
        placeholder="0.00"
        helperText="Optional. Total ad cost for a single sale."
      />
      </div>
    </Collapsible>
  );
}
