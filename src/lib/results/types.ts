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

import type { CalculatorInputs, ConfidenceLevel, MonthlyProjection } from '@/lib/calculation/types';

// Re-exported so client components can take a single dependency on this
// contract instead of reaching into the calculation module's types directly.
export type { CalculatorInputs, ConfidenceLevel, MonthlyProjection };

/** One row of the fee breakdown table, flattened from the engine's fee item. */
export interface ResultFeeLine {
  name: string;
  /** Already display-ready, e.g. "6.0%", "RM 0.54", or a modelled-fee sentence. */
  rate: string;
  /** The amount the rate was applied to. */
  base: number;
  amount: number;
  sourceUrl: string;
  effectiveDate: string;
  lastVerified: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

/** Outputs of the engine's three reverse-calculator closures, pre-evaluated. */
export interface ReverseValues {
  /** The target profit the user asked for, echoed back for labelling. */
  targetProfitInput: number;
  /** Minimum price that earns `targetProfitInput`. 0 when unachievable. */
  targetProfitPrice: number;
  /**
   * `calculateTargetPrice` returns 0 as its "no solution within 100x" sentinel.
   * The panel needs to say so explicitly rather than print a $0.00 price.
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
  totalPlatformFees: number;
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
