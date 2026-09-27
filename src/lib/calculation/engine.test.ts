import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveRate,
  calculateProfitMargin,
  calculateContributionMargin,
  calculateContributionMarginPct,
  calculateBreakEvenPrice,
  calculateTargetPrice,
  calculateMaxCPA,
  calculateMonthlyProjection,
  sumFeeAmounts,
  getFeeByName,
} from './engine';

describe('calculateEffectiveRate', () => {
  it('Normal case: totalFees=6, sellingPrice=100 → 0.06', () => {
    expect(calculateEffectiveRate(6, 100)).toBe(0.06);
  });

  it('Zero fees: totalFees=0, sellingPrice=100 → 0', () => {
    expect(calculateEffectiveRate(0, 100)).toBe(0);
  });

  it('Zero sellingPrice: totalFees=6, sellingPrice=0 → 0', () => {
    expect(calculateEffectiveRate(6, 0)).toBe(0);
  });

  it('Negative sellingPrice: should return 0', () => {
    expect(calculateEffectiveRate(6, -10)).toBe(0);
  });
});

describe('calculateProfitMargin', () => {
  it('Normal case: netProfit=20, sellingPrice=100 → 0.20', () => {
    expect(calculateProfitMargin(20, 100)).toBe(0.2);
  });

  it('Negative profit: netProfit=-10, sellingPrice=100 → -0.10', () => {
    expect(calculateProfitMargin(-10, 100)).toBe(-0.1);
  });

  it('Zero sellingPrice: → 0', () => {
    expect(calculateProfitMargin(20, 0)).toBe(0);
  });
});

describe('calculateContributionMargin', () => {
  it('Normal case: sellingPrice=100, fees=10, cogs=30, shipping=5 → 55', () => {
    expect(calculateContributionMargin(100, 10, 30, 5)).toBe(55);
  });

  it('Zero values: all zero → 0', () => {
    expect(calculateContributionMargin(0, 0, 0, 0)).toBe(0);
  });
});

describe('calculateContributionMarginPct', () => {
  it('Normal case: margin=55, sellingPrice=100 → 0.55', () => {
    expect(calculateContributionMarginPct(55, 100)).toBe(0.55);
  });

  it('Zero sellingPrice: → 0', () => {
    expect(calculateContributionMarginPct(55, 0)).toBe(0);
  });
});

describe('calculateBreakEvenPrice', () => {
  it('Simple case: cogs=30, shipping=5, cpa=0, feeCalculator = (p) => p * 0.06 → ~37.23', () => {
    const feeCalculator = (p: number) => p * 0.06;
    const result = calculateBreakEvenPrice(30, 5, 0, feeCalculator);
    // 0.94P = 35 → P = 37.234...
    expect(result).toBeCloseTo(37.23, 1);
  });

  it('Zero costs: cogs=0, shipping=0, cpa=0, feeCalculator = (p) => 0 → 0', () => {
    const feeCalculator = (p: number) => 0;
    const result = calculateBreakEvenPrice(0, 0, 0, feeCalculator);
    expect(result).toBeCloseTo(0, 1);
  });

  it('High fees: feeCalculator = (p) => p * 0.50, cogs=30, shipping=5, cpa=0 → 70', () => {
    const feeCalculator = (p: number) => p * 0.5;
    const result = calculateBreakEvenPrice(30, 5, 0, feeCalculator);
    // 0.5P = 35 → P = 70
    expect(result).toBeCloseTo(70, 1);
  });
});

describe('calculateTargetPrice', () => {
  it('Target profit $10: cogs=30, shipping=5, cpa=0, feeCalculator = (p) => p * 0.06 → ~47.87', () => {
    const feeCalculator = (p: number) => p * 0.06;
    const result = calculateTargetPrice(10, 30, 5, 0, feeCalculator);
    // 0.94P = 45 → P = 47.87
    expect(result).toBeCloseTo(47.87, 1);
  });

  it('Unachievable target: fee > 100% of price → returns 0', () => {
    // Fee calculator returns more than 100% of price - impossible to profit
    const feeCalculator = (p: number) => p * 1.5;
    const result = calculateTargetPrice(1000, 30, 5, 0, feeCalculator);
    expect(result).toBe(0);
  });

  it('Zero target: should equal break-even price', () => {
    const feeCalculator = (p: number) => p * 0.06;
    const breakEven = calculateBreakEvenPrice(30, 5, 0, feeCalculator);
    const targetZero = calculateTargetPrice(0, 30, 5, 0, feeCalculator);
    expect(targetZero).toBeCloseTo(breakEven, 1);
  });
});

describe('calculateMaxCPA', () => {
  it('Normal case: sellingPrice=100, fees=10, cogs=30, shipping=5, targetROAS=4 → min(25, 55) = 25', () => {
    expect(calculateMaxCPA(100, 10, 30, 5, 4)).toBe(25);
  });

  it('targetROAS=0: should return cpaFromProfit (55)', () => {
    expect(calculateMaxCPA(100, 10, 30, 5, 0)).toBe(55);
  });

  it('Negative targetROAS: should return cpaFromProfit (55)', () => {
    expect(calculateMaxCPA(100, 10, 30, 5, -1)).toBe(55);
  });

  it('Negative cpaFromProfit: should return 0', () => {
    // sellingPrice=100, fees=50, cogs=60, shipping=10 → cpaFromProfit = -20
    expect(calculateMaxCPA(100, 50, 60, 10, 4)).toBe(0);
  });

  it('ROAS constraint binding: min(25, 55) = 25', () => {
    // cpaFromROAS = 25, cpaFromProfit = 55 → min = 25
    expect(calculateMaxCPA(100, 10, 30, 5, 4)).toBe(25);
  });
});

describe('calculateMonthlyProjection', () => {
  it('Normal case: units=100, netProfitPerUnit=10, sellingPrice=50, totalFeesPerUnit=5', () => {
    const result = calculateMonthlyProjection(100, 10, 50, 5);
    expect(result.gmv).toBe(5000);
    expect(result.totalFees).toBe(500);
    expect(result.totalProfit).toBe(1000);
    expect(result.avgProfitPerUnit).toBe(10);
    expect(result.units).toBe(100);
  });

  it('Zero units: → all zeros', () => {
    const result = calculateMonthlyProjection(0, 10, 100, 20);
    expect(result).toEqual({
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    });
  });

  it('Negative units: → all zeros', () => {
    const result = calculateMonthlyProjection(-5, 10, 100, 20);
    expect(result).toEqual({
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    });
  });
});

describe('sumFeeAmounts', () => {
  it('Normal case: fees=[{amount: 5}, {amount: 3}] → 8', () => {
    expect(sumFeeAmounts([{ amount: 5 }, { amount: 3 }])).toBe(8);
  });

  it('Empty array: → 0', () => {
    expect(sumFeeAmounts([])).toBe(0);
  });
});

describe('getFeeByName', () => {
  it('Found: fees=[{name: "Referral", amount: 6}] → 6', () => {
    expect(getFeeByName([{ name: 'Referral', amount: 6 }], 'Referral')).toBe(6);
  });

  it('Not found: → undefined', () => {
    expect(getFeeByName([{ name: 'Referral', amount: 6 }], 'Unknown')).toBeUndefined();
  });
});