import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateProfit,
  getAvailableMarkets,
  validateInputs,
  type CalculatorInputs,
  type CalculationErrorResult,
  type Market,
} from './index';
import { calculateUSFeesSync } from './markets/US';
import { calculatePHFeesSync } from './markets/PH';
import { calculateSGFeesSync } from './markets/SG';
import { calculateMYFeesSync } from './markets/MY';
import { calculateUKFeesSync } from './markets/UK';
import { loadMarketRatesSync, clearRatesCache } from '@/lib/rates/loader';

const MARKETS: Market[] = ['US', 'PH', 'SG', 'MY', 'UK'];

const ENGINES = {
  US: calculateUSFeesSync,
  PH: calculatePHFeesSync,
  SG: calculateSGFeesSync,
  MY: calculateMYFeesSync,
  UK: calculateUKFeesSync,
} as const;

// A real category id from each market's rate file, so dispatch exercises the
// same lookup path the engines use. Tiers match sellerTier: 'standard'.
const CATEGORY_IDS: Record<Market, string> = {
  US: 'us-auto-car-electronics',
  PH: 'ph-fashion-accessories',
  SG: 'sg-standard-default',
  MY: 'my-electronics-nonbxp-mp',
  UK: 'uk-standard',
};

function makeInputs(market: Market, overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    market,
    sellerTier: 'standard',
    categoryId: CATEGORY_IDS[market],
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

beforeAll(() => {
  clearRatesCache();
});

afterAll(() => {
  clearRatesCache();
});

describe('getAvailableMarkets', () => {
  it('returns exactly the 5 supported markets in UI order', () => {
    expect(getAvailableMarkets()).toEqual(['US', 'PH', 'SG', 'MY', 'UK']);
  });

  it('returns a defensive copy so callers cannot mutate module state', () => {
    const first = getAvailableMarkets();
    first.push('XX' as Market);
    expect(getAvailableMarkets()).toEqual(['US', 'PH', 'SG', 'MY', 'UK']);
  });
});

describe('validateInputs', () => {
  it('accepts valid inputs for all 5 markets', () => {
    for (const market of MARKETS) {
      const result = validateInputs(makeInputs(market));
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('rejects an unknown market', () => {
    const result = validateInputs(makeInputs('XX' as Market));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Unknown market');
  });

  it('rejects a non-positive sellingPrice', () => {
    expect(validateInputs(makeInputs('US', { sellingPrice: 0 })).errors.join(' ')).toContain(
      'sellingPrice must be greater than 0'
    );
    expect(validateInputs(makeInputs('US', { sellingPrice: -5 })).errors.join(' ')).toContain(
      'sellingPrice must be greater than 0'
    );
  });

  it('rejects a missing categoryId', () => {
    expect(validateInputs(makeInputs('US', { categoryId: '' })).errors.join(' ')).toContain('categoryId');
  });

  it('rejects negative cost fields', () => {
    const errors = validateInputs(makeInputs('US', { cogs: -1 })).errors.join(' ');
    expect(errors).toContain('cogs cannot be negative');
  });

  it('rejects a sellerDiscount larger than sellingPrice', () => {
    expect(validateInputs(makeInputs('US', { sellingPrice: 50, sellerDiscount: 60 })).errors.join(' ')).toContain(
      'sellerDiscount cannot exceed sellingPrice'
    );
  });

  it('rejects an out-of-range returnRate', () => {
    expect(validateInputs(makeInputs('US', { returnRate: 101 })).errors.join(' ')).toContain('returnRate');
  });

  it('collects multiple errors at once', () => {
    const result = validateInputs(
      makeInputs('XX' as Market, { categoryId: '', sellingPrice: 0, returnRate: -5 })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('calculateProfit - per market dispatch', () => {
  for (const market of MARKETS) {
    it(`produces a complete CalculationResult for ${market}`, () => {
      const inputs = makeInputs(market);
      const result = calculateProfit(inputs);

      expect(result.inputs).toBe(inputs);
      expect(result.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(Date.parse(result.calculatedAt))).toBe(false);
      expect(result.rateVersion).toBe(`${market}-2026-09-26`);

      // Structural completeness
      expect(Array.isArray(result.fees)).toBe(true);
      expect(result.fees.length).toBeGreaterThan(0);
      expect(typeof result.totalPlatformFees).toBe('number');
      expect(typeof result.netProfit).toBe('number');
      expect(typeof result.profitMargin).toBe('number');
      expect(typeof result.effectiveTakeRate).toBe('number');
      expect(typeof result.contributionMargin).toBe('number');
      expect(typeof result.contributionMarginPct).toBe('number');
      expect(typeof result.breakEvenPrice).toBe('number');
      expect(typeof result.targetProfitPrice).toBe('function');
      expect(typeof result.maxCPA).toBe('function');
      expect(typeof result.monthlyProjection).toBe('function');
      expect('errors' in result).toBe(false);
    });

    it(`returns a non-empty, internally consistent fee breakdown for ${market}`, () => {
      const inputs = makeInputs(market);
      const result = calculateProfit(inputs);
      expect(result.fees.length).toBeGreaterThan(0);
      for (const fee of result.fees) {
        expect(typeof fee.name).toBe('string');
        expect(Number.isFinite(fee.amount)).toBe(true);
        expect(fee.amount).toBeGreaterThanOrEqual(0);
      }
      const summed = result.fees.reduce((s, f) => s + f.amount, 0);
      expect(result.totalPlatformFees).toBeCloseTo(Math.round(summed * 100) / 100, 2);
    });
  }

  it('dispatches to the correct engine for every market', () => {
    for (const market of MARKETS) {
      const inputs = makeInputs(market);
      const result = calculateProfit(inputs);
      const direct = ENGINES[market](inputs, loadMarketRatesSync(market));
      expect(result.fees).toEqual(direct);
    }
  });

  it('does not fall back to one engine for all markets', () => {
    const us = calculateProfit(makeInputs('US')).fees;
    // US uses 'Referral Fee' while every other market uses a commission-named fee.
    expect(us.map((f) => f.name)).toContain('Referral Fee');
    for (const market of MARKETS.filter((m) => m !== 'US')) {
      const fees = calculateProfit(makeInputs(market)).fees;
      expect(fees.map((f) => f.name)).not.toContain('Referral Fee');
    }
    // UK and MY are structurally distinct from PH/SG.
    expect(calculateProfit(makeInputs('UK')).fees.map((f) => f.name)).toContain(
      'Platform Commission Fee'
    );
    expect(calculateProfit(makeInputs('MY')).fees.map((f) => f.name)).toContain(
      'Platform Support Fee'
    );
  });

  it('computes netProfit from price minus fees and costs', () => {
    const inputs = makeInputs('US');
    const result = calculateProfit(inputs);
    const expected =
      inputs.sellingPrice -
      result.totalPlatformFees -
      inputs.cogs -
      inputs.outboundShipping -
      inputs.cpa;
    expect(result.netProfit).toBeCloseTo(Math.round(expected * 100) / 100, 2);
  });

  it('computes effectiveTakeRate and profitMargin as ratios of selling price', () => {
    const result = calculateProfit(makeInputs('US'));
    expect(result.effectiveTakeRate).toBeCloseTo(result.totalPlatformFees / 100, 2);
    expect(result.profitMargin).toBeCloseTo(result.netProfit / 100, 2);
  });

  it('excludes MY flat per-order fee from contribution margin but includes it in totalPlatformFees', () => {
    const inputs = makeInputs('MY', { sellingPrice: 100 });
    const result = calculateProfit(inputs);

    const supportFee = result.fees.find((f) => f.name === 'Platform Support Fee');
    expect(supportFee).toBeDefined();
    expect(supportFee!.amount).toBe(0.54);

    // variableFees = totalPlatformFees - 0.54
    const expectedVariable = result.totalPlatformFees - 0.54;
    const expectedContribution = Math.round((100 - expectedVariable - 30 - 5) * 100) / 100;
    expect(result.contributionMargin).toBeCloseTo(expectedContribution, 1);
  });
});

describe('calculateProfit - invalid inputs', () => {
  it('returns an error result for an unknown market', () => {
    const result = calculateProfit(makeInputs('XX' as Market)) as CalculationErrorResult;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('Unknown market');
    expect(result.fees).toEqual([]);
    expect(result.totalPlatformFees).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.breakEvenPrice).toBe(0);
    expect(result.rateVersion).toBe('invalid-inputs');
  });

  it('returns an error result for a zero sellingPrice', () => {
    const result = calculateProfit(makeInputs('US', { sellingPrice: 0 })) as CalculationErrorResult;
    expect(result.errors.join(' ')).toContain('sellingPrice must be greater than 0');
    expect(result.fees).toEqual([]);
  });

  it('error result reverse calculators return safe zeros instead of throwing', () => {
    const result = calculateProfit(makeInputs('US', { sellingPrice: -1 }));
    expect(result.breakEvenPrice).toBe(0);
    // F-11: an error result must also say "not achievable", not just price 0.
    expect(result.targetProfitPrice(50)).toEqual({ price: 0, achievable: false });
    expect(result.maxCPA(4)).toBe(0);
    expect(result.monthlyProjection(100)).toEqual({
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    });
  });

  it('does not crash on null inputs', () => {
    const result = calculateProfit(null as unknown as CalculatorInputs) as CalculationErrorResult;
    expect(result.errors).toEqual(['inputs is required']);
  });
});

describe('reverse calculators', () => {
  it('breakEvenPrice is the price where profit is approximately zero', () => {
    for (const market of MARKETS) {
      const inputs = makeInputs(market, { sellingPrice: 100 });
      const result = calculateProfit(inputs);
      const be = result.breakEvenPrice;

      expect(be).toBeGreaterThan(0);
      const probe = { ...inputs, sellingPrice: be };
      const probeFees = calculateProfit(probe);
      expect(Math.abs(probeFees.netProfit)).toBeLessThanOrEqual(0.5);
    }
  });

  it('breakEvenPrice is above raw cost (fees must be covered too)', () => {
    const result = calculateProfit(makeInputs('US'));
    expect(result.breakEvenPrice).toBeGreaterThan(30 + 5);
  });

  it('targetProfitPrice delivers approximately the requested profit', () => {
    const result = calculateProfit(makeInputs('US'));
    for (const target of [10, 25, 50]) {
      const { price, achievable } = result.targetProfitPrice(target);
      expect(achievable).toBe(true);
      expect(price).toBeGreaterThan(0);
      const probe = calculateProfit({ ...makeInputs('US'), sellingPrice: price });
      expect(probe.netProfit).toBeCloseTo(target, 0);
    }
  });

  it('returns a price above sellingPrice for an aggressive target', () => {
    const result = calculateProfit(makeInputs('US'));
    const { price, achievable } = result.targetProfitPrice(1_000_000);
    expect(achievable).toBe(true);
    expect(price).toBeGreaterThan(100);
  });

  it('targetProfitPrice always reports achievability alongside the price', () => {
    // F-11: the engine used to return a bare number, and 0 doubled as the
    // "no solution" sentinel. Achievability is now a field of its own, so a
    // caller can never mistake a sentinel for a real quote.
    const result = calculateProfit(makeInputs('US'));
    for (const target of [-100, 0, 10, 25, 50, 1_000_000]) {
      const { price, achievable } = result.targetProfitPrice(target);
      expect(typeof price).toBe('number');
      expect(typeof achievable).toBe('boolean');
      // A negative target is satisfiable at the floor, so it is achievable.
      expect(achievable).toBe(true);
      expect(price).toBeGreaterThanOrEqual(0);
    }
  });

  it('a large but reachable target is still achievable', () => {
    // Guards the 100x search bound from being reported as "unachievable"
    // merely because the target is large: at a ~10% all-in fee rate, any
    // positive target is reachable at some price.
    const result = calculateProfit(makeInputs('US'));
    const { price, achievable } = result.targetProfitPrice(1_000_000);
    expect(achievable).toBe(true);
    expect(price).toBeGreaterThan(1_000_000);
  });

  it('a zero target returns break-even, not the bare fixed costs', () => {
    // A zero target has to cover the fees charged at that price, so it is the
    // break-even price and not cogs + shipping.
    const result = calculateProfit(makeInputs('US'));
    const { price, achievable } = result.targetProfitPrice(0);
    expect(achievable).toBe(true);
    expect(price).toBeCloseTo(result.breakEvenPrice, 1);
  });

  it('maxCPA is the min of the ROAS cap and the profit cap', () => {
    const inputs = makeInputs('US');
    const result = calculateProfit(inputs);
    const cpaFromProfit = inputs.sellingPrice - result.totalPlatformFees - inputs.cogs - inputs.outboundShipping;

    expect(result.maxCPA(4)).toBeCloseTo(Math.min(25, cpaFromProfit), 1);
    expect(result.maxCPA(0.1)).toBeCloseTo(cpaFromProfit, 1);
    expect(result.maxCPA(4)).toBeGreaterThanOrEqual(0);
  });

  it('maxCPA never returns a negative value', () => {
    const result = calculateProfit(makeInputs('US', { sellingPrice: 10, cogs: 300, outboundShipping: 5 }));
    expect(result.maxCPA(4)).toBe(0);
  });

  it('MY reverse calculators keep the flat RM0.54 fee flat at higher prices', () => {
    const inputs = makeInputs('MY', { sellingPrice: 100 });
    const base = calculateProfit(inputs);
    const be = calculateProfit({ ...inputs, sellingPrice: base.breakEvenPrice });

    const supportAtBreakEven = be.fees.find((f) => f.name === 'Platform Support Fee');
    expect(supportAtBreakEven!.amount).toBe(0.54);
    expect(Math.abs(be.netProfit)).toBeLessThanOrEqual(0.5);
  });
});

describe('monthlyProjection', () => {
  it('scales units, gmv, fees and profit linearly', () => {
    const inputs = makeInputs('US');
    const result = calculateProfit(inputs);
    const projection = result.monthlyProjection(100);

    expect(projection.units).toBe(100);
    expect(projection.gmv).toBe(10_000);
    expect(projection.totalFees).toBeCloseTo(result.totalPlatformFees * 100, 1);
    expect(projection.totalProfit).toBeCloseTo(result.netProfit * 100, 1);
    expect(projection.avgProfitPerUnit).toBe(result.netProfit);
  });

  it('returns zeroed projection for zero or negative units', () => {
    const result = calculateProfit(makeInputs('US'));
    for (const units of [0, -10]) {
      expect(result.monthlyProjection(units)).toEqual({
        units: 0,
        gmv: 0,
        totalFees: 0,
        totalProfit: 0,
        avgProfitPerUnit: 0,
      });
    }
  });

  it('matches gmv for every market', () => {
    for (const market of MARKETS) {
      const result = calculateProfit(makeInputs(market));
      expect(result.monthlyProjection(250).gmv).toBe(25_000);
    }
  });
});

describe('market data integration', () => {
  it('loads each market through the canonical loader', () => {
    for (const market of MARKETS) {
      const rates = loadMarketRatesSync(market);
      expect(rates.market).toBe(market);
    }
  });

  it('uses the US engine as the reference implementation for fee names', () => {
    const inputs = makeInputs('US');
    const result = calculateProfit(inputs);
    const expected = calculateUSFeesSync(inputs, loadMarketRatesSync('US'));
    expect(result.fees).toEqual(expected);
  });
});
