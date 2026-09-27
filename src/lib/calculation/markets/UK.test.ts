import { describe, it, expect, beforeAll } from 'vitest';
import { calculateUKFeesSync } from './UK';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import type {
  AffiliateMode,
  CalculatorInputs,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let ukRates: MarketRateData;

beforeAll(async () => {
  ukRates = loadMarketRatesSync('UK');
});

const baseInputs: CalculatorInputs = {
  market: 'UK',
  sellerTier: 'standard',
  categoryId: 'uk-standard',
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
};

describe('calculateUKFeesSync', () => {
  it('Standard 9% commission on a GBP 100 sale', () => {
    const fees = calculateUKFeesSync(baseInputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    expect(commission).toBeDefined();
    expect(commission!.base).toBe(100);
    expect(commission!.amount).toBe(9);
  });

  it('Commission base includes customer shipping', () => {
    const inputs = { ...baseInputs, customerShipping: 10 };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    // Base = 100 + 10 = 110, fee = 9.90
    expect(commission!.base).toBe(110);
    expect(commission!.amount).toBe(9.9);
  });

  it('Commission base includes platform discount', () => {
    const inputs = { ...baseInputs, platformDiscount: 20 };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    // Base = 100 + 20 = 120, fee = 10.80
    expect(commission!.base).toBe(120);
    expect(commission!.amount).toBe(10.8);
  });

  it('Seller discount reduces the commission base', () => {
    const inputs = { ...baseInputs, sellerDiscount: 20 };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    // Base = 80, fee = 7.20
    expect(commission!.base).toBe(80);
    expect(commission!.amount).toBe(7.2);
  });

  it('Electronics category uses the reduced 5% rate', () => {
    const inputs = { ...baseInputs, categoryId: 'uk-electronics' };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    expect(commission!.rate).toBe('5.00%');
    expect(commission!.amount).toBe(5);
  });

  it('Beauty and Personal Care uses the reduced 5% rate', () => {
    const inputs = { ...baseInputs, categoryId: 'uk-beauty-personal-care' };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    expect(commission!.rate).toBe('5.00%');
    expect(commission!.amount).toBe(5);
  });

  it('New seller promo waives commission and is flagged for verification', () => {
    const inputs = {
      ...baseInputs,
      categoryId: 'uk-new-seller-promo',
      newSellerPromo: true,
      promoDaysRemaining: 45,
    };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(f =>
      f.name.includes('New Seller Promo')
    );
    expect(commission).toBeDefined();
    expect(commission!.amount).toBe(0);
    expect(commission!.rate).toBe('0%');
    expect(commission!.confidence).toBe('needs-verification');
  });

  it('Promo does not apply once promo days are exhausted', () => {
    const inputs = {
      ...baseInputs,
      categoryId: 'uk-new-seller-promo',
      newSellerPromo: true,
      promoDaysRemaining: 0,
    };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(f => f.name === 'Platform Commission Fee');
    expect(commission).toBeDefined();
    expect(commission!.amount).toBe(0); // promo category rate is 0%
  });

  it('Affiliate commission is calculated on net sales', () => {
    const inputs = {
      ...baseInputs,
      sellerDiscount: 10,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 10,
    };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const affiliate = fees.find(f => f.name === 'Affiliate Commission');
    expect(affiliate).toBeDefined();
    // Net sales = 100 - 10 = 90, 10% = 9.00
    expect(affiliate!.base).toBe(90);
    expect(affiliate!.amount).toBe(9);
  });

  it('No affiliate fee line when affiliate mode is none', () => {
    const fees = calculateUKFeesSync(baseInputs, ukRates);
    expect(fees.find(f => f.name === 'Affiliate Commission')).toBeUndefined();
  });

  it('No separate transaction fee in UK fees', () => {
    const fees = calculateUKFeesSync(baseInputs, ukRates);
    expect(
      fees.find(f => f.name.toLowerCase().includes('transaction'))
    ).toBeUndefined();
  });

  it('Unknown category falls back to 9% and is flagged', () => {
    const inputs = { ...baseInputs, categoryId: 'uk-unknown-category' };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    expect(commission!.amount).toBe(9);
    expect(commission!.confidence).toBe('needs-verification');
  });

  it('Every fee line carries source metadata', () => {
    const inputs = {
      ...baseInputs,
      affiliateMode: 'open' as AffiliateMode,
      affiliateRate: 5,
    };
    const fees = calculateUKFeesSync(inputs, ukRates);
    expect(fees.length).toBeGreaterThan(0);
    for (const fee of fees) {
      expect(fee.sourceUrl).toMatch(/^https:\/\//);
      expect(fee.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Amounts are rounded to two decimals', () => {
    const inputs = { ...baseInputs, sellingPrice: 33.33 };
    const fees = calculateUKFeesSync(inputs, ukRates);
    const commission = fees.find(
      f => f.name === 'Platform Commission Fee'
    );
    // 33.33 * 0.09 = 2.9997 -> 3
    expect(commission!.amount).toBe(3);
    expect(Number.isInteger(commission!.amount * 100)).toBe(true);
  });
});
