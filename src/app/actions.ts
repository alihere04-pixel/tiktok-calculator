'use server';

// SERVER-SIDE CALCULATION ENTRY POINT FOR THE RESULTS PANEL
//
// The results panel is client-side, but `@/lib/calculation` cannot be imported
// into a browser bundle: `calculateProfit` -> `@/lib/calculation/index` ->
// `@/lib/rates/loader` -> `fs`. This action is the boundary. It calls the
// existing, unmodified engine and returns plain data.
//
// It also flattens `CalculationResult`'s three closures
// (`targetProfitPrice`, `maxCPA`, `monthlyProjection`) into numbers, because
// functions cannot cross the server/client boundary. Those three values depend
// on inputs the results panel collects *after* the initial calculation, so the
// panel re-invokes this action when they change rather than reimplementing the
// maths on the client.
//
// Only the async function below is exported: a 'use server' module may not
// export anything else.

import { calculateProfit, validateInputs } from '@/lib/calculation';
import { loadMarketRatesSync, preloadAllRates } from '@/lib/rates/loader';
import { DEFAULT_MONTHLY_UNITS, DEFAULT_TARGET_PROFIT, DEFAULT_TARGET_ROAS } from '@/lib/results/defaults';
import type { CalculationOutcome, CalculationRequest, ResultSnapshot } from '@/lib/results/types';

function safeNumber(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, value);
}

export async function runCalculation(request: CalculationRequest): Promise<CalculationOutcome> {
  await preloadAllRates();

  const inputs = request?.inputs;

  // `validateInputs` handles a missing inputs object on its own and returns a
  // per-field message list, which the panel renders as its error state.
  const validation = validateInputs(inputs);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  // Coerce the panel's own inputs before they reach the engine. `Math.max(0, x)`
  // keeps a negative value from inverting a bisection bound, and the fallback
  // covers a cleared or non-numeric field.
  const targetProfit = safeNumber(request.targetProfit, DEFAULT_TARGET_PROFIT, 0);
  const targetROAS = safeNumber(request.targetROAS, DEFAULT_TARGET_ROAS, 0);
  const monthlyUnits = safeNumber(request.monthlyUnits, DEFAULT_MONTHLY_UNITS, 0);

  try {
    const result = calculateProfit(inputs);

    // `calculateProfit` validates internally too and returns a zeroed result
    // tagged 'invalid-inputs' rather than throwing. Narrow it away so a future
    // engine change can never surface a fake $0.00 profit as a real answer.
    if ('errors' in result && Array.isArray(result.errors) && result.errors.length > 0) {
      return { ok: false, errors: result.errors };
    }

    const target = result.targetProfitPrice(targetProfit);

    const snapshot: ResultSnapshot = {
      currency: loadMarketRatesSync(inputs.market).currency,
      fees: result.fees.map((fee) => ({
        name: fee.name,
        rate: fee.rate,
        base: fee.base,
        amount: fee.amount,
        // An omitted state means unpriced, never priced: the client must not be
        // able to read a missing field as a verified rate.
        pricing: fee.pricing ?? 'unpriced',
        sourceUrl: fee.sourceUrl,
        effectiveDate: fee.effectiveDate,
        lastVerified: fee.lastVerified,
        confidence: fee.confidence,
        notes: fee.notes,
      })),
      totalPlatformFees: result.totalPlatformFees,
      complete: result.complete,
      unpricedFees: result.unpricedFees,
      netProfit: result.netProfit,
      profitMargin: result.profitMargin,
      effectiveTakeRate: result.effectiveTakeRate,
      contributionMargin: result.contributionMargin,
      contributionMarginPct: result.contributionMarginPct,
      breakEvenPrice: result.breakEvenPrice,
      reverse: {
        targetProfitInput: targetProfit,
        targetProfitPrice: target.price,
        targetProfitAchievable: target.achievable,
        targetROAS,
        maxCPA: result.maxCPA(targetROAS),
      },
      projection: {
        ...result.monthlyProjection(monthlyUnits),
        monthlyUnits,
      },
      rateVersion: result.rateVersion,
      calculatedAt: result.calculatedAt,
    };

    return { ok: true, snapshot };
  } catch (error) {
    // A missing or malformed rate file throws from the loader. Surface it as a
    // validation-style error state rather than an unhandled server error.
    console.error('runCalculation failed', error);
    return {
      ok: false,
      errors: [
        'Could not calculate: the rate data for this market could not be loaded. Please try again.',
      ],
    };
  }
}
