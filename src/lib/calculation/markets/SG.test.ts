import { describe, it, expect, beforeAll } from 'vitest';
import { calculateSGFeesSync } from './SG';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import type {
  AffiliateMode,
  CalculatorInputs,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let sgRates: MarketRateData;

beforeAll(async () => {
  sgRates = loadMarketRatesSync('SG');
});

const baseInputs: CalculatorInputs = {
  market: 'SG',
  sellerTier: 'standard',
  categoryId: 'sg-other-standard',
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

function findFee(fees: ReturnType<typeof calculateSGFeesSync>, name: string) {
  return fees.find(f => f.name === name);
}

describe('calculateSGFeesSync', () => {
  it('Standard non-electronics commission is 8.175%', () => {
    const fees = calculateSGFeesSync(baseInputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission).toBeDefined();
    expect(commission!.rate).toBe('8.175%');
    expect(commission!.base).toBe(100);
    expect(commission!.amount).toBe(8.18); // 8.175 -> 8.18
  });

  it('BXP non-electronics commission is 7.085%', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp' as const,
      categoryId: 'sg-other-bxp',
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('7.085%');
    expect(commission!.amount).toBe(7.09);
  });

  it('BXP electronics commission is 5.45%', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp' as const,
      categoryId: 'sg-electronics-bxp',
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('5.450%');
    expect(commission!.amount).toBe(5.45);
  });

  it('Standard electronics commission is 7.085%', () => {
    const inputs = { ...baseInputs, categoryId: 'sg-electronics-standard' };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('7.085%');
  });

  it('Commission base is customer payment including shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 20 };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    // Base = 100 + 20 = 120, fee = 9.81
    expect(commission!.base).toBe(120);
    expect(commission!.amount).toBe(9.81);
  });

  it('Seller discount reduces the commission base', () => {
    const inputs = { ...baseInputs, sellerDiscount: 40 };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    // Base = 60, fee = 4.91 (60 * 0.08175 = 4.905 -> 4.91)
    expect(commission!.base).toBe(60);
    expect(commission!.amount).toBe(4.91);
  });

  it('Transaction fee is 3.27% and includes the platform discount', () => {
    const inputs = { ...baseInputs, customerShipping: 20, platformDiscount: 30 };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // Base = 100 + 20 + 30 = 150, fee = 4.91 (150 * 0.0327 = 4.905)
    expect(transaction!.rate).toBe('3.27%');
    expect(transaction!.base).toBe(150);
    expect(transaction!.amount).toBe(4.91);
    expect(transaction!.confidence).toBe('medium');
  });

  it('Transaction fee notes the unverified base', () => {
    const fees = calculateSGFeesSync(baseInputs, sgRates);
    const transaction = findFee(fees, 'Transaction Fee');
    expect(transaction!.notes).toContain('could not be verified');
  });

  it('BXP sellers get no BXP service fee outside mixed orders', () => {
    const inputs = { ...baseInputs, sellerTier: 'bxp' as const };
    const fees = calculateSGFeesSync(inputs, sgRates);
    expect(findFee(fees, 'BXP Service Fee')).toBeUndefined();
  });

  it('BXP restricted products are charged 7.085% with no service fee', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp' as const,
      categoryId: 'sg-bxp-restricted-other',
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('7.085%');
    expect(findFee(fees, 'BXP Service Fee')).toBeUndefined();
  });

  it('Mixed BXP electronics adds a 3.27% BXP service fee', () => {
    // F-03: the seller's programme is authoritative, so selecting BXP Mixed is
    // what prices the mixed rate and triggers the service fee. Previously the
    // category row's own `tier` won, and the mixed rows were unreachable.
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp-mixed' as const,
      categoryId: 'sg-electronics-selected-lifestyle',
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    const serviceFee = findFee(fees, 'BXP Service Fee');
    // Commission 4.36% of 100 = 4.36, service fee 3.27% of 100 = 3.27
    expect(commission!.rate).toBe('4.360%');
    expect(commission!.amount).toBe(4.36);
    expect(serviceFee).toBeDefined();
    expect(serviceFee!.rate).toBe('3.27%');
    expect(serviceFee!.amount).toBe(3.27);
  });

  it('Mixed BXP other categories uses the 5.995% rate', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp-mixed' as const,
      categoryId: 'sg-fashion-fmcg-lifestyle-etc',
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('5.995%');
    expect(commission!.amount).toBe(6);
  });

  it('the same category prices differently per selected programme', () => {
    // F-03 regression: one category, four programmes, four published rates.
    const cases: Array<[NonNullable<CalculatorInputs['sellerTier']>, string]> = [
      ['standard', '8.175%'],
      ['bxp', '7.085%'],
      ['bxp-mixed', '5.995%'],
    ];
    for (const [tier, rate] of cases) {
      const fees = calculateSGFeesSync(
        { ...baseInputs, sellerTier: tier, categoryId: 'sg-fashion-fmcg-lifestyle-etc' },
        sgRates
      );
      expect(findFee(fees, 'Commission Fee')!.rate, tier).toBe(rate);
    }
  });

  it('an unmapped category falls back to the selected programme rate, not 0%', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp-restricted' as const,
      categoryId: 'sg-unmapped-category',
    } as CalculatorInputs;
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('7.085%');
    expect(findFee(fees, 'BXP Service Fee')).toBeUndefined();
  });

  it('an unmapped category on BXP Mixed keeps the mixed rate and service fee', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp-mixed' as const,
      categoryId: 'sg-unmapped-category',
    } as CalculatorInputs;
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    // Falls back to the mixed "other categories" rate of 5.995%
    expect(commission!.rate).toBe('5.995%');
    expect(findFee(fees, 'BXP Service Fee')).toBeDefined();
  });

  it('BXP Mixed is the only programme that charges the service fee', () => {
    for (const tier of ['standard', 'bxp', 'bxp-restricted'] as const) {
      const fees = calculateSGFeesSync(
        { ...baseInputs, sellerTier: tier, categoryId: 'sg-electronics-selected-lifestyle' },
        sgRates
      );
      expect(findFee(fees, 'BXP Service Fee'), tier).toBeUndefined();
    }
  });

  it('Unknown category falls back to the standard default and is flagged', () => {
    const inputs = { ...baseInputs, categoryId: 'sg-not-in-the-table' };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('8.175%');
    expect(commission!.confidence).toBe('needs-verification');
    expect(commission!.notes).toContain('cluster-level only');
  });

  it('Pre-order fee is omitted by default', () => {
    const fees = calculateSGFeesSync(baseInputs, sgRates);
    expect(findFee(fees, 'Pre-order Fee')).toBeUndefined();
  });

  it('Pre-order fee is 1.09% of net sales', () => {
    const inputs = { ...baseInputs, isPreOrder: true, sellerDiscount: 20 };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const preOrder = findFee(fees, 'Pre-order Fee');
    // Base = 80, fee = 0.87 (80 * 0.0109 = 0.872)
    expect(preOrder).toBeDefined();
    expect(preOrder!.rate).toBe('1.09%');
    expect(preOrder!.base).toBe(80);
    expect(preOrder!.amount).toBe(0.87);
  });

  it('Affiliate commission is calculated on net sales', () => {
    const inputs = {
      ...baseInputs,
      sellerDiscount: 20,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 15,
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    const affiliate = findFee(fees, 'Affiliate Commission');
    // Base = 80, 15% = 12.00
    expect(affiliate).toBeDefined();
    expect(affiliate!.base).toBe(80);
    expect(affiliate!.amount).toBe(12);
  });

  it('No affiliate line when the rate is zero', () => {
    const inputs = {
      ...baseInputs,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 0,
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    expect(findFee(fees, 'Affiliate Commission')).toBeUndefined();
  });

  it('Full fee set is returned for a mixed BXP pre-order affiliate order', () => {
    const inputs = {
      ...baseInputs,
      sellerTier: 'bxp-mixed' as const,
      categoryId: 'sg-electronics-selected-lifestyle',
      isPreOrder: true,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    expect(fees.map(f => f.name)).toEqual([
      'Commission Fee',
      'BXP Service Fee',
      'Transaction Fee',
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
    };
    const fees = calculateSGFeesSync(inputs, sgRates);
    for (const fee of fees) {
      expect(fee.sourceUrl).toMatch(/^https:\/\//);
      expect(fee.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Amounts are rounded to two decimals', () => {
    const inputs = { ...baseInputs, sellingPrice: 33.33 };
    const fees = calculateSGFeesSync(inputs, sgRates);
    for (const fee of fees) {
      expect(Number(fee.amount.toFixed(2))).toBe(fee.amount);
    }
  });
});
