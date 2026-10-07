'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CalculatorInputs, Market } from '@/lib/calculation';
// Imported from the type module rather than `@/lib/calculation`, whose public
// surface is the Step 6 API (entry point, helpers, result types).
import type { SellerTier } from '@/lib/calculation/types';
// Pure grouping/normalisation helpers. This module deliberately does not import
// `@/lib/rates/loader`, which reads rate files with `fs` and cannot run in a
// browser bundle.
import {
  availableSellerTiers as tiersForMarket,
  findCategoryGroup,
  findCategoryRow,
  groupCategories,
  hasSellerTierChoice as marketHasTierChoice,
  sellerTierLabel,
} from '@/lib/rates/tiers';

export type { CalculatorInputs, Market, SellerTier };

export interface MarketOption {
  value: Market;
  label: string;
  currency: string;
}

export interface CategoryOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
}
/**
 * The money fields the user types into.
 *
 * These are bound to a raw text draft instead of straight to `inputs`, because
 * a numeric binding cannot express "not entered yet": a 0 default is rendered
 * as a literal `0` in the box, and typing then appends to it, so entering 100
 * shows `0100` sitting under the currency prefix.
 *
 * The calculation model is deliberately left alone. `inputs[key]` is still
 * always a number, an empty draft is 0, and the engines and validation are
 * untouched. Only the text the user sees is different.
 */
export type MoneyFieldKey =
  | 'sellingPrice'
  | 'sellerDiscount'
  | 'platformDiscount'
  | 'customerShipping'
  | 'cogs'
  | 'outboundShipping'
  | 'cpa'
  | 'affiliateRate'
  | 'returnRate'
  | 'promoDaysRemaining';


/** Minimal shape the hook needs from rate data. Avoids importing the loader
 *  (which uses `fs`) into anything that ships to the browser. */
export interface MarketRateSummary {
  market: Market;
  currency: string;
  categories: Array<{
    id: string;
    name: string;
    parentCategory?: string;
    tier?: string;
    rate: number;
    /** PH prices both seller tiers on one record. */
    mallRate?: number;
    confidence?: string;
  }>;
}

const MARKET_LABELS: Record<Market, string> = {
  US: 'United States',
  PH: 'Philippines',
  SG: 'Singapore',
  MY: 'Malaysia',
  UK: 'United Kingdom',
};

export function marketLabel(market: Market): string {
  return MARKET_LABELS[market] ?? market;
}

/**
 * Which optional inputs a market's engine actually reads.
 *
 * Every flag here is grounded in the engines, not guessed. Showing a control an
 * engine ignores would silently mislead the user, so each capability is gated.
 */
export interface MarketCapabilities {
  /** Engine reads inputs.platformDiscount. */
  platformDiscount: boolean;
  /** Engine reads inputs.returnRate. */
  returnRate: boolean;
  /** Engine reads inputs.newSellerPromo / promoDaysRemaining. */
  newSellerPromo: boolean;
  /** Engine reads inputs.isPreOrder and charges a pre-order fee. */
  preOrder: boolean;
  /** Engine reads inputs.isShippingProgramEnrolled and charges a fee. */
  shippingProgram: boolean;
  /**
   * Fulfilled by TikTok.
   *
   * No engine implements FBT fees, and the rate data has no verified FBT
   * figures, so this is false for every market. It previously read true for the
   * US, which rendered a FBT/self-ship selector whose choice changed nothing in
   * the result. A control that cannot change the answer must not be shown.
   */
  fulfillment: boolean;
  /**
   * GMV Max. Phase 2.
   *
   * `isGMVMaxActive` is on CalculatorInputs but no engine reads it, and there is
   * no verified source in the rate data for which markets offer GMV Max, so
   * this is disabled everywhere rather than guessed. Enabling it for a market
   * will make Section G render the toggle automatically.
   */
  gmvMax: boolean;
}

