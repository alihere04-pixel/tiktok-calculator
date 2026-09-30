import { describe, it, expect, beforeAll } from 'vitest';
import { calculatePHFeesSync } from './PH';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import type {
  AffiliateMode,
  CalculatorInputs,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let phRates: MarketRateData;

beforeAll(async () => {
  phRates = loadMarketRatesSync('PH');
});

const baseInputs: CalculatorInputs = {
  market: 'PH',
  sellerTier: 'marketplace',
  categoryId: 'ph-fashion-accessories', // Marketplace 7.00%, Mall 8.10%
  sellingPrice: 1000,
  sellerDiscount: 0,
  platformDiscount: 0,
  customerShipping: 0,
  cogs: 300,
  outboundShipping: 50,
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

function findFee(fees: ReturnType<typeof calculatePHFeesSync>, name: string) {
  return fees.find(f => f.name === name);
}

describe('calculatePHFeesSync', () => {
  it('Marketplace commission uses the category rate', () => {
    const fees = calculatePHFeesSync(baseInputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission).toBeDefined();
    expect(commission!.rate).toBe('7.00%');
    expect(commission!.base).toBe(1000);
    expect(commission!.amount).toBe(70);
  });

  it('Mall commission uses mallRate, not the marketplace rate', () => {
    const inputs = { ...baseInputs, sellerTier: 'mall' as const };
    const fees = calculatePHFeesSync(inputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    // mallRate for ph-fashion-accessories is 8.10%
    expect(commission!.rate).toBe('8.10%');
    expect(commission!.amount).toBe(81);
  });

  it('Commission base excludes customer shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 200 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.base).toBe(1000);
    expect(commission!.amount).toBe(70);
  });

  it('Seller discount reduces the commission base', () => {
    const inputs = { ...baseInputs, sellerDiscount: 200 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    // Base = 800, fee = 56.00
    expect(commission!.base).toBe(800);
    expect(commission!.amount).toBe(56);
  });

  it('Transaction fee is 2.24% on customer payment including shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 500 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // Customer payment = 1000 + 500 = 1500, fee = 33.60
    expect(transaction!.rate).toBe('2.24%');
    expect(transaction!.base).toBe(1500);
    expect(transaction!.amount).toBe(33.6);
  });

  it('Transaction fee base is reduced by the seller discount', () => {
    const inputs = { ...baseInputs, sellerDiscount: 500, customerShipping: 100 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // Customer payment = 500 + 100 = 600, fee = 13.44
    expect(transaction!.base).toBe(600);
    expect(transaction!.amount).toBe(13.44);
  });

  it('Platform discount does not change the PH transaction fee base', () => {
    const inputs = { ...baseInputs, platformDiscount: 300 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const transaction = findFee(fees, 'Transaction Fee');
    // PH base is Customer Payment only, unlike SG
    expect(transaction!.base).toBe(1000);
    expect(transaction!.amount).toBe(22.4);
  });

  it('Shipping service fee is omitted when not enrolled', () => {
    const fees = calculatePHFeesSync(baseInputs, phRates);
    expect(findFee(fees, 'Shipping Service Fee')).toBeUndefined();
  });

  it('Shipping service fee applies 5.25% + PHP 5 when enrolled', () => {
    const inputs = { ...baseInputs, isShippingProgramEnrolled: true };
    const fees = calculatePHFeesSync(inputs, phRates);
    const shipping = findFee(fees, 'Shipping Service Fee');
    // 1000 * 0.0525 + 5 = 57.50
    expect(shipping).toBeDefined();
    expect(shipping!.base).toBe(1000);
    expect(shipping!.amount).toBe(57.5);
    expect(shipping!.confidence).toBe('medium');
  });

  it('Shipping service fee uses the discounted item price', () => {
    const inputs = {
      ...baseInputs,
      sellerDiscount: 500,
      isShippingProgramEnrolled: true,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    const shipping = findFee(fees, 'Shipping Service Fee');
    // 500 * 0.0525 + 5 = 31.25
    expect(shipping!.base).toBe(500);
    expect(shipping!.amount).toBe(31.25);
  });

  it('Pre-order fee is omitted by default', () => {
    const fees = calculatePHFeesSync(baseInputs, phRates);
    expect(findFee(fees, 'Pre-order Service Fee')).toBeUndefined();
  });

  it('Pre-order fee is 2% of the discounted item price', () => {
    const inputs = { ...baseInputs, isPreOrder: true, sellerDiscount: 250 };
    const fees = calculatePHFeesSync(inputs, phRates);
    const preOrder = findFee(fees, 'Pre-order Service Fee');
    // Base = 750, fee = 15.00
    expect(preOrder).toBeDefined();
    expect(preOrder!.base).toBe(750);
    expect(preOrder!.amount).toBe(15);
  });

  it('Affiliate commission is calculated on the discounted item price', () => {
    const inputs = {
      ...baseInputs,
      sellerDiscount: 100,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    const affiliate = findFee(fees, 'Affiliate Commission');
    // Base = 900, 10% = 90.00
    expect(affiliate).toBeDefined();
    expect(affiliate!.base).toBe(900);
    expect(affiliate!.amount).toBe(90);
  });

  it('No affiliate line when the rate is zero', () => {
    const inputs = {
      ...baseInputs,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 0,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    expect(findFee(fees, 'Affiliate Commission')).toBeUndefined();
  });

  it('Unknown category falls back to the 6.7% marketplace default', () => {
    const inputs = { ...baseInputs, categoryId: 'ph-does-not-exist' };
    const fees = calculatePHFeesSync(inputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('6.70%');
    expect(commission!.amount).toBe(67);
    expect(commission!.confidence).toBe('needs-verification');
  });

  it('Unknown category falls back to the 7.7% mall default', () => {
    const inputs = {
      ...baseInputs,
      categoryId: 'ph-does-not-exist',
      sellerTier: 'mall' as const,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    const commission = findFee(fees, 'Commission Fee');
    expect(commission!.rate).toBe('7.70%');
    expect(commission!.amount).toBe(77);
    expect(commission!.confidence).toBe('needs-verification');
  });

  it('Mall commission is always higher than marketplace for the same category', () => {
    const marketplace = findFee(
      calculatePHFeesSync(baseInputs, phRates),
      'Commission Fee'
    )!;
    const mall = findFee(
      calculatePHFeesSync(
        { ...baseInputs, sellerTier: 'mall' as const },
        phRates
      ),
      'Commission Fee'
    )!;
    expect(mall.rate).not.toBe(marketplace.rate);
    expect(Number(mall.rate.replace('%', ''))).toBeGreaterThan(
      Number(marketplace.rate.replace('%', ''))
    );
  });

  it('Commission notes name the resolved seller tier', () => {
    const mall = findFee(
      calculatePHFeesSync(
        { ...baseInputs, sellerTier: 'mall' as const },
        phRates
      ),
      'Commission Fee'
    )!;
    expect(mall.notes).toContain('Mall');

    const marketplace = findFee(
      calculatePHFeesSync(baseInputs, phRates),
      'Commission Fee'
    )!;
    expect(marketplace.notes).toContain('Marketplace');
  });

  it('Full fee set is returned for a pre-order enrolled affiliate order', () => {
    const inputs = {
      ...baseInputs,
      isPreOrder: true,
      isShippingProgramEnrolled: true,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    expect(fees.map(f => f.name)).toEqual([
      'Commission Fee',
      'Transaction Fee',
      'Shipping Service Fee',
      'Pre-order Service Fee',
      'Affiliate Commission',
    ]);
  });

  it('Every fee line carries source metadata', () => {
    const inputs = {
      ...baseInputs,
      isPreOrder: true,
      isShippingProgramEnrolled: true,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 5,
    };
    const fees = calculatePHFeesSync(inputs, phRates);
    for (const fee of fees) {
      expect(fee.sourceUrl).toMatch(/^https:\/\//);
      expect(fee.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Amounts are rounded to two decimals', () => {
    const inputs = { ...baseInputs, sellingPrice: 33.33 };
    const fees = calculatePHFeesSync(inputs, phRates);
    for (const fee of fees) {
      expect(Number(fee.amount.toFixed(2))).toBe(fee.amount);
    }
  });
});
