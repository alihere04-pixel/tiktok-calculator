import { describe, it, expect, beforeAll } from 'vitest';
import { calculateMYFeesSync } from './MY';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import type {
  AffiliateMode,
  CalculatorInputs,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let myRates: MarketRateData;

beforeAll(async () => {
  myRates = loadMarketRatesSync('MY');
});

const baseInputs: CalculatorInputs = {
  market: 'MY',
  sellerTier: 'bxp',
  categoryId: 'my-electronics-bxp-mp',
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
  fulfillmentMethod: 'selfShip',
  isPreOrder: false,
  isShippingProgramEnrolled: false,
  isGMVMaxActive: false,
} as CalculatorInputs;

function findFee(fees: ReturnType<typeof calculateMYFeesSync>, name: string) {
  return fees.find(f => f.name === name);
}

describe('calculateMYFeesSync', () => {
  it('BXP Marketplace electronics commission is 7.02%', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission).toBeDefined();
    expect(commission!.rate).toBe('7.020%');
    expect(commission!.base).toBe(100);
    expect(commission!.amount).toBe(7.02);
  });

  it('BXP Mall electronics commission is 10.26%', () => {
    const inputs = {
      ...baseInputs,
      isMall: true,
      categoryId: 'my-electronics-bxp-mall',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('10.260%');
    expect(commission!.amount).toBe(10.26);
  });

  it('isMall with a BXP seller resolves the BXP Mall tier', () => {
    const inputs = {
      ...baseInputs,
      isMall: true,
      categoryId: 'my-electronics-bxp-mall',
    } as CalculatorInputs;
    const commission = findFee(
      calculateMYFeesSync(inputs, myRates),
      'Commission Fee'
    )!;
    expect(commission!.notes).toContain('BXP Mall');
  });

  it('Non-BXP Marketplace electronics commission is 11.34%', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'standard' as const,
      categoryId: 'my-electronics-nonbxp-mp',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('11.340%');
    expect(commission!.amount).toBe(11.34);
  });

  it('Non-BXP Mall electronics commission is 14.59%', () => {
    const inputs = {
      ...baseInputs,
      myTier: 'Non-BXP Mall',
      categoryId: 'my-electronics-nonbxp-mall',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('14.590%');
    expect(commission!.amount).toBe(14.59);
  });

  it('myTier override selects the matching category entry', () => {
    const inputs = {
      ...baseInputs,
      myTier: 'BXP Mall',
      categoryId: 'my-electronics-bxp-mall',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.confidence).toBe('high');
    expect(commission!.notes).toContain('BXP Mall');
  });

  it('Commission base excludes customer shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 30 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.base).toBe(100);
    expect(commission!.amount).toBe(7.02);
  });

  it('Seller discount reduces the commission base', () => {
    const inputs = { ...baseInputs, sellerDiscount: 20 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    // Base = 80, fee = 5.62 (80 * 0.0702 = 5.616)
    expect(commission!.base).toBe(80);
    expect(commission!.amount).toBe(5.62);
  });

  it('Transaction fee is 3.78% on customer payment including shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 50 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // Base = 150, fee = 5.67
    expect(transaction!.rate).toBe('3.78%');
    expect(transaction!.base).toBe(150);
    expect(transaction!.amount).toBe(5.67);
  });

  it('Transaction fee is not increased by the platform discount', () => {
    const inputs = { ...baseInputs, platformDiscount: 40 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // MY base is Customer Payment only
    expect(transaction!.base).toBe(100);
    expect(transaction!.amount).toBe(3.78);
  });

  it('Platform Support Fee is a flat RM 0.54 per order', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    const support = findFee(fees, 'Platform Support Fee');
    expect(support).toBeDefined();
    expect(support!.rate).toBe('RM 0.54/order');
    expect(support!.amount).toBe(0.54);
    expect(support!.effectiveDate).toBe('2026-02-15');
  });

  it('Platform Support Fee does not scale with the order value', () => {
    const inputs = { ...baseInputs, sellingPrice: 5000 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
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
    const inputs = {
      ...baseInputs,
      isPreOrder: true,
      sellerDiscount: 20,
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const preOrder = findFee(fees, 'Pre-order Fee');
    // Base = 80, fee = 1.60
    expect(preOrder).toBeDefined();
    expect(preOrder!.rate).toBe('2.00%');
    expect(preOrder!.base).toBe(80);
    expect(preOrder!.amount).toBe(1.6);
  });

  it('Dynamic commission is excluded unless explicitly requested', () => {
    const fees = calculateMYFeesSync(baseInputs, myRates);
    expect(findFee(fees, 'Dynamic Commission (not calculable)')).toBeUndefined();
  });

  it('Dynamic commission is reported as an uncalculable zero when requested', () => {
    const inputs = {
      ...baseInputs,
      isDynamicCommission: true,
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const dynamic = findFee(fees, 'Dynamic Commission (not calculable)');
    expect(dynamic).toBeDefined();
    expect(dynamic!.amount).toBe(0);
    expect(dynamic!.confidence).toBe('needs-verification');
    expect(dynamic!.notes).toContain('RM 650,000');
  });

  it('Affiliate commission is calculated on net sales', () => {
    const inputs = {
      ...baseInputs,
      sellerDiscount: 20,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const affiliate = findFee(fees, 'Affiliate Commission');
    // Base = 80, 10% = 8.00
    expect(affiliate).toBeDefined();
    expect(affiliate!.base).toBe(80);
    expect(affiliate!.amount).toBe(8);
  });

  it('Unknown category falls back to the range midpoint and is flagged', () => {
    const inputs = {
      ...baseInputs,
      categoryId: 'my-not-in-the-table',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    // BXP Marketplace midpoint of 4.86%-9.18% = 7.02%
    expect(commission!.rate).toBe('7.020%');
    expect(commission!.confidence).toBe('needs-verification');
    expect(commission!.notes).toContain('midpoint');
  });

  it('Unknown Non-BXP Mall category falls back to that range midpoint', () => {
    const inputs = {
      ...baseInputs,
      myTier: 'Non-BXP Mall',
      categoryId: 'my-not-in-the-table',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee');
    // Midpoint of 14.58%-18.90% = 16.74%
    expect(commission!.rate).toBe('16.740%');
  });

  it('Fallback commission stays inside the published range', () => {
    const ranges: Record<string, [number, number]> = {
      'BXP Marketplace': [4.86, 9.18],
      'BXP Mall': [8.91, 12.42],
      'Non-BXP Marketplace': [11.34, 17.82],
      'Non-BXP Mall': [14.58, 18.9],
    };
    for (const [tier, [low, high]] of Object.entries(ranges)) {
      const inputs = {
        ...baseInputs,
        myTier: tier,
        categoryId: 'my-not-in-the-table',
      } as CalculatorInputs;
      const commission = findFee(
        calculateMYFeesSync(inputs, myRates),
        'Commission Fee'
      )!;
      const rate = Number(commission.rate.replace('%', ''));
      expect(rate).toBeGreaterThanOrEqual(low);
      expect(rate).toBeLessThanOrEqual(high);
    }
  });

  it('Commission is always higher for Non-BXP than BXP on the same category', () => {
    const bxp = findFee(
      calculateMYFeesSync(
        {
          ...baseInputs,
          myTier: 'BXP Marketplace',
          categoryId: 'my-electronics-bxp-mp',
        } as CalculatorInputs,
        myRates
      ),
      'Commission Fee'
    )!;
    const nonBxp = findFee(
      calculateMYFeesSync(
        {
          ...baseInputs,
          myTier: 'Non-BXP Marketplace',
          categoryId: 'my-electronics-nonbxp-mp',
        } as CalculatorInputs,
        myRates
      ),
      'Commission Fee'
    )!;
    expect(Number(nonBxp.rate.replace('%', ''))).toBeGreaterThan(
      Number(bxp.rate.replace('%', ''))
    );
  });

  it('Full fee set is returned for a pre-order affiliate order', () => {
    const inputs = {
      ...baseInputs,
      isPreOrder: true,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    expect(fees.map(f => f.name)).toEqual([
      'Commission Fee',
      'Transaction Fee',
      'Platform Support Fee',
      'Pre-order Fee',
      'Affiliate Commission',
    ]);
  });

  it('Every fee line carries source metadata', () => {
    const inputs = {
      ...baseInputs,
      isPreOrder: true,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 5,
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    for (const fee of fees) {
      expect(fee.sourceUrl).toMatch(/^https:\/\//);
      expect(fee.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Amounts are rounded to two decimals', () => {
    const inputs = { ...baseInputs, sellingPrice: 33.33 } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    for (const fee of fees) {
      expect(Number(fee.amount.toFixed(2))).toBe(fee.amount);
    }
  });

  it('BXP Mall category commission is 10.26% with sellerTier standard', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'standard' as const,
      categoryId: 'my-electronics-bxp-mall',
    } as CalculatorInputs;
    const fees = calculateMYFeesSync(inputs, myRates);
    const commission = findFee(fees, 'Commission Fee')!;
    expect(commission!.rate).toBe('10.260%');
  });
});
