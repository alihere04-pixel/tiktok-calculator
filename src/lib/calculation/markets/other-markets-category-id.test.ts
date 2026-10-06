import { describe, it, expect } from 'vitest';
import { calculateProfit } from '@/lib/calculation/index';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { findCategoryRow, groupCategories } from '@/lib/rates/tiers';
import type { CalculatorInputs, Market, SellerTier } from '@/lib/calculation/types';

/**
 * The US and UK category-group id fixes must not move any other market.
 *
 * Both fixes are confined to the untiered engines that were resolving a
 * category with a raw row-id comparison, but they change which id shape those
 * engines accept, so the remaining markets are pinned here rather than assumed.
 * The published rates below are the ones already asserted in
 * `cross-market.test.ts`; they are re-asserted through this path so a change to
 * the shared resolver cannot quietly reprice a market that was not being worked
 * on.
 */

function inputsFor(
  market: Market,
  categoryId: string,
  sellerTier: SellerTier | null,
  overrides: Partial<CalculatorInputs> = {}
): CalculatorInputs {
  return {
    market,
    categoryId,
    sellerTier,
    sellingPrice: 100,
    sellerDiscount: 0,
    platformDiscount: 0,
    customerShipping: 0,
    cogs: 30,
    outboundShipping: 5,
    affiliateMode: 'none',
    affiliateRate: 0,
    returnRate: 0,
    cpa: 0,
    newSellerPromo: false,
    promoDaysRemaining: 0,
    isPreOrder: false,
    isShippingProgramEnrolled: false,
    isGMVMaxActive: false,
    ...overrides,
  };
}

const OTHER_MARKETS: Market[] = ['UK', 'MY', 'SG', 'PH'];

const CATEGORY_FEE: Record<Market, string> = {
  US: 'Referral Fee',
  UK: 'Platform Commission Fee',
  PH: 'Commission Fee',
  SG: 'Commission Fee',
  MY: 'Commission Fee',
};

function commissionFor(market: Market, categoryId: string, tier: SellerTier | null) {
  const result = calculateProfit(inputsFor(market, categoryId, tier));
  const fee = result.fees.find((f) => f.name === CATEGORY_FEE[market]);
  expect(fee, `${market} / ${categoryId} should show a ${CATEGORY_FEE[market]} line`).toBeDefined();
  return fee!;
}

describe('other markets keep their published rates', () => {
  it('UK still prices its standard row at 9%', () => {
    const fee = commissionFor('UK', 'uk-standard', null);
    expect(fee.rate).toBe('9.00%');
    expect(fee.amount).toBe(9);
    expect(fee.pricing).toBe('priced');
  });

  it('MY still prices Electronics at all four published tiers', () => {
    const expected: Array<[SellerTier, string]> = [
      ['bxp-marketplace', '7.020%'],
      ['bxp-mall', '10.260%'],
      ['non-bxp-marketplace', '11.340%'],
      ['non-bxp-mall', '14.590%'],
    ];
    for (const [tier, rate] of expected) {
      expect(commissionFor('MY', 'my-electronics', tier).rate, tier).toBe(rate);
    }
  });

  it('PH still prices Marketplace and Mall off one record', () => {
    expect(commissionFor('PH', 'ph-fashion-accessories', 'marketplace').rate).toBe('7.00%');
    expect(commissionFor('PH', 'ph-fashion-accessories', 'mall').rate).toBe('8.10%');
  });

  it('SG still prices the selected programme', () => {
    expect(commissionFor('SG', 'sg-fashion-fmcg-lifestyle-etc', 'bxp-mixed').rate).toBe('5.995%');
  });

  it.each(OTHER_MARKETS)('%s still resolves every group id to a rate row', (market) => {
    const rates = loadMarketRatesSync(market);
    const unresolved: string[] = [];

    for (const group of groupCategories(market, rates.categories)) {
      // A group prices itself when any tier it declares resolves. A group with
      // no tiers at all is untiered, so its single row must resolve unprompted.
      const candidates: Array<SellerTier | null> = group.tiers.length > 0 ? group.tiers : [null];
      if (!candidates.some((tier) => findCategoryRow(market, rates.categories, group.id, tier))) {
        unresolved.push(group.id);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it.each(OTHER_MARKETS)('%s still resolves a raw row id to that same row', (market) => {
    const rates = loadMarketRatesSync(market);
    const unresolved: string[] = [];

    for (const group of groupCategories(market, rates.categories)) {
      // Only meaningful where a group holds one row: in a tiered group a raw row
      // id is deliberately re-resolved against the selected tier rather than
      // pinned, which is what stops a legacy id locking in one tier.
      if (group.rows.length !== 1) continue;
      const row = group.rows[0];
      if (findCategoryRow(market, rates.categories, row.id, null)?.id !== row.id) {
        unresolved.push(row.id);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it.each(OTHER_MARKETS)('%s reports complete pricing states unchanged', (market) => {
    const rates = loadMarketRatesSync(market);
    const groups = groupCategories(market, rates.categories);
    const tier = groups[0].tiers[0] ?? null;

    const result = calculateProfit(inputsFor(market, groups[0].id, tier));
    for (const fee of result.fees) {
      expect(fee.pricing, `${market} / ${fee.name}`).toMatch(/^(priced|unpriced)$/);
    }
    expect(result.complete).toBe(result.unpricedFees.length === 0);
  });
});

/**
 * A pre-existing defect in the same family, since fixed.
 *
 * `markets/UK.ts` resolved its category with a raw row-id comparison, exactly as
 * `markets/US.ts` did, so a UK group id missed the lookup and fell back to the 9%
 * standard rate. This mispriced 129 published UK categories, which are published
 * at 5%, and it was larger than the US defect.
 *
 * This block was originally a characterization test pinning that broken
 * behaviour, so the fix would be visible when it landed. UK is fixed now, so it
 * asserts the corrected result instead. `UK.category-id.test.ts` carries the
 * full 129-category coverage.
 */
describe('UK: the same defect, now fixed', () => {
  it('charges the published 5% for a group id, matching the row id', () => {
    const rates = loadMarketRatesSync('UK');
    const group = groupCategories('UK', rates.categories).find(
      (g) => g.rows.some((r) => r.id === 'uk-beauty-personal-care')
    )!;
    const row = group.rows[0];
    expect(row.rate).toBe(0.05);
    // The two id shapes are genuinely different, which is why this needed fixing.
    expect(group.id).not.toBe(row.id);

    const viaGroup = commissionFor('UK', group.id, null);
    const viaRow = commissionFor('UK', row.id, null);

    expect(viaGroup.rate).toBe('5.00%');
    expect(viaGroup.confidence).toBe(row.confidence);
    expect(viaGroup.rate).toBe(viaRow.rate);
    expect(viaGroup.confidence).toBe(viaRow.confidence);
  });
});
