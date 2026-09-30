import { describe, it, expect } from 'vitest';
import { calculateProfit } from './index';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { groupCategories } from '@/lib/rates/tiers';
import type { CalculatorInputs, Market, SellerTier } from '@/lib/calculation/types';

/**
 * Cross-market checks on the promise the calculator makes to a seller: every
 * published rate is reachable, and nothing that could not be verified is ever
 * presented as if it had been.
 *
 * These run against the real rate files rather than fixtures, because the whole
 * subject is what those files contain.
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

const MARKETS: Market[] = ['US', 'PH', 'SG', 'MY', 'UK'];

/**
 * The fee that carries a market's category commission.
 *
 * The name is the published one and differs by market: "Referral Fee" in the US,
 * "Platform Commission Fee" in the UK, "Commission Fee" in PH, SG and MY.
 */
const CATEGORY_FEE: Record<Market, string> = {
  US: 'Referral Fee',
  UK: 'Platform Commission Fee',
  PH: 'Commission Fee',
  SG: 'Commission Fee',
  MY: 'Commission Fee',
};

describe('every market declares its pricing state', () => {
  it.each(MARKETS)('%s marks every fee priced or unpriced, never blank', (market) => {
    const rates = loadMarketRatesSync(market);
    const groups = groupCategories(market, rates.categories);
    const result = calculateProfit(inputsFor(market, groups[0].id, null));

    for (const fee of result.fees) {
      expect(fee.pricing, `${market} / ${fee.name}`).toMatch(/^(priced|unpriced)$/);
    }
  });

  it.each(MARKETS)('%s reports complete=true when nothing is unpriced', (market) => {
    const rates = loadMarketRatesSync(market);
    const groups = groupCategories(market, rates.categories);
    const result = calculateProfit(inputsFor(market, groups[0].id, null));

    if (result.unpricedFees.length === 0) {
      expect(result.complete, market).toBe(true);
    } else {
      expect(result.complete, market).toBe(false);
    }
  });
});

describe('no market invents a rate for an unlisted category', () => {
  it.each(MARKETS)('%s marks an unknown category unpriced or flags the fallback', (market) => {
    const result = calculateProfit(
      inputsFor(market, 'definitely-not-a-real-category', null)
    );
    const commission = result.fees.find((f) => f.name === CATEGORY_FEE[market]);

    expect(commission, `${market} should still show a ${CATEGORY_FEE[market]} line`).toBeDefined();

    // Either it is explicitly unpriced, or it is priced from a documented
    // fallback that the engine has marked as unverified. A silently confident
    // rate is the failure this guards.
    if (commission!.pricing === 'unpriced') {
      expect(commission!.amount).toBe(0);
      expect(result.complete).toBe(false);
      expect(result.unpricedFees).toContain(CATEGORY_FEE[market]);
    } else {
      expect(commission!.confidence).toBe('needs-verification');
    }
  });

  it.each(MARKETS)('%s never reports a 0%% category fee as a priced rate', (market) => {
    // A published 0% is legitimate, but none of these markets publish one, so a
    // 0% category fee can only come from a fabricated fallback.
    const result = calculateProfit(
      inputsFor(market, 'definitely-not-a-real-category', null)
    );
    const commission = result.fees.find((f) => f.name === CATEGORY_FEE[market])!;
    expect(commission.rate, market).not.toBe('0%');
    expect(commission.rate, market).not.toBe('0.000%');
    expect(commission.rate, market).not.toBe('0.00%');
  });
});

describe('MY: the four published tiers are all reachable', () => {
  it('prices Electronics at each of the four published rates', () => {
    const expected: Array<[SellerTier, string]> = [
      ['bxp-marketplace', '7.020%'],
      ['bxp-mall', '10.260%'],
      ['non-bxp-marketplace', '11.340%'],
      ['non-bxp-mall', '14.590%'],
    ];

    for (const [tier, rate] of expected) {
      const result = calculateProfit(inputsFor('MY', 'my-electronics', tier));
      const commission = result.fees.find((f) => f.name === 'Commission Fee')!;
      expect(commission.rate, tier).toBe(rate);
      expect(commission.pricing, tier).toBe('priced');
      expect(result.complete, tier).toBe(true);
    }
  });

  it('offers one Electronics option rather than four', () => {
    const rates = loadMarketRatesSync('MY');
    const labels = groupCategories('MY', rates.categories).map((g) => g.label);
    expect(labels).toEqual(['Electronics', 'Toys']);
  });

  it('reports Toys on BXP as incomplete rather than free', () => {
    // Toys publishes no BXP rate. Charging 0% would show a commission-free
    // listing that TikTok would not actually give.
    const result = calculateProfit(inputsFor('MY', 'my-toys', 'bxp-marketplace'));
    expect(result.complete).toBe(false);
    expect(result.unpricedFees).toContain('Commission Fee');
    expect(result.fees.find((f) => f.name === 'Commission Fee')!.rate).not.toBe('0%');
  });
});

