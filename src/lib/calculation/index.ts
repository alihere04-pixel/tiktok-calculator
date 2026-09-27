// INTEGRATION LAYER
// Single entry point the UI will call. Dispatches to the market engine selected
// by inputs.market, then combines that engine's fee breakdown with the reverse
// calculators from engine.ts. Market engines are not modified or duplicated here.

import type {
  CalculatorInputs,
  CalculationResult,
  FeeBreakdownItem,
  Market,
  MonthlyProjection,
} from './types';
import type { MarketRateData } from '@/lib/rates/schema';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import {
  calculateBreakEvenPrice,
  calculateContributionMargin,
  calculateContributionMarginPct,
  calculateEffectiveRate,
  calculateMaxCPA,
  calculateMonthlyProjection,
  calculateProfitMargin,
  calculateTargetPrice,
  sumFeeAmounts,
} from './engine';
import { roundToTwo } from './utils';
import { calculateUSFeesSync } from './markets/US';
import { calculatePHFeesSync } from './markets/PH';
import { calculateSGFeesSync } from './markets/SG';
import { calculateMYFeesSync } from './markets/MY';
import { calculateUKFeesSync } from './markets/UK';

export type { CalculatorInputs, CalculationResult, Market, MonthlyProjection };

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CalculationErrorResult extends CalculationResult {
  errors: string[];
}

// The 5 markets with a working engine, in the order the UI should present them.
const MARKET_ORDER: Market[] = ['US', 'PH', 'SG', 'MY', 'UK'];

type SyncFeeCalculator = (inputs: CalculatorInputs, rates: MarketRateData) => FeeBreakdownItem[];

const ENGINES: Record<Market, SyncFeeCalculator> = {
  US: calculateUSFeesSync,
  PH: calculatePHFeesSync,
  SG: calculateSGFeesSync,
  MY: calculateMYFeesSync,
  UK: calculateUKFeesSync,
};

