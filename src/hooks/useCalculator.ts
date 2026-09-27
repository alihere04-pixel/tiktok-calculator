'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CalculatorInputs, Market } from '@/lib/calculation';
// Imported from the type module rather than `@/lib/calculation`, whose public
// surface is the Step 6 API (entry point, helpers, result types).
import type { SellerTier } from '@/lib/calculation/types';

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
  /** Market offers FBT (Fulfilled by TikTok). No engine implements FBT fees. */
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
    fulfillment: true,
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
    fulfillmentMethod: 'selfShip',
    isPreOrder: false,
    isShippingProgramEnrolled: false,
    isGMVMaxActive: false,
  };
}

/**
 * Seller tier is only meaningful where rate data is actually tiered.
 *
 * This is derived from the data rather than hard-coded per market, because
 * whether a market is tiered is a property of its rate file, not of the UI. As
 * of this data set: US and UK have no tiers, PH has a single `Marketplace`
 * tier (so a selector would offer no choice), and SG and MY have four each.
 */
export function hasSellerTierChoice(rates: MarketRateSummary | null | undefined): boolean {
  if (!rates) return false;
  return new Set(rates.categories.map((c) => c.tier).filter(Boolean)).size > 1;
}

export function availableSellerTiers(rates: MarketRateSummary | null | undefined): string[] {
  if (!rates) return [];
  return [...new Set(rates.categories.map((c) => c.tier).filter(Boolean))] as string[];
}

export function useCalculator(
  ratesByMarket: Partial<Record<Market, MarketRateSummary>> = {},
  initialMarket: Market = 'US'
) {
  const [inputs, setInputs] = useState<CalculatorInputs>(() => createDefaultInputs(initialMarket));

  const currentRates = ratesByMarket[inputs.market] ?? null;

  const update = useCallback(<K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateMany = useCallback((patch: Partial<CalculatorInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * Switching market invalidates the category, and the tier with it, because
   * category ids are market-scoped. Both are reset rather than carried over.
   */
  const setMarket = useCallback((market: Market) => {
    setInputs((prev) => ({ ...prev, market, categoryId: '', sellerTier: null }));
  }, []);

  const setSellerTier = useCallback((tier: SellerTier | null) => {
    setInputs((prev) => ({ ...prev, sellerTier: tier, categoryId: '' }));
  }, []);

  const setCategoryId = useCallback((categoryId: string) => {
    setInputs((prev) => ({ ...prev, categoryId }));
  }, []);

  const reset = useCallback(() => {
    setInputs(createDefaultInputs(initialMarket));
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

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    if (!currentRates) return [];
    return currentRates.categories.map((category) => ({
      value: category.id,
      label: category.name,
      group: category.parentCategory,
      description: category.tier ? `Tier: ${category.tier}` : undefined,
    }));
  }, [currentRates]);

  const selectedCategory = useMemo(
    () => currentRates?.categories.find((c) => c.id === inputs.categoryId) ?? null,
    [currentRates, inputs.categoryId]
  );

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
      fbtDetails: capabilities.fulfillment && inputs.fulfillmentMethod === 'fbt',
    }),
    [currentRates, capabilities, inputs.affiliateMode, inputs.newSellerPromo, inputs.fulfillmentMethod]
  );

  return {
    inputs,
    update,
    updateMany,
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