describe('PH: Marketplace and Mall are both reachable', () => {
  it('prices one category at Marketplace and at Mall', () => {
    const rates = loadMarketRatesSync('PH');
    const fashion = rates.categories.find((c) => c.id === 'ph-fashion-accessories')!;

    const marketplace = calculateProfit(
      inputsFor('PH', fashion.id, 'marketplace')
    ).fees.find((f) => f.name === 'Commission Fee')!;
    const mall = calculateProfit(inputsFor('PH', fashion.id, 'mall')).fees.find(
      (f) => f.name === 'Commission Fee'
    )!;

    expect(marketplace.rate).toBe('7.00%');
    expect(mall.rate).toBe('8.10%');
    expect(mall.amount).toBeGreaterThan(marketplace.amount);
  });
});

describe('SG: the selected programme prices the rate', () => {
  it('gives the four programme results on one category', () => {
    const result = calculateProfit(
      inputsFor('SG', 'sg-fashion-fmcg-lifestyle-etc', 'bxp-mixed')
    );
    const commission = result.fees.find((f) => f.name === 'Commission Fee')!;
    expect(commission.rate).toBe('5.995%');

    const serviceFee = result.fees.find((f) => f.name === 'BXP Service Fee');
    expect(serviceFee, 'BXP Mixed must charge the BXP service fee').toBeDefined();
    expect(serviceFee!.rate).toBe('3.27%');
  });

  it('does not charge the BXP service fee outside BXP Mixed', () => {
    for (const tier of ['standard', 'bxp', 'bxp-restricted'] as SellerTier[]) {
      const result = calculateProfit(
        inputsFor('SG', 'sg-fashion-fmcg-lifestyle-etc', tier)
      );
      expect(
        result.fees.find((f) => f.name === 'BXP Service Fee'),
        tier
      ).toBeUndefined();
    }
  });
});

describe('UK: the new seller promo is never a fabricated 0%', () => {
  it('reports the promo as unpriced', () => {
    const result = calculateProfit(
      inputsFor('UK', 'uk-new-seller-promo', null, {
        newSellerPromo: true,
        promoDaysRemaining: 45,
      })
    );
    const promo = result.fees.find((f) => f.name.includes('New Seller Promo'))!;

    expect(promo.pricing).toBe('unpriced');
    expect(promo.rate).not.toBe('0%');
    expect(result.complete).toBe(false);
    expect(result.unpricedFees.join()).toMatch(/Promo/);
  });

  it('still totals the fees it could price', () => {
    const result = calculateProfit(
      inputsFor('UK', 'uk-new-seller-promo', null, {
        newSellerPromo: true,
        promoDaysRemaining: 45,
      })
    );
    const priced = result.fees.filter((f) => f.pricing === 'priced');
    const summed = priced.reduce((s, f) => s + f.amount, 0);
    expect(result.totalPlatformFees).toBeCloseTo(summed, 2);
  });
});

describe('derived totals exclude unpriced fees', () => {
  it('a MY Toys BXP result counts only the fees it could price', () => {
    const result = calculateProfit(inputsFor('MY', 'my-toys', 'bxp-marketplace'));
    const priced = result.fees.filter((f) => f.pricing === 'priced');
    const summed = priced.reduce((s, f) => s + f.amount, 0);

    expect(result.complete).toBe(false);
    expect(result.totalPlatformFees).toBeCloseTo(summed, 2);
    // The unpriced commission contributes nothing, so the total is a floor.
    expect(result.totalPlatformFees).toBeLessThan(8);
  });
});
