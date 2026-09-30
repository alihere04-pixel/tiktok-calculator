// RESULTS PANEL DATA CONTRACT
//
// `CalculationResult` (src/lib/calculation/types.ts) cannot be sent to the
// browser as-is, for two independent reasons:
//
//   1. It carries three functions (`targetProfitPrice`, `maxCPA`,
//      `monthlyProjection`), and functions are not serialisable across the
//      server/client boundary.
//   2. Everything under `@/lib/calculation` transitively imports
//      `@/lib/rates/loader`, which reads rate files from disk with `fs`. That
//      cannot run in a browser bundle at all.
//
// So the results panel never imports the calculation module. It receives a
// plain-data `ResultSnapshot` produced on the server by `runCalculation`, and
// re-asks the server whenever a reverse-calculator or projection input changes.
// This keeps a single implementation of the maths in `src/lib/calculation`.
//
// Types only. This module is imported by both the server action and client
// components, so it must stay free of runtime imports.

import type {
  CalculatorInputs,
  ConfidenceLevel,
  FeePricingState,
  MonthlyProjection,
} from '@/lib/calculation/types';

// Re-exported so client components can take a single dependency on this
// contract instead of reaching into the calculation module's types directly.
export type { CalculatorInputs, ConfidenceLevel, FeePricingState, MonthlyProjection };

/** One row of the fee breakdown table, flattened from the engine's fee item. */
export interface ResultFeeLine {
  name: string;
  /** Already display-ready, e.g. "6.0%", "RM 0.54", or a modelled-fee sentence. */
  rate: string;
  /** The amount the rate was applied to. */
  base: number;
  amount: number;
  /**
   * `unpriced` means no verified published rate existed for this fee. The line
   * is still shown, and still shows the band or reason, but its amount is
   * excluded from every total and the result is marked incomplete.
   */
  pricing: FeePricingState;
  sourceUrl: string;
  effectiveDate: string;
  lastVerified: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

/** Outputs of the engine's reverse-calculator closures, pre-evaluated. */
export interface ReverseValues {
  /** The target profit the user asked for, echoed back for labelling. */
  targetProfitInput: number;
  /** Minimum price that earns `targetProfitInput`, or 0 when unachievable. */
  targetProfitPrice: number;
  /**
   * Whether a price exists that earns `targetProfitInput`. The engine returns
   * this explicitly rather than using 0 as a sentinel, because 0 is a real price.
   */
  targetProfitAchievable: boolean;
  targetROAS: number;
  maxCPA: number;
}

export interface ProjectionValues extends MonthlyProjection {
  /** Echoed back so the input can be labelled after a re-run. */
  monthlyUnits: number;
}

export interface ResultSnapshot {
  /** ISO currency code from the market's rate file, e.g. "MYR". */
  currency: string;
  fees: ResultFeeLine[];
  /** Sum of priced fees only. Excludes unpriced fees entirely. */
  totalPlatformFees: number;
  /**
   * False when at least one fee could not be priced from a verified rate.
   *
   * Every derived figure below is then a lower bound on fees and an upper bound
   * on profit. The UI must label them as incomplete and name the missing fees.
   */
  complete: boolean;
  /** Names of the fees that could not be priced. */
  unpricedFees: string[];
  netProfit: number;
  /** Fraction of selling price, e.g. 0.25 for 25%. */
  profitMargin: number;
  /** Fraction of selling price. */
  effectiveTakeRate: number;
  contributionMargin: number;
  contributionMarginPct: number;
  breakEvenPrice: number;
  reverse: ReverseValues;
  projection: ProjectionValues;
  rateVersion: string;
  calculatedAt: string;
}

export interface CalculationRequest {
  inputs: CalculatorInputs;
  targetProfit: number;
  targetROAS: number;
  monthlyUnits: number;
}

export type CalculationOutcome =
  | { ok: true; snapshot: ResultSnapshot }
  | { ok: false; errors: string[] };
