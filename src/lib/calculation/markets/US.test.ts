import { describe, it, expect, beforeAll } from 'vitest';
import { calculateUSFeesSync } from './US';
import { loadMarketRates } from '@/lib/rates/loader';
import type { CalculatorInputs, AffiliateMode } from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let usRates: MarketRateData;

beforeAll(async () => {
  usRates = await loadMarketRates('US');
});

const baseInputs: CalculatorInputs = {
  market: 'US',
  sellerTier: 'standard',
  categoryId: 'us-beauty-bath-body-care', // Standard 6% category
  sellingPrice: 100,
  sellerDiscount: 0,
  platformDiscount: 0,
  customerShipping: 0,
  cogs: 30,
  outboundShipping: 5,
  affiliateMode: 'none' as AffiliateMode,
  affiliateRate: 0,
  returnRate: 5,
  cpa: 0,
  newSellerPromo: false,
  promoDaysRemaining: 0,
  isPreOrder: false,
  isShippingProgramEnrolled: false,
  isGMVMaxActive: false,
};

describe('calculateUSFeesSync', () => {
  it('Standard 6% referral fee on $100 sale', () => {
    const fees = calculateUSFeesSync(baseInputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    expect(referralFee).toBeDefined();
    expect(referralFee!.amount).toBe(6.00); // 6% of $100
    expect(referralFee!.base).toBe(100);
  });

  it('Jewelry category (Diamond) at 5%', () => {
    const inputs = { ...baseInputs, categoryId: 'us-jewelry-diamond' };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    expect(referralFee!.amount).toBe(5.00); // 5% of $100
  });

  it('Platform discount increases referral base', () => {
    const inputs = { ...baseInputs, platformDiscount: 10 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // Base = 100 + 10 = 110, fee = 6.60
    expect(referralFee!.base).toBe(110);
    expect(referralFee!.amount).toBe(6.60);
  });

  it('Seller discount reduces referral base', () => {
    const inputs = { ...baseInputs, sellerDiscount: 10 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // Base = (100-10) + 0 = 90, fee = 5.40
    expect(referralFee!.base).toBe(90);
    expect(referralFee!.amount).toBe(5.40);
  });

  it('Customer shipping included in base', () => {
    const inputs = { ...baseInputs, customerShipping: 10 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // Base = 100 + 10 = 110, fee = 6.60
    expect(referralFee!.base).toBe(110);
    expect(referralFee!.amount).toBe(6.60);
  });

  it('Pre-Owned category (Bags) at 5% with tiered threshold', () => {
    const inputs = { ...baseInputs, categoryId: 'us-preowned-bags', sellingPrice: 15000 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // 5% on first $10K = $500, 3% on $5K = $150, total = $650
    expect(referralFee!.amount).toBe(650);
    expect(referralFee!.notes).toContain('Tiered');
  });

  it('Collectibles category at 6% with tiered threshold', () => {
    const inputs = { ...baseInputs, categoryId: 'us-collectibles-cultural-items', sellingPrice: 15000 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // 6% on first $10K = $600, 3% on $5K = $150, total = $750
    expect(referralFee!.amount).toBe(750);
  });

  it('Refund admin fee modeled at 5% return rate', () => {
    const inputs = { ...baseInputs, returnRate: 5 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const refundFee = fees.find(f => f.name === 'Refund Admin Fee (modeled)');
    expect(refundFee).toBeDefined();
    // Referral fee = $6, 20% = $1.20, capped at $5, so $1.20
    // 5% return rate → 0.05 * 1.20 = $0.06
    expect(refundFee!.amount).toBe(0.06);
  });

  it('Refund admin fee capped at $5/SKU', () => {
    const inputs = { ...baseInputs, sellingPrice: 1000, returnRate: 5 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const refundFee = fees.find(f => f.name === 'Refund Admin Fee (modeled)');
    // Referral fee = $60, 20% = $12, capped at $5
    // 5% return rate → 0.05 * 5 = $0.25
    expect(refundFee!.amount).toBe(0.25);
  });

  it('Affiliate commission calculated on net price', () => {
    const inputs = { ...baseInputs, affiliateMode: 'open' as AffiliateMode, affiliateRate: 10 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const affiliateFee = fees.find(f => f.name === 'Affiliate Commission');
    expect(affiliateFee).toBeDefined();
    // Net price = 100, 10% = $10
    expect(affiliateFee!.amount).toBe(10);
    expect(affiliateFee!.base).toBe(100);
  });

  it('New seller promo applies 1.8% rate', () => {
    const inputs = { ...baseInputs, newSellerPromo: true, promoDaysRemaining: 90 };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    // 1.8% of $100 = $1.80
    expect(referralFee!.amount).toBe(1.80);
    expect(referralFee!.notes).toContain('NEEDS VERIFICATION');
  });

  it('No separate transaction fee in US fees', () => {
    const fees = calculateUSFeesSync(baseInputs, usRates);
    const txnFee = fees.find(f => f.name.toLowerCase().includes('transaction'));
    expect(txnFee).toBeUndefined();
  });

  it('Missing category falls back to default 6%', () => {
    const inputs = { ...baseInputs, categoryId: 'us-unknown-category' };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    expect(referralFee!.amount).toBe(6.00);
    expect(referralFee!.confidence).toBe('needs-verification');
  });

  it('Jewelry Amber is 6% (not 5%)', () => {
    const inputs = { ...baseInputs, categoryId: 'us-jewelry-amber' };
    const fees = calculateUSFeesSync(inputs, usRates);
    const referralFee = fees.find(f => f.name === 'Referral Fee');
    expect(referralFee!.amount).toBe(6.00);
  });
});