export const MARKET_CAPABILITIES: Record<Market, MarketCapabilities> = {
  // US.ts: platformDiscount x2, returnRate x6, newSellerPromo + promoDaysRemaining x2
  US: {
    platformDiscount: true,
    returnRate: true,
    newSellerPromo: true,
    preOrder: false,
    shippingProgram: false,
    fulfillment: false,
    gmvMax: false,
  },
  // PH.ts: no platformDiscount, no returnRate, no promo.
  // Pre-order Service Fee (2%) and Shipping Service Fee (% + PHP50/order).
  PH: {
    platformDiscount: false,
    returnRate: false,
    newSellerPromo: false,
    preOrder: true,
    shippingProgram: true,
    fulfillment: false,
    gmvMax: false,
  },
  // SG.ts: platformDiscount x1, Pre-order Fee 1.09%.
  SG: {
    platformDiscount: true,
    returnRate: false,
    newSellerPromo: false,
    preOrder: true,
    shippingProgram: false,
    fulfillment: false,
    gmvMax: false,
  },
  // MY.ts: no platformDiscount, Pre-order Fee 2%.
  MY: {
    platformDiscount: false,
    returnRate: false,
    newSellerPromo: false,
    preOrder: true,
    shippingProgram: false,
    fulfillment: false,
    gmvMax: false,
  },
  // UK.ts: platformDiscount x1, newSellerPromo + promoDaysRemaining x1
  // (Platform Commission Fee (New Seller Promo)).
  UK: {
    platformDiscount: true,
    returnRate: false,
    newSellerPromo: true,
    preOrder: false,
    shippingProgram: false,
    fulfillment: false,
    gmvMax: false,
  },
};

export function createDefaultInputs(market: Market = 'US'): CalculatorInputs {
  return {
    market,
    sellerTier: null,
    categoryId: '',
    sellingPrice: 0,
    sellerDiscount: 0,
    platformDiscount: 0,
    customerShipping: 0,
    cogs: 0,
    outboundShipping: 0,
    affiliateMode: 'none',
    affiliateRate: 0,
    // PRD Section 3.1 default. Only US consumes this.
    returnRate: 5,
    cpa: 0,
    newSellerPromo: false,
    promoDaysRemaining: 0,
    isPreOrder: false,
    isShippingProgramEnrolled: false,
    isGMVMaxActive: false,
  };
}

/**
 * Seller tier is only meaningful where rate data is actually tiered.
 *
 * This is derived from the data rather than hard-coded per market, because
 * whether a market is tiered is a property of its rate file, not of the UI.
 * Grouping matters here: MY's six rows are two categories across four tiers,
 * so the tier count is read from the grouped categories, and PH's single rows
 * carry both tiers via `mallRate`.
 */
export function hasSellerTierChoice(rates: MarketRateSummary | null | undefined): boolean {
  if (!rates) return false;
  return marketHasTierChoice(rates.market, rates.categories);
}

export function availableSellerTiers(
  rates: MarketRateSummary | null | undefined
): SellerTier[] {
  if (!rates) return [];
  return tiersForMarket(rates.market, rates.categories) as SellerTier[];
}

/** Display label for a tier token, e.g. `non-bxp-mall` -> "Non-BXP Mall". */
export function sellerTierDisplayLabel(tier: SellerTier): string {
  return sellerTierLabel(tier);
}

