// TEST FIXTURES
// Shared builders for the results panel tests. Not a test file itself (vitest
// only collects `*.test.*` / `*.spec.*`), and only ever imported by tests, so it
// stays out of the application bundle.

import type { CalculatorInputs } from '@/lib/calculation/types';
import type { ResultFeeLine, ResultSnapshot } from '@/lib/results/types';

export function makeInputs(overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    market: 'US',
    sellerTier: null,
    categoryId: 'us-cat-1',
    sellingPrice: 100,
    sellerDiscount: 0,
    platformDiscount: 0,
    customerShipping: 0,
    cogs: 30,
    outboundShipping: 5,
    affiliateMode: 'none',
    affiliateRate: 0,
    returnRate: 5,
    cpa: 0,
    newSellerPromo: false,
    promoDaysRemaining: 0,
    fulfillmentMethod: 'selfShip',
    isPreOrder: false,
    isShippingProgramEnrolled: false,
    isGMVMaxActive: false,
    ...overrides,
  };
}

export function makeFee(overrides: Partial<ResultFeeLine> = {}): ResultFeeLine {
  return {
    name: 'Referral Fee',
    rate: '6.0%',
    base: 100,
    amount: 6,
    sourceUrl: 'https://seller-us.tiktok.com/university/essay?knowledge_id=1',
    effectiveDate: '2026-01-15',
    lastVerified: '2026-09-26',
    confidence: 'high',
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<ResultSnapshot> = {}): ResultSnapshot {
  return {
    currency: 'USD',
    fees: [makeFee()],
    totalPlatformFees: 6,
    netProfit: 59,
    profitMargin: 0.59,
    effectiveTakeRate: 0.06,
    contributionMargin: 64,
    contributionMarginPct: 0.64,
    breakEvenPrice: 41,
    reverse: {
      targetProfitInput: 5,
      targetProfitPrice: 50,
      targetProfitAchievable: true,
      targetROAS: 4,
      maxCPA: 25,
    },
    projection: {
      monthlyUnits: 500,
      units: 500,
      gmv: 50_000,
      totalFees: 3_000,
      totalProfit: 29_500,
      avgProfitPerUnit: 59,
    },
    rateVersion: 'US-2026-09-26',
    calculatedAt: '2026-09-27T10:00:00.000Z',
    ...overrides,
  };
}
