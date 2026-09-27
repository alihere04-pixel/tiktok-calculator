// CALCULATION ENGINE
// NOTE: This file was created during Step 2.5 cleanup.
// These functions will be reviewed and refined in Step 3.
// Do NOT assume they are final until Step 3 review is complete.

import { roundToTwo, roundToFour } from './utils';

export function calculateEffectiveRate(totalFees: number, sellingPrice: number): number {
  if (sellingPrice <= 0) return 0;
  return roundToFour(totalFees / sellingPrice);
}

export function calculateProfitMargin(netProfit: number, sellingPrice: number): number {
  if (sellingPrice <= 0) return 0;
  return roundToFour(netProfit / sellingPrice);
}

export function calculateContributionMargin(
  sellingPrice: number,
  totalVariableFees: number,
  cogs: number,
  outboundShipping: number
): number {
  return roundToTwo(sellingPrice - totalVariableFees - cogs - outboundShipping);
}

export function calculateContributionMarginPct(
  contributionMargin: number,
  sellingPrice: number
): number {
  if (sellingPrice <= 0) return 0;
  return roundToFour(contributionMargin / sellingPrice);
}

export function calculateBreakEvenPrice(
  cogs: number,
  shipping: number,
  cpa: number,
  feeCalculator: (price: number) => number
): number {
  let low = cogs + shipping + cpa;
  let high = low * 10;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const profit = mid - feeCalculator(mid) - cogs - shipping - cpa;
    if (profit > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return roundToTwo((low + high) / 2);
}

export function calculateTargetPrice(
  targetProfit: number,
  cogs: number,
  shipping: number,
  cpa: number,
  feeCalculator: (price: number) => number
): number {
  // Maximum reasonable price bound: 100x the minimum viable price
  // If no solution within this bound, the target profit is likely unachievable.
  const minPrice = cogs + shipping + cpa + targetProfit;
  const MAX_PRICE_MULTIPLIER = 100;
  const maxPrice = minPrice * MAX_PRICE_MULTIPLIER;

  let low = minPrice;
  let high = maxPrice;
  let solutionFound = false;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const profit = mid - feeCalculator(mid) - cogs - shipping - cpa;

    if (profit > targetProfit) {
      high = mid;
      solutionFound = true;
    } else if (profit < targetProfit) {
      low = mid;
    } else {
      // Exact match
      solutionFound = true;
      high = mid;
      break;
    }
  }

  // If no solution found within bounds, return 0 (unachievable target)
  if (!solutionFound) {
    return 0;
  }

  return roundToTwo((low + high) / 2);

  // TEST COMMENT:
  // If targetProfit is unrealistic (e.g., 10000% margin), returns 0
  // If feeCalculator is constant and targetProfit > possible max, returns 0
}

export function calculateMaxCPA(
  sellingPrice: number,
  totalFees: number,
  cogs: number,
  shipping: number,
  targetROAS: number
): number {
  // Guard: targetROAS must be positive. If <= 0, ROAS constraint is invalid.
  // Return only the profit-constrained CPA (cpaFromProfit), clamped at 0.
  if (targetROAS <= 0) {
    const cpaFromProfit = sellingPrice - totalFees - cogs - shipping;
    return Math.max(0, roundToTwo(cpaFromProfit));
  }

  const cpaFromROAS = sellingPrice / targetROAS;
  const cpaFromProfit = sellingPrice - totalFees - cogs - shipping;
  return Math.max(0, roundToTwo(Math.min(cpaFromROAS, cpaFromProfit)));

  // TEST COMMENT:
  // calculateMaxCPA(100, 10, 30, 5, 0) => 55 (profit constraint only)
  // calculateMaxCPA(100, 10, 30, 5, -1) => 55 (profit constraint only)
  // calculateMaxCPA(100, 10, 30, 5, 4) => min(25, 55) = 25
}

export function calculateMonthlyProjection(
  units: number,
  netProfitPerUnit: number,
  sellingPrice: number,
  totalFeesPerUnit: number
): {
  units: number;
  gmv: number;
  totalFees: number;
  totalProfit: number;
  avgProfitPerUnit: number;
} {
  // Guard: units must be positive. If <= 0, return zeroed projection.
  if (units <= 0) {
    return {
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    };
  }

  return {
    units,
    gmv: roundToTwo(sellingPrice * units),
    totalFees: roundToTwo(totalFeesPerUnit * units),
    totalProfit: roundToTwo(netProfitPerUnit * units),
    avgProfitPerUnit: netProfitPerUnit,
  };

  // TEST COMMENT:
  // calculateMonthlyProjection(0, 10, 100, 20) => all zeros
  // calculateMonthlyProjection(-5, 10, 100, 20) => all zeros
  // calculateMonthlyProjection(100, 10, 100, 20) => { gmv: 10000, totalFees: 2000, totalProfit: 1000 }
}

export function sumFeeAmounts(fees: Array<{ amount: number }>): number {
  return roundToTwo(fees.reduce((sum, fee) => sum + fee.amount, 0));
}

export function getFeeByName(
  fees: Array<{ name: string; amount: number }>,
  name: string
): number | undefined {
  const fee = fees.find(f => f.name === name);
  return fee ? fee.amount : undefined;

  // TEST COMMENT:
  // getFeeByName([{name: 'Referral Fee', amount: 6}], 'Referral Fee') => 6
  // getFeeByName([{name: 'Referral Fee', amount: 6}], 'Unknown Fee') => undefined
  // Callers should use: getFeeByName(fees, 'Name') ?? 0
}