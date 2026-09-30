'use client';

import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge, Tag } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { Collapsible } from '@/components/ui/Collapsible';
import type { Market } from '@/hooks/useCalculator';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';
import { sellerTierDisplayLabel } from '@/hooks/useCalculator';
import type { ConfidenceLevel } from '@/components/ui/Badge';

/**
 * Section A: market, seller tier, category and selling price.
 *
 * State comes from the shared `calculator` prop, which is created once by
 * CalculatorForm. Rate data itself is loaded on the server and reaches the form
 * as props, because `lib/rates/loader.ts` uses `fs` and cannot run in a browser.
 */
export function SectionA_MarketProduct({ calculator }: { calculator: UseCalculatorReturn }) {
  const {
    inputs,
    money,
    setMarket,
    setSellerTier,
    setCategoryId,
    marketOptions,
    categoryOptions,
    selectedCategory,
    sellerTiers,
    showSellerTier,
  } = calculator;

  const selectedMarket = marketOptions.find((m) => m.value === inputs.market);
  const currency = selectedMarket?.currency ?? '';
  const sellingPriceError =
    inputs.sellingPrice < 0 ? 'Selling price cannot be negative' : undefined;

  return (
    <Collapsible
      headingLevel="h2"
      title="Market & product"
      description="Pick the market you sell in, then choose a category to load its fee rates."
      defaultOpen
    >
      <div className="space-y-4">
        <Select
          label="Country / market"
          required
          value={inputs.market}
          options={marketOptions.map((m) => ({ value: m.value, label: m.label }))}
          onChange={(value) => setMarket(value as Market)}
          searchable={false}
          helperText={currency ? `Prices and fees will be shown in ${currency}.` : undefined}
        />

        {showSellerTier ? (
          <Select
            label="Seller tier"
            value={inputs.sellerTier ?? ''}
            options={sellerTiers.map((tier) => ({
              value: tier,
              label: sellerTierDisplayLabel(tier),
            }))}
            onChange={(value) => setSellerTier(value as typeof inputs.sellerTier)}
            placeholder="Select a tier"
            helperText="Your TikTok Shop seller tier. It changes the commission rate applied to the category."
          />
        ) : null}

        <Select
          label="Category"
          required
          value={inputs.categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
          placeholder={categoryOptions.length === 0 ? 'No categories loaded' : 'Search categories'}
          helperText={
            categoryOptions.length > 0
              ? 'Rates shown in results are specific to the selected category.'
              : undefined
          }
        />

        {selectedCategory ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {selectedCategory.groupLabel}
            </span>
            <Tag>{`${(selectedCategory.displayRate * 100).toFixed(2)}% commission`}</Tag>
            {inputs.sellerTier ? (
              <Tag>{sellerTierDisplayLabel(inputs.sellerTier)}</Tag>
            ) : selectedCategory.tier ? (
              <Tag>{selectedCategory.tier}</Tag>
            ) : null}
            {selectedCategory.confidence ? (
              <span className="ml-auto inline-flex items-center gap-1.5">
                <Badge level={selectedCategory.confidence as ConfidenceLevel} />
              </span>
            ) : null}
          </div>
        ) : null}

        <Input
          id="section-a-selling-price"
          type="number"
          label="Selling price"
          labelSuffix={
            <Tooltip
              content="The listed price before any discount. Seller discount and platform discount are applied on top of this."
              label="About selling price"
            />
          }
          inputMode="decimal"
          min={0}
          step="0.01"
          required
          value={money.value('sellingPrice')}
          onChange={money.onChange('sellingPrice')}
          error={sellingPriceError}
          prefix={currency || undefined}
          placeholder="0.00"
          helperText={
            currency
              ? `Enter the item price in ${currency}. Taxes are not added here.`
              : 'Enter the item price. Taxes are not added here.'
          }
        />
      </div>
    </Collapsible>
  );
}
