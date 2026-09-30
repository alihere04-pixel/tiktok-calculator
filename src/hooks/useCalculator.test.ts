import { describe, it, expect } from 'vitest';
import {
  createDefaultInputs,
  hasSellerTierChoice,
  availableSellerTiers,
  marketLabel,
  type MarketRateSummary,
} from './useCalculator';

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
      confidence: 'high',
    })),
  };
}

describe('hasSellerTierChoice', () => {
  it('is false for markets with no tiers (US, UK)', () => {
    expect(hasSellerTierChoice(summary('US', [undefined, undefined, undefined]))).toBe(false);
    expect(hasSellerTierChoice(summary('UK', [undefined]))).toBe(false);
  });

  it('is false when only one distinct tier exists (PH)', () => {
    // A single-option selector would offer no choice, so it is hidden.
    expect(hasSellerTierChoice(summary('PH', ['Marketplace', 'Marketplace', 'Marketplace']))).toBe(false);
  });

  it('is true when more than one distinct tier exists (SG, MY)', () => {
    expect(hasSellerTierChoice(summary('SG', ['Standard', 'BXP', 'BXP Mixed']))).toBe(true);
    expect(hasSellerTierChoice(summary('MY', ['BXP Marketplace', 'Non-BXP Marketplace']))).toBe(true);
  });

  it('is false for missing or null rate data', () => {
    expect(hasSellerTierChoice(null)).toBe(false);
    expect(hasSellerTierChoice(undefined)).toBe(false);
  });
});

describe('availableSellerTiers', () => {
  it('returns canonical tokens in selector order, deduplicated', () => {
    // F-01/F-03: the hook used to hand the engine the raw rate-file label
    // ("BXP Marketplace"), which the engine then compared against a lowercase
    // token and never matched. It now returns canonical tokens, and the label
    // is applied only for display.
    const tiers = availableSellerTiers(
      summary('MY', ['BXP Marketplace', 'BXP Mall', 'BXP Marketplace', 'Non-BXP Mall'])
    );
    expect(tiers).toEqual(['bxp-marketplace', 'bxp-mall', 'non-bxp-mall']);
  });

  it('orders tiers by the canonical selector order, not file order', () => {
    const tiers = availableSellerTiers(
      summary('MY', ['Non-BXP Mall', 'BXP Marketplace', 'Non-BXP Marketplace', 'BXP Mall'])
    );
    expect(tiers).toEqual([
      'bxp-marketplace',
      'bxp-mall',
      'non-bxp-marketplace',
      'non-bxp-mall',
    ]);
  });

  it('returns an empty list when there are no tiers', () => {
    expect(availableSellerTiers(summary('US', [undefined]))).toEqual([]);
    expect(availableSellerTiers(null)).toEqual([]);
  });
});

describe('createDefaultInputs', () => {
  it('starts at US with a zeroed numeric baseline', () => {
    const inputs = createDefaultInputs();
    expect(inputs.market).toBe('US');
    expect(inputs.sellingPrice).toBe(0);
    expect(inputs.categoryId).toBe('');
    expect(inputs.sellerTier).toBeNull();
    expect(inputs.affiliateMode).toBe('none');
    // PRD Section 3.1 default, asserted here because it is not zero.
    expect(inputs.returnRate).toBe(5);
  });

  it('honours the requested initial market', () => {
    expect(createDefaultInputs('MY').market).toBe('MY');
  });
});

describe('marketLabel', () => {
  it('returns a human label for all 5 markets', () => {
    expect(marketLabel('US')).toBe('United States');
    expect(marketLabel('PH')).toBe('Philippines');
    expect(marketLabel('SG')).toBe('Singapore');
    expect(marketLabel('MY')).toBe('Malaysia');
    expect(marketLabel('UK')).toBe('United Kingdom');
  });
});
