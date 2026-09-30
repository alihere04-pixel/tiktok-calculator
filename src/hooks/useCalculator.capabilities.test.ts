import { describe, it, expect } from 'vitest';
import {
  MARKET_CAPABILITIES,
  createDefaultInputs,
  type MarketRateSummary,
} from './useCalculator';

const ALL_MARKETS = ['US', 'PH', 'SG', 'MY', 'UK'] as const;

function summary(
  market: MarketRateSummary['market'],
  tiers: Array<string | undefined>
): MarketRateSummary {
  return {
    market,
    currency: 'USD',
    categories: tiers.map((tier, i) => ({
      id: `${market.toLowerCase()}-cat-${i}`,
      name: `Category ${i}`,
      parentCategory: 'Group',
      tier,
      rate: 0.06,
    })),
  };
}

describe('MARKET_CAPABILITIES', () => {
  it('covers all 5 markets', () => {
    expect(Object.keys(MARKET_CAPABILITIES).sort()).toEqual([...ALL_MARKETS].sort());
  });

  it('exposes the return rate for the US only (US.ts is the only engine that reads it)', () => {
    expect(MARKET_CAPABILITIES.US.returnRate).toBe(true);
    expect(MARKET_CAPABILITIES.PH.returnRate).toBe(false);
    expect(MARKET_CAPABILITIES.SG.returnRate).toBe(false);
    expect(MARKET_CAPABILITIES.MY.returnRate).toBe(false);
    expect(MARKET_CAPABILITIES.UK.returnRate).toBe(false);
  });

  it('exposes new seller promo for US and UK only (UK.ts reads it too)', () => {
    expect(MARKET_CAPABILITIES.US.newSellerPromo).toBe(true);
    expect(MARKET_CAPABILITIES.UK.newSellerPromo).toBe(true);
    expect(MARKET_CAPABILITIES.PH.newSellerPromo).toBe(false);
    expect(MARKET_CAPABILITIES.SG.newSellerPromo).toBe(false);
    expect(MARKET_CAPABILITIES.MY.newSellerPromo).toBe(false);
  });

  it('exposes platform discount only where the engine reads it (not PH or MY)', () => {
    expect(MARKET_CAPABILITIES.US.platformDiscount).toBe(true);
    expect(MARKET_CAPABILITIES.SG.platformDiscount).toBe(true);
    expect(MARKET_CAPABILITIES.UK.platformDiscount).toBe(true);
    expect(MARKET_CAPABILITIES.PH.platformDiscount).toBe(false);
    expect(MARKET_CAPABILITIES.MY.platformDiscount).toBe(false);
  });

  it('exposes pre-order fees for PH, SG and MY only', () => {
    expect(MARKET_CAPABILITIES.PH.preOrder).toBe(true);
    expect(MARKET_CAPABILITIES.SG.preOrder).toBe(true);
    expect(MARKET_CAPABILITIES.MY.preOrder).toBe(true);
    expect(MARKET_CAPABILITIES.US.preOrder).toBe(false);
    expect(MARKET_CAPABILITIES.UK.preOrder).toBe(false);
  });

  it('exposes the shipping program for the Philippines only', () => {
    const withProgram = ALL_MARKETS.filter((m) => MARKET_CAPABILITIES[m].shippingProgram);
    expect(withProgram).toEqual(['PH']);
  });

  it('offers no fulfillment control for any market', () => {
    // F-15: no engine and no rate file read fulfillmentMethod, productWeightLb
    // or dimensionsIn. The US-only FBT controls were therefore inert UI that
    // implied the fee difference had been modelled, so the capability is off
    // everywhere rather than offered for a market that could not price it.
    const withFulfillment = ALL_MARKETS.filter((m) => MARKET_CAPABILITIES[m].fulfillment);
    expect(withFulfillment).toEqual([]);
  });

  it('disables GMV Max for every market in Phase 2 (no engine reads isGMVMaxActive)', () => {
    for (const market of ALL_MARKETS) {
      expect(MARKET_CAPABILITIES[market].gmvMax).toBe(false);
    }
  });

  it('never offers an empty section: every market has at least one extra capability', () => {
    for (const market of ALL_MARKETS) {
      const caps = MARKET_CAPABILITIES[market];
      const anyExtra =
        caps.platformDiscount ||
        caps.returnRate ||
        caps.newSellerPromo ||
        caps.preOrder ||
        caps.shippingProgram ||
        caps.fulfillment ||
        caps.gmvMax;
      expect(anyExtra).toBe(true);
    }
  });

  it('has no market left with only the always-on inputs', () => {
    // Section E, F and G each need at least one market where they show a
    // control, otherwise a section would be permanently dead.
    const promo = ALL_MARKETS.filter((m) => MARKET_CAPABILITIES[m].newSellerPromo);
    const programs = ALL_MARKETS.filter(
      (m) => MARKET_CAPABILITIES[m].preOrder || MARKET_CAPABILITIES[m].shippingProgram
    );
    expect(promo.length).toBeGreaterThan(0);
    expect(programs.length).toBeGreaterThan(0);
  });
});

describe('createDefaultInputs', () => {
  it('defaults the return rate to the PRD value of 5', () => {
    expect(createDefaultInputs().returnRate).toBe(5);
  });

  it('starts every numeric cost at zero', () => {
    const inputs = createDefaultInputs();
    expect(inputs.sellingPrice).toBe(0);
    expect(inputs.sellerDiscount).toBe(0);
    expect(inputs.platformDiscount).toBe(0);
    expect(inputs.customerShipping).toBe(0);
    expect(inputs.cogs).toBe(0);
    expect(inputs.outboundShipping).toBe(0);
    expect(inputs.cpa).toBe(0);
    expect(inputs.affiliateRate).toBe(0);
    expect(inputs.promoDaysRemaining).toBe(0);
  });

  it('starts every optional toggle off', () => {
    const inputs = createDefaultInputs();
    expect(inputs.newSellerPromo).toBe(false);
    expect(inputs.isPreOrder).toBe(false);
    expect(inputs.isShippingProgramEnrolled).toBe(false);
    expect(inputs.isGMVMaxActive).toBe(false);
  });

  it('carries no FBT state, because no engine reads any', () => {
    // F-15: these three inputs were collected by the form but read by no engine
    // and by no rate file, so they were removed rather than left as dead state
    // that every caller had to supply.
    const inputs = createDefaultInputs() as unknown as Record<string, unknown>;
    expect(inputs.productWeightLb).toBeUndefined();
    expect(inputs.dimensionsIn).toBeUndefined();
    expect(inputs.fulfillmentMethod).toBeUndefined();
  });

  it('is independent per call, so switching market cannot leak state', () => {
    const first = createDefaultInputs('MY');
    first.sellingPrice = 999;
    expect(createDefaultInputs('US').sellingPrice).toBe(0);
  });
});

describe('section data requirements', () => {
  it('the tier helper still reports >1 tier markets as tiered', () => {
    // Guards the Step 7 decision against regression: SG and MY have 4 tiers,
    // US and UK have none, PH has exactly one.
    expect(MARKET_CAPABILITIES.SG.preOrder).toBe(true);
    expect(summary('SG', ['Standard', 'BXP', 'BXP Mixed', 'BXP Restricted']).categories).toHaveLength(4);
  });
});