// Per-order fees must be excluded from contribution margin, which is defined on
// variable fees only. Currently the only flat per-order fee across all 5
// markets is MY's RM 0.54 Platform Support Fee.
const PER_ORDER_FEES = ['Platform Support Fee'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getAvailableMarkets(): Market[] {
  return [...MARKET_ORDER];
}

function pushError(errors: string[], message: string): void {
  if (!errors.includes(message)) errors.push(message);
}

export function validateInputs(inputs: CalculatorInputs): ValidationResult {
  const errors: string[] = [];

  if (!inputs || typeof inputs !== 'object') {
    return { valid: false, errors: ['inputs is required'] };
  }

  if (!ENGINES[inputs.market]) {
    pushError(errors, `Unknown market '${String(inputs.market)}'. Expected one of: ${MARKET_ORDER.join(', ')}`);
  }

  if (typeof inputs.categoryId !== 'string' || inputs.categoryId.trim() === '') {
    pushError(errors, 'categoryId is required and must be a non-empty string');
  }

  if (!isFiniteNumber(inputs.sellingPrice)) {
    pushError(errors, 'sellingPrice is required and must be a finite number');
  } else if (inputs.sellingPrice <= 0) {
    pushError(errors, 'sellingPrice must be greater than 0');
  }

  for (const field of [
    'sellerDiscount',
    'platformDiscount',
    'customerShipping',
    'cogs',
    'outboundShipping',
    'cpa',
  ] as const) {
    if (!isFiniteNumber(inputs[field])) {
      pushError(errors, `${field} is required and must be a finite number`);
    }
  }

  for (const field of ['sellerDiscount', 'platformDiscount', 'cogs', 'outboundShipping'] as const) {
    if (isFiniteNumber(inputs[field]) && inputs[field] < 0) {
      pushError(errors, `${field} cannot be negative`);
    }
  }

  if (isFiniteNumber(inputs.customerShipping) && inputs.customerShipping < 0) {
    pushError(errors, 'customerShipping cannot be negative');
  }

  if (isFiniteNumber(inputs.cpa) && inputs.cpa < 0) {
    pushError(errors, 'cpa cannot be negative');
  }

  if (!isFiniteNumber(inputs.returnRate)) {
    pushError(errors, 'returnRate is required and must be a finite number');
  } else if (inputs.returnRate < 0 || inputs.returnRate > 100) {
    pushError(errors, 'returnRate must be between 0 and 100');
  }

  if (isFiniteNumber(inputs.sellingPrice) && isFiniteNumber(inputs.sellerDiscount)) {
    if (inputs.sellerDiscount > inputs.sellingPrice) {
      pushError(errors, 'sellerDiscount cannot exceed sellingPrice');
    }
  }

  return { valid: errors.length === 0, errors };
}

function createErrorResult(inputs: CalculatorInputs, errors: string[]): CalculationErrorResult {
  return {
    inputs,
    fees: [],
    totalPlatformFees: 0,
    netProfit: 0,
    profitMargin: 0,
    effectiveTakeRate: 0,
    contributionMargin: 0,
    contributionMarginPct: 0,
    breakEvenPrice: 0,
    targetProfitPrice: () => 0,
    maxCPA: () => 0,
    monthlyProjection: () => ({
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    }),
    calculatedAt: new Date().toISOString(),
    rateVersion: 'invalid-inputs',
    errors,
  };
}

function buildRateVersion(market: Market, rates: MarketRateData): string {
  return `${market}-${rates.lastVerified}`;
}

function sumVariableFees(fees: Array<{ name: string; amount: number }>): number {
  return roundToTwo(
    fees.reduce((sum, fee) => (PER_ORDER_FEES.includes(fee.name) ? sum : sum + fee.amount), 0)
  );
}

export function calculateProfit(inputs: CalculatorInputs): CalculationResult {
  const validation = validateInputs(inputs);
  if (!validation.valid) {
    return createErrorResult(inputs, validation.errors);
  }

  const market = inputs.market;
  const engine = ENGINES[market];
  const rates = loadMarketRatesSync(market);

  const fees = engine(inputs, rates);
  const totalPlatformFees = sumFeeAmounts(fees);
  const variableFees = sumVariableFees(fees);

  const netProfit = roundToTwo(
    inputs.sellingPrice - totalPlatformFees - inputs.cogs - inputs.outboundShipping - inputs.cpa
  );

  const contributionMargin = calculateContributionMargin(
    inputs.sellingPrice,
    variableFees,
    inputs.cogs,
    inputs.outboundShipping
  );

  // Reverse calculators re-invoke the market engine at other prices. No
  // per-order special-casing is needed here: every engine derives flat per-order
  // fees from a price-independent constant, so the engine already returns the
  // correct total fee at whatever price it is given.
  const feeCalculator = (price: number): number =>
    sumFeeAmounts(engine({ ...inputs, sellingPrice: price }, rates));

  const breakEvenPrice = calculateBreakEvenPrice(
    inputs.cogs,
    inputs.outboundShipping,
    inputs.cpa,
    feeCalculator
  );

  const targetProfitPrice = (target: number): number =>
    calculateTargetPrice(target, inputs.cogs, inputs.outboundShipping, inputs.cpa, feeCalculator);

  const maxCPA = (targetROAS: number): number =>
    calculateMaxCPA(
      inputs.sellingPrice,
      totalPlatformFees,
      inputs.cogs,
      inputs.outboundShipping,
      targetROAS
    );

  const monthlyProjection = (units: number): MonthlyProjection =>
    calculateMonthlyProjection(units, netProfit, inputs.sellingPrice, totalPlatformFees);

  return {
    inputs,
    fees,
    totalPlatformFees,
    netProfit,
    profitMargin: calculateProfitMargin(netProfit, inputs.sellingPrice),
    effectiveTakeRate: calculateEffectiveRate(totalPlatformFees, inputs.sellingPrice),
    contributionMargin,
    contributionMarginPct: calculateContributionMarginPct(contributionMargin, inputs.sellingPrice),
    breakEvenPrice,
    targetProfitPrice,
    maxCPA,
    monthlyProjection,
    calculatedAt: new Date().toISOString(),
    rateVersion: buildRateVersion(market, rates),
  };
}
