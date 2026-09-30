import { describe, it, expect } from 'vitest';
import { runCalculation } from './actions';
import { calculateProfit, validateInputs } from '@/lib/calculation';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { DEFAULT_MONTHLY_UNITS, DEFAULT_TARGET_PROFIT, DEFAULT_TARGET_ROAS } from '@/lib/results/defaults';
import { makeInputs } from '@/test/snapshot-fixture';

const DEFAULTS = {
  targetProfit: DEFAULT_TARGET_PROFIT,
  targetROAS: DEFAULT_TARGET_ROAS,
  monthlyUnits: DEFAULT_MONTHLY_UNITS,
};

function usInputs() {
  const rates = loadMarketRatesSync('US');
  return makeInputs({ market: 'US', categoryId: rates.categories[0].id, sellingPrice: 100, cogs: 30, outboundShipping: 5 });
}

describe('runCalculation', () => {
  it('returns a snapshot that matches the engine exactly', async () => {
    // This is the guarantee that the panel does not reimplement any maths: the
    // action is a transport, so its numbers must be the engine's own.
    const inputs = usInputs();
    const outcome = await runCalculation({ inputs, ...DEFAULTS });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const direct = calculateProfit(inputs);
    expect(outcome.snapshot.netProfit).toBe(direct.netProfit);
    expect(outcome.snapshot.totalPlatformFees).toBe(direct.totalPlatformFees);
    expect(outcome.snapshot.profitMargin).toBe(direct.profitMargin);
    expect(outcome.snapshot.effectiveTakeRate).toBe(direct.effectiveTakeRate);
    expect(outcome.snapshot.breakEvenPrice).toBe(direct.breakEvenPrice);
    expect(outcome.snapshot.contributionMargin).toBe(direct.contributionMargin);
    expect(outcome.snapshot.fees).toEqual(direct.fees);
    expect(outcome.snapshot.rateVersion).toBe(direct.rateVersion);
  });

  it('pre-evaluates the three reverse closures into plain numbers', async () => {
    const inputs = usInputs();
    const outcome = await runCalculation({ inputs, ...DEFAULTS });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const direct = calculateProfit(inputs);
    // F-11: achievability is serialised alongside the price, so the client can
    // tell a real quote from an unreachable target.
    expect(outcome.snapshot.reverse.targetProfitPrice).toBe(
      direct.targetProfitPrice(DEFAULTS.targetProfit).price
    );
    expect(outcome.snapshot.reverse.targetProfitAchievable).toBe(
      direct.targetProfitPrice(DEFAULTS.targetProfit).achievable
    );
    expect(outcome.snapshot.reverse.maxCPA).toBe(direct.maxCPA(DEFAULTS.targetROAS));
    // The panel's projection is the engine's projection plus the echoed input,
    // so each engine-owned field is compared on its own.
    const engineProjection = direct.monthlyProjection(DEFAULTS.monthlyUnits);
    expect(outcome.snapshot.projection.units).toBe(engineProjection.units);
    expect(outcome.snapshot.projection.gmv).toBe(engineProjection.gmv);
    expect(outcome.snapshot.projection.totalFees).toBe(engineProjection.totalFees);
    expect(outcome.snapshot.projection.totalProfit).toBe(engineProjection.totalProfit);
    expect(outcome.snapshot.projection.avgProfitPerUnit).toBe(engineProjection.avgProfitPerUnit);
  });

  it('carries only serialisable data', async () => {
    const outcome = await runCalculation({ inputs: usInputs(), ...DEFAULTS });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Structured-clone check: functions would throw here. The result crosses a
    // server/client boundary, so this is worth asserting explicitly.
    expect(() => structuredClone(outcome.snapshot)).not.toThrow();
    expect(typeof outcome.snapshot).toBe('object');
  });

  it('reads the currency from the market rate file', async () => {
    const us = await runCalculation({ inputs: usInputs(), ...DEFAULTS });
    expect(us.ok && us.snapshot.currency).toBe('USD');

    const phRates = loadMarketRatesSync('PH');
    const ph = await runCalculation({
      inputs: makeInputs({
        market: 'PH',
        categoryId: phRates.categories[0].id,
        sellingPrice: 500,
        cogs: 200,
        outboundShipping: 50,
        returnRate: 0,
      }),
      ...DEFAULTS,
    });
    expect(ph.ok && ph.snapshot.currency).toBe('PHP');
  });

  it('rejects invalid inputs with the engine validation messages', async () => {
    const outcome = await runCalculation({
      inputs: makeInputs({ sellingPrice: 0, categoryId: '' }),
      ...DEFAULTS,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors).toEqual(validateInputs(makeInputs({ sellingPrice: 0, categoryId: '' })).errors);
    expect(outcome.errors.some((e) => e.includes('sellingPrice'))).toBe(true);
    expect(outcome.errors.some((e) => e.includes('categoryId'))).toBe(true);
  });

  it('survives a completely missing inputs object', async () => {
    const outcome = await runCalculation({
      inputs: undefined as never,
      ...DEFAULTS,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.length).toBeGreaterThan(0);
  });

  it('falls back to defaults for non-finite panel inputs', async () => {
    const outcome = await runCalculation({
      inputs: usInputs(),
      targetProfit: Number.NaN,
      targetROAS: Number.NaN,
      monthlyUnits: Number.NaN,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.reverse.targetProfitInput).toBe(DEFAULT_TARGET_PROFIT);
    expect(outcome.snapshot.reverse.targetROAS).toBe(DEFAULT_TARGET_ROAS);
    expect(outcome.snapshot.projection.monthlyUnits).toBe(DEFAULT_MONTHLY_UNITS);
  });

  it('clamps negative panel inputs to zero instead of inverting a bound', async () => {
    const outcome = await runCalculation({
      inputs: usInputs(),
      targetProfit: -50,
      targetROAS: DEFAULT_TARGET_ROAS,
      monthlyUnits: -10,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.reverse.targetProfitInput).toBe(0);
    expect(outcome.snapshot.projection.gmv).toBe(0);
    expect(outcome.snapshot.projection.totalProfit).toBe(0);
    expect(outcome.snapshot.projection.units).toBe(0);
  });

  it('reports a target profit price as achievable for a normal target', async () => {
    const outcome = await runCalculation({ inputs: usInputs(), ...DEFAULTS });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.reverse.targetProfitAchievable).toBe(true);
    expect(outcome.snapshot.reverse.targetProfitPrice).toBeGreaterThan(0);
  });

  it('zeroes the projection when monthly units are zero', async () => {
    const outcome = await runCalculation({ inputs: usInputs(), ...DEFAULTS, monthlyUnits: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.projection).toEqual({
      monthlyUnits: 0,
      units: 0,
      gmv: 0,
      totalFees: 0,
      totalProfit: 0,
      avgProfitPerUnit: 0,
    });
  });
});
