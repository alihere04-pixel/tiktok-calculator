import { describe, it, expect, beforeAll } from 'vitest';
import { calculateMYFeesSync } from './MY';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { roundToTwo } from '../utils';
import { groupCategories, findCategoryRow } from '@/lib/rates/tiers';
import type {
  AffiliateMode,
  CalculatorInputs,
  SellerTier,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let myRates: MarketRateData;

beforeAll(async () => {
  myRates = loadMarketRatesSync('MY');
});

/** The two logical categories MY publishes, as stable group ids. */
const ELECTRONICS = 'my-electronics';
const TOYS = 'my-toys';

const baseInputs: CalculatorInputs = {
  market: 'MY',
  sellerTier: 'bxp-marketplace',
  categoryId: ELECTRONICS,
  sellingPrice: 100,
  sellerDiscount: 0,
  platformDiscount: 0,
  customerShipping: 0,
  cogs: 30,
  outboundShipping: 5,
  affiliateMode: 'none' as AffiliateMode,
  affiliateRate: 0,
  returnRate: 0,
  cpa: 0,
  newSellerPromo: false,
  promoDaysRemaining: 0,
  isPreOrder: false,
  isShippingProgramEnrolled: false,
  isGMVMaxActive: false,
};

function findFee(fees: ReturnType<typeof calculateMYFeesSync>, name: string) {
  return fees.find(f => f.name === name);
}

function commissionFor(
  categoryId: string,
  sellerTier: SellerTier | null
): ReturnType<typeof findFee> {
  return findFee(
    calculateMYFeesSync({ ...baseInputs, categoryId, sellerTier }, myRates),
    'Commission Fee'
  );
}

// ---------------------------------------------------------------------------
// F-08: the selector offered four identical "Electronics" entries because the
// rate file stores one row per (category, tier). Grouping collapses them.
// ---------------------------------------------------------------------------
describe('MY category grouping (F-08)', () => {
  it('offers one option per logical category, not one per tier', () => {
    const groups = groupCategories('MY', myRates.categories);
    expect(groups.map(g => g.label).sort()).toEqual(['Electronics', 'Toys']);
  });

  it('keeps all six published rate records reachable inside their group', () => {
    const groups = groupCategories('MY', myRates.categories);
    // Six published rows, zero dropped: grouping must never discard a rate.
    expect(groups.reduce((sum, g) => sum + g.rows.length, 0)).toBe(6);
    expect(myRates.categories).toHaveLength(6);
  });

  it('groups Electronics with its four tiers and Toys with its two', () => {
    const groups = groupCategories('MY', myRates.categories);
    const electronics = groups.find(g => g.label === 'Electronics')!;
    const toys = groups.find(g => g.label === 'Toys')!;
    expect(electronics.rows).toHaveLength(4);
    expect(toys.rows).toHaveLength(2);
    expect(electronics.tiers).toEqual([
      'bxp-marketplace',
      'bxp-mall',
      'non-bxp-marketplace',
      'non-bxp-mall',
    ]);
  });

  it('exposes four distinct seller tiers for MY', () => {
    const groups = groupCategories('MY', myRates.categories);
    const tiers = [...new Set(groups.flatMap(g => g.tiers))];
    expect(tiers).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// F-01: the selected seller tier is authoritative. The category's own `tier`
// field used to override it, making the Non-BXP Mall and BXP Mall published
// rates unreachable.
// ---------------------------------------------------------------------------
describe('MY seller tier selects the rate (F-01)', () => {
  it('Electronics is 7.020% on BXP Marketplace', () => {
    const commission = commissionFor(ELECTRONICS, 'bxp-marketplace')!;
    expect(commission.rate).toBe('7.020%');
    expect(commission.base).toBe(100);
    expect(commission.amount).toBe(7.02);
  });

  it('Electronics is 10.260% on BXP Mall', () => {
    const commission = commissionFor(ELECTRONICS, 'bxp-mall')!;
    expect(commission.rate).toBe('10.260%');
    expect(commission.amount).toBe(10.26);
    expect(commission.notes).toContain('BXP Mall');
  });

  it('Electronics is 11.340% on Non-BXP Marketplace', () => {
    const commission = commissionFor(ELECTRONICS, 'non-bxp-marketplace')!;
    expect(commission.rate).toBe('11.340%');
    expect(commission.amount).toBe(11.34);
  });

  it('Electronics is 14.590% on Non-BXP Mall', () => {
    const commission = commissionFor(ELECTRONICS, 'non-bxp-mall')!;
    expect(commission.rate).toBe('14.590%');
    expect(commission.amount).toBe(14.59);
  });

  it('the same category at each of the four tiers gives the published rate', () => {
    const expected: Array<[SellerTier, string, number]> = [
      ['bxp-marketplace', '7.020%', 7.02],
      ['bxp-mall', '10.260%', 10.26],
      ['non-bxp-marketplace', '11.340%', 11.34],
      ['non-bxp-mall', '14.590%', 14.59],
    ];
    for (const [tier, rate, amount] of expected) {
      const commission = commissionFor(ELECTRONICS, tier)!;
      expect(commission, `tier ${tier}`).toBeDefined();
      expect(commission.pricing).toBe('priced');
      expect(commission.rate, `tier ${tier}`).toBe(rate);
      expect(commission.amount, `tier ${tier}`).toBe(amount);
    }
  });

  it('Toys is 14.580% on Non-BXP Marketplace and 17.820% on Non-BXP Mall', () => {
    const marketplace = commissionFor(TOYS, 'non-bxp-marketplace')!;
    expect(marketplace.rate).toBe('14.580%');
    expect(marketplace.amount).toBe(14.58);

    const mall = commissionFor(TOYS, 'non-bxp-mall')!;
    expect(mall.rate).toBe('17.820%');
    expect(mall.amount).toBe(17.82);
  });

  it('names the tier that was actually selected, not the category row tier', () => {
    expect(commissionFor(ELECTRONICS, 'non-bxp-mall')!.notes).toContain(
      'Non-BXP Mall'
    );
    expect(commissionFor(TOYS, 'bxp-marketplace')!.notes).toContain(
      'BXP Marketplace'
    );
  });

  it('a legacy raw rate-row id cannot pin the tier any more', () => {
    // Passing the old per-tier row id used to select that row's band outright.
    // The id is now resolved through its group and re-resolved against the
    // selected tier, so it produces the same answer as the group id.
    const viaRowId = commissionFor('my-electronics-nonbxp-mall', 'non-bxp-mall')!;
    const viaGroupId = commissionFor(ELECTRONICS, 'non-bxp-mall')!;
    expect(viaRowId.rate).toBe('14.590%');
    expect(viaRowId.amount).toBe(viaGroupId.amount);
  });

  it('accepts published tier labels as well as canonical tokens', () => {
    const labelled = calculateMYFeesSync(
      {
        ...baseInputs,
        categoryId: ELECTRONICS,
        sellerTier: 'Non-BXP Mall' as SellerTier,
      },
      myRates
    );
    expect(findFee(labelled, 'Commission Fee')!.rate).toBe('14.590%');
  });

  it('falls back to Non-BXP Marketplace for an unrecognised tier', () => {
    const commission = commissionFor(ELECTRONICS, 'standard')!;
    expect(commission.rate).toBe('11.340%');
  });

  it('Commission is always higher for Non-BXP than BXP on the same category', () => {
    const bxp = commissionFor(ELECTRONICS, 'bxp-marketplace')!;
    const nonBxp = commissionFor(ELECTRONICS, 'non-bxp-marketplace')!;
    expect(Number(nonBxp.rate.replace('%', ''))).toBeGreaterThan(
      Number(bxp.rate.replace('%', ''))
    );
  });
});

// ---------------------------------------------------------------------------
// Unpriced state: Toys has no BXP rows, so those combinations must not be
// charged as 0%.
// ---------------------------------------------------------------------------
describe('MY unpriced commission', () => {
  it('Toys has no BXP rate, so BXP combinations are unpriced rather than 0%', () => {
    for (const tier of ['bxp-marketplace', 'bxp-mall'] as SellerTier[]) {
      const commission = commissionFor(TOYS, tier)!;
      expect(commission.pricing).toBe('unpriced');
      expect(commission.amount).toBe(0);
      expect(commission.confidence).toBe('needs-verification');
    }
  });

  it('an unpriced commission is excluded from the total and marks the result incomplete', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, categoryId: TOYS, sellerTier: 'bxp-marketplace' },
      myRates
    );
    const commission = findFee(fees, 'Commission Fee')!;
    expect(commission.pricing).toBe('unpriced');
    expect(commission.notes).toContain('excluded from the fee total');
    // Only the priced fixed fees contribute.
    const pricedTotal = roundToTwo(
      fees.filter(f => f.pricing !== 'unpriced').reduce((s, f) => s + f.amount, 0)
    );
    expect(pricedTotal).toBe(4.32); // 3.78 transaction + 0.54 support
  });

  it('an unknown category is quoted as a band and never priced', () => {
    const commission = commissionFor('my-not-in-the-table', 'bxp-marketplace')!;
    expect(commission.pricing).toBe('unpriced');
    expect(commission.amount).toBe(0);
    expect(commission.base).toBe(0);
    expect(commission.confidence).toBe('needs-verification');
    expect(commission.notes).toContain('excluded from the fee total');
  });

  it('an unpriced commission shows the published band, not a midpoint', () => {
    const commission = commissionFor('my-not-in-the-table', 'bxp-marketplace')!;

    // BXP Marketplace publishes 4.86% - 9.18%. The removed fallback rendered
    // the midpoint 7.020%, which is a rate TikTok never published.
    expect(commission.rate).toBe('4.86% - 9.18%');
    expect(commission.rate).not.toBe('7.020%');
    expect(commission.rate).toMatch(/^\d+\.\d{2}% - \d+\.\d{2}%$/);
  });

  it('all four MY tiers quote their own published band when unpriced', () => {
    const cases: Array<[SellerTier, string]> = [
      ['bxp-marketplace', '4.86% - 9.18%'],
      ['bxp-mall', '8.91% - 12.42%'],
      ['non-bxp-marketplace', '11.34% - 17.82%'],
      ['non-bxp-mall', '14.58% - 18.90%'],
    ];
    for (const [tier, band] of cases) {
      const commission = commissionFor('my-not-in-the-table', tier)!;
      expect(commission.rate, tier).toBe(band);
    }
  });

  it('no MY amount can come from the old midpoint calculation', () => {
    const oldMidpoints = [7.02, 14.58, 10.665, 16.74];
    const tiers: SellerTier[] = [
      'bxp-marketplace',
      'bxp-mall',
      'non-bxp-marketplace',
      'non-bxp-mall',
    ];

    for (const tier of tiers) {
      const fees = calculateMYFeesSync(
        { ...baseInputs, categoryId: 'my-not-in-the-table', sellerTier: tier },
        myRates
      );
      for (const fee of fees) {
        for (const midpoint of oldMidpoints) {
          expect(fee.amount).not.toBe(roundToTwo(100 * (midpoint / 100)));
        }
      }
    }
  });
});

describe('MY fees', () => {
  it('Commission base excludes customer shipping', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, customerShipping: 30 },
      myRates
    );
    const commission = findFee(fees, 'Commission Fee')!;
    expect(commission.base).toBe(100);
    expect(commission.amount).toBe(7.02);
  });

  it('Seller discount reduces the commission base', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, sellerDiscount: 20 },
      myRates
    );
    const commission = findFee(fees, 'Commission Fee')!;
    // Base = 80, fee = 5.62 (80 * 0.0702 = 5.616)
    expect(commission.base).toBe(80);
    expect(commission.amount).toBe(5.62);
  });

  it('Transaction fee is 3.78% on customer payment including shipping', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, customerShipping: 50 },
      myRates
    );
    const transaction = findFee(fees, 'Transaction Fee')!;
    // Base = 150, fee = 5.67
    expect(transaction.rate).toBe('3.78%');
    expect(transaction.base).toBe(150);
    expect(transaction.amount).toBe(5.67);
  });

  it('Transaction fee is not increased by the platform discount', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, platformDiscount: 40 },
      myRates
    );
    const transaction = findFee(fees, 'Transaction Fee')!;
    expect(transaction.base).toBe(100);
    expect(transaction.amount).toBe(3.78);
  });

  it('Transaction fee reads its effective date from the rate file', () => {
    const transaction = findFee(
      calculateMYFeesSync(baseInputs, myRates),
      'Transaction Fee'
    )!;
    expect(transaction.effectiveDate).toBe(
      myRates.additionalFees?.transactionFee?.effectiveFrom ?? myRates.sourceDate
    );
  });

  it('Platform Support Fee is a flat RM 0.54 per order', () => {
    const support = findFee(
      calculateMYFeesSync(baseInputs, myRates),
      'Platform Support Fee'
    )!;
    expect(support.rate).toBe('RM 0.54/order');
    expect(support.amount).toBe(0.54);
    expect(support.effectiveDate).toBe('2026-02-15');
  });

  it('Platform Support Fee does not scale with the order value', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, sellingPrice: 5000 },
      myRates
    );
    expect(findFee(fees, 'Platform Support Fee')!.amount).toBe(0.54);
  });

  it('4.86% is not charged as a separate BXP fee line', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    expect(fees.find(f => f.rate === '4.86%')).toBeUndefined();
    expect(fees.find(f => f.name.toLowerCase().includes('bxp fee'))).toBeUndefined();
  });

  it('Pre-order fee is omitted by default', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    expect(findFee(fees, 'Pre-order Fee')).toBeUndefined();
  });

  it('Pre-order fee is 2% of net sales', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, isPreOrder: true, sellerDiscount: 20 },
      myRates
    );
    const preOrder = findFee(fees, 'Pre-order Fee')!;
    expect(preOrder.rate).toBe('2.00%');
    expect(preOrder.base).toBe(80);
    expect(preOrder.amount).toBe(1.6);
  });

  it('Dynamic commission is never charged (F-13: the input was dead code)', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    expect(findFee(fees, 'Dynamic Commission')).toBeUndefined();
    expect(findFee(fees, 'Dynamic Commission (not calculable)')).toBeUndefined();
  });

  it('Affiliate commission is calculated on net sales', () => {
    const fees = calculateMYFeesSync(
      {
        ...baseInputs,
        sellerDiscount: 20,
        affiliateMode: 'open' as AffiliateMode,
        affiliateRate: 10,
      },
      myRates
    );
    const affiliate = findFee(fees, 'Affiliate Commission')!;
    // Base = 80, 10% = 8.00
    expect(affiliate.base).toBe(80);
    expect(affiliate.amount).toBe(8);
  });

  it('Full fee set is returned for a pre-order affiliate order', () => {
    const fees = calculateMYFeesSync(
      {
        ...baseInputs,
        isPreOrder: true,
        affiliateMode: 'open' as AffiliateMode,
        affiliateRate: 10,
      },
      myRates
    );
    expect(fees.map(f => f.name)).toEqual([
      'Commission Fee',
      'Transaction Fee',
      'Platform Support Fee',
      'Pre-order Fee',
      'Affiliate Commission',
    ]);
  });

  it('marks every fee line priced or unpriced explicitly', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    for (const fee of fees) {
      expect(['priced', 'unpriced']).toContain(fee.pricing);
    }
    expect(fees.every(f => f.pricing === 'priced')).toBe(true);
  });

  it('Every fee line carries source metadata', () => {
    const fees = calculateMYFeesSync(
      {
        ...baseInputs,
        isPreOrder: true,
        affiliateMode: 'open' as AffiliateMode,
        affiliateRate: 5,
      },
      myRates
    );
    for (const fee of fees) {
      expect(fee.sourceUrl).toMatch(/^https:\/\//);
      expect(fee.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Amounts are rounded to two decimals', () => {
    const fees = calculateMYFeesSync(
      { ...baseInputs, sellingPrice: 33.33 },
      myRates
    );
    for (const fee of fees) {
      expect(Number(fee.amount.toFixed(2))).toBe(fee.amount);
    }
  });
});

describe('MY row resolution', () => {
  it('resolves a group id at each tier to the matching published row', () => {
    const row = findCategoryRow('MY', myRates.categories, ELECTRONICS, 'bxp-mall');
    expect(row).not.toBeNull();
    expect(row!.rate).toBe(0.1026);
  });

  it('returns null when a group has no row for the selected tier', () => {
    expect(
      findCategoryRow('MY', myRates.categories, TOYS, 'bxp-marketplace')
    ).toBeNull();
  });
});