export function useCalculator(
  ratesByMarket: Partial<Record<Market, MarketRateSummary>> = {},
  initialMarket: Market = 'US'
) {
  const [inputs, setInputs] = useState<CalculatorInputs>(() => createDefaultInputs(initialMarket));

  /**
   * Raw text typed into each money field. A key that is absent means the field
   * has never been touched, which renders as an empty box showing the
   * `placeholder` rather than a pre-filled `0`.
   */
  const [moneyDrafts, setMoneyDrafts] = useState<Partial<Record<MoneyFieldKey, string>>>({});


  const currentRates = ratesByMarket[inputs.market] ?? null;

  const update = useCallback(<K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateMany = useCallback((patch: Partial<CalculatorInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * Text binding for the money inputs.
   *
   * `value` is the draft string, so an untouched field is empty and a cleared
   * field stays empty instead of snapping back to `0`. The numeric side of
   * `inputs` is still updated in step, mapping `''` to 0, because that is the
   * value the calculation engines and their validation expect.
   */
  const money = useMemo(
    () => ({
      value: (key: MoneyFieldKey): string => moneyDrafts[key] ?? '',
      onChange: (key: MoneyFieldKey) => (event: ChangeEvent<HTMLInputElement>): void => {
        const raw = event.target.value;
        setMoneyDrafts((prev) => ({ ...prev, [key]: raw }));
        update(key, raw === '' ? 0 : Number(raw));
      },
    }),
    [moneyDrafts, update]
  );


  /**
   * Switching market invalidates the category, and the tier with it, because
   * category ids are market-scoped. Both are reset rather than carried over.
   */
  const setMarket = useCallback((market: Market) => {
    setInputs((prev) => ({ ...prev, market, categoryId: '', sellerTier: null }));
  }, []);

  /**
   * Changing the tier must not discard an already-chosen category.
   *
   * The category list is not filtered by tier, so there is nothing about a new
   * tier that invalidates the selection. Clearing `categoryId` here used to
   * leave the form silently unable to submit (the Calculate button needs a
   * category) with no visible cause, which is how a Malaysia run ended up
   * reporting an empty `categoryId` despite a category having been picked.
   */
  const setSellerTier = useCallback((tier: SellerTier | null) => {
    setInputs((prev) => ({ ...prev, sellerTier: tier }));
  }, []);

  const setCategoryId = useCallback((categoryId: string) => {
    setInputs((prev) => ({ ...prev, categoryId }));
  }, []);

  const reset = useCallback(() => {
    setInputs(createDefaultInputs(initialMarket));
    // Clearing the numeric model is not enough on its own: a stale draft would
    // still show the old amount in the box.
    setMoneyDrafts({});
  }, [initialMarket]);

  const marketOptions = useMemo<MarketOption[]>(
    () =>
      (Object.keys(MARKET_LABELS) as Market[]).map((market) => ({
        value: market,
        label: marketLabel(market),
        currency: ratesByMarket[market]?.currency ?? '',
      })),
    [ratesByMarket]
  );

  const sellerTiers = useMemo(() => availableSellerTiers(currentRates), [currentRates]);

  const categoryGroups = useMemo(
    () => (currentRates ? groupCategories(currentRates.market, currentRates.categories) : []),
    [currentRates]
  );

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    return categoryGroups.map((group) => ({
      value: group.id,
      label: group.label,
      group: group.parentCategory,
      // A grouped category holds a rate per tier, so the selector says which
      // tiers it can be priced at rather than repeating the category per tier.
      description:
        group.tiers.length > 1
          ? `Rates available for: ${group.tiers.map(sellerTierLabel).join(', ')}`
          : undefined,
    }));
  }, [categoryGroups]);

  /**
   * The rate row for the current (category, tier) selection.
   *
   * Read through the group + tier rather than by category id alone, so the
   * preview in Section A shows the rate the engine will actually charge for the
   * tier the user picked.
   */
  const selectedCategory = useMemo(() => {
    if (!currentRates) return null;
    const row = findCategoryRow(
      currentRates.market,
      currentRates.categories,
      inputs.categoryId,
      inputs.sellerTier
    );
    if (!row) return null;
    const group = findCategoryGroup(
      currentRates.market,
      currentRates.categories,
      inputs.categoryId
    );
    return {
      ...row,
      groupId: group?.id ?? row.id,
      groupLabel: group?.label ?? row.name,
      // PH prices both tiers from one record; show the rate for the chosen tier.
      displayRate:
        inputs.sellerTier === 'mall' && typeof row.mallRate === 'number'
          ? row.mallRate
          : row.rate,
    };
  }, [currentRates, inputs.categoryId, inputs.sellerTier]);

  const capabilities = MARKET_CAPABILITIES[inputs.market] ?? MARKET_CAPABILITIES.US;

  /**
   * Derived visibility for every conditional control in the form. Kept in the
   * hook so each section only has to read a boolean, and so the rules live in
   * one auditable place.
   */
  const conditional = useMemo(
    () => ({
      sellerTier: hasSellerTierChoice(currentRates),
      platformDiscount: capabilities.platformDiscount,
      returnRate: capabilities.returnRate,
      newSellerPromo: capabilities.newSellerPromo,
      preOrder: capabilities.preOrder,
      shippingProgram: capabilities.shippingProgram,
      fulfillment: capabilities.fulfillment,
      gmvMax: capabilities.gmvMax,

      affiliateRate: inputs.affiliateMode !== 'none',
      promoDays: inputs.newSellerPromo,
    }),
    [currentRates, capabilities, inputs.affiliateMode, inputs.newSellerPromo]
  );

  return {
    inputs,
    update,
    updateMany,
    money,
    setMarket,
    setSellerTier,
    setCategoryId,
    reset,
    marketOptions,
    categoryOptions,
    selectedCategory,
    sellerTiers,
    showSellerTier: conditional.sellerTier,
    currentRates,
    capabilities,
    conditional,
  };
}

export type UseCalculatorReturn = ReturnType<typeof useCalculator>;
