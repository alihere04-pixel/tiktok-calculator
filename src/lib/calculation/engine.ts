// CALCULATION ENGINE
//
// Pure fee and pricing maths. Market-specific rate selection lives in
// `markets/*.ts`; this module only knows how to combine a priced fee list.

import { roundToTwo, roundToFour } from './utils';
import type { FeePricingState, FeeBreakdownItem, TargetPriceResult } from './types';

/**
 * Whether a fee was charged from a verified published rate.
 *
 * The predicate is the inverse of the failure it guards against: a fee counts
 * as priced only when it says so. Treating a missing or unexpected value as
 * priced would let an unverified fee into a total, which is the F-04 defect.
 */
function isPriced(fee: { pricing: FeePricingState }): boolean {
  return fee.pricing === 'priced';
}

/** Names of fees that could not be priced from a verified published rate. */
export function unpricedFeeNames(fees: ReadonlyArray<Pick<FeeBreakdownItem, 'name' | 'pricing'>>): string[] {
  return fees.filter((fee) => !isPriced(fee)).map((fee) => fee.name);
}

/** Whether every fee in the list could be priced. */
export function isCalculationComplete(
  fees: ReadonlyArray<Pick<FeeBreakdownItem, 'pricing'>>
): boolean {
  return fees.every((fee) => isPriced(fee));
}

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
): TargetPriceResult {
  const fixedCosts = cogs + shipping + cpa;

  // A target of zero, or a negative one, is the break-even question, and
  // break-even is not the sum of the fixed costs: the fees at that price still
  // have to be covered. It is answered by the same search rather than
  // short-circuited, so a zero target cannot silently ignore fees.
  //
  // Search bounds. `low` is a price at which the target is provably unmet
  // (fixed costs plus the target, before any fees are charged), so the true
  // answer is at or above it. `high` is 100x that floor: any fee structure that
  // still returns to profit within that range is reachable, and anything beyond
  // it is a target no realistic listing can serve.
  const low0 = fixedCosts + targetProfit;
  const MAX_PRICE_MULTIPLIER = 100;

  let low = Math.max(0, low0);
  let high = Math.max(low0, 0) * MAX_PRICE_MULTIPLIER;

  // A flat zero-width interval means there is no price to search between, which
  // happens when fees are zero and the floor is already the answer.
  if (high <= low) {
    return { price: roundToTwo(low), achievable: true };
  }

  let solutionFound = false;

  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    const profit = mid - feeCalculator(mid) - fixedCosts;

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

  // Unachievable is reported explicitly rather than as a 0 price, because 0 is
  // a real price a caller could mistake for a result.
  if (!solutionFound) {
    return { price: 0, achievable: false };
  }

  return { price: roundToTwo((low + high) / 2), achievable: true };
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

/**
 * Sums the fees that could actually be priced.
 *
 * Unpriced fees are excluded rather than added as 0. Their amounts are already
 * 0, so the arithmetic is unchanged today, but excluding them here is what keeps
 * the total honest if a caller ever reports a non-zero amount on an unpriced
 * line. `isCalculationComplete` is what tells the caller the total is partial.
 */
export function sumFeeAmounts(
  fees: ReadonlyArray<Pick<FeeBreakdownItem, 'amount' | 'pricing'>>
): number {
  return roundToTwo(
    fees.reduce((sum, fee) => (isPriced(fee) ? sum + fee.amount : sum), 0)
  );
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