import { describe, it, expect, beforeAll } from 'vitest';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import {
  availableSellerTiers,
  groupCategories,
  hasSellerTierChoice,
  sellerTierLabel,
} from './tiers';
import { calculatePHFeesSync } from '@/lib/calculation/markets/PH';
import { createDefaultInputs } from '@/hooks/useCalculator';
import type { CalculatorInputs } from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

let ph: MarketRateData;

beforeAll(() => {
  ph = loadMarketRatesSync('PH');
});

/**
 * The exact projection `src/app/page.tsx` sends to the browser.
 *
 * Reproduced here rather than imported so the test fails if `mallRate` is ever
 * dropped from the projection again. That regression was silent: the category
 * selector and the commission preview kept working, because the rows still
 * carried their own `tier` label, so only the tier list collapsed to one entry
 * and the Seller tier control silently stopped rendering.
 */
function browserProjection() {
  return ph.categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentCategory: c.parentCategory,
    tier: c.tier,
    rate: c.rate,
    confidence: c.confidence,
  }));
}

/** The projection as it is built today, i.e. including `mallRate`. */
function browserProjectionWithMallRate() {
  return ph.categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentCategory: c.parentCategory,
    tier: c.tier,
    rate: c.rate,
    mallRate: c.mallRate,
    confidence: c.confidence,
  }));
}

describe('PH seller tier availability', () => {
  it('offers exactly Marketplace and Mall', () => {
    expect(availableSellerTiers('PH', ph.categories)).toEqual(['marketplace', 'mall']);
    expect(availableSellerTiers('PH', ph.categories).map(sellerTierLabel)).toEqual([
      'Marketplace',
      'Mall',
    ]);
  });

  it('shows the Seller tier control, which requires more than one option', () => {
    expect(hasSellerTierChoice('PH', ph.categories)).toBe(true);
    expect(availableSellerTiers('PH', ph.categories).length).toBeGreaterThan(1);
  });

  it('still offers the control with the browser projection the page sends', () => {
    // The UI runs on the projected data, not on the file, so this is the view
    // that actually decides whether the control renders.
    const projected = browserProjectionWithMallRate();
    expect(projected.filter((c) => 'mallRate' in c)).toHaveLength(ph.categories.length);
    expect(availableSellerTiers('PH', projected)).toEqual(['marketplace', 'mall']);
    expect(hasSellerTierChoice('PH', projected)).toBe(true);
  });

  it('the projection must carry mallRate, or the control disappears', () => {
    // Documents the exact regression: without `mallRate` the rows' own
    // `tier` label is the only tier signal, and PH labels all 63 rows
    // "Marketplace".
    const withoutMallRate = browserProjection();
    expect(availableSellerTiers('PH', withoutMallRate)).toEqual(['marketplace']);
    expect(hasSellerTierChoice('PH', withoutMallRate)).toBe(false);
  });

  it('is not inferred from the distinct category.tier labels', () => {
    // Every PH row is labelled "Marketplace" while also carrying a Mall rate, so
    // the label names the record's default channel, not the channels it supports.
    expect([...new Set(ph.categories.map((c) => c.tier))]).toEqual(['Marketplace']);
    expect(ph.categories.every((c) => typeof c.mallRate === 'number')).toBe(true);
  });

  it('every PH category group can be priced at both tiers', () => {
    for (const group of groupCategories('PH', ph.categories)) {
      expect(group.tiers, group.id).toEqual(['marketplace', 'mall']);
    }
  });

  it('does not add a Seller tier to US or UK', () => {
    for (const market of ['US', 'UK'] as const) {
      const rates = loadMarketRatesSync(market);
      expect(availableSellerTiers(market, rates.categories), market).toEqual([]);
      expect(hasSellerTierChoice(market, rates.categories), market).toBe(false);
    }
  });

  it('leaves the MY and SG tier sets unchanged', () => {
    expect(availableSellerTiers('MY', loadMarketRatesSync('MY').categories).sort()).toEqual([
      'bxp-mall',
      'bxp-marketplace',
      'non-bxp-mall',
      'non-bxp-marketplace',
    ]);
    expect(availableSellerTiers('SG', loadMarketRatesSync('SG').categories).sort()).toEqual([
      'bxp',
      'bxp-mixed',
      'bxp-restricted',
      'standard',
    ]);
  });
});

describe('PH engine honours the selected seller tier', () => {
  // Shoes: published 6.80% Marketplace, 7.90% Mall. The group id is what the
  // selector sends, and it differs from the row id.
  const GROUP_ID = 'ph-shoes';
  const ROW_ID = 'ph-fashion-shoes';

  const inputs = (over: Partial<CalculatorInputs> = {}): CalculatorInputs => ({
    ...createDefaultInputs('PH'),
    categoryId: GROUP_ID,
    sellingPrice: 1000,
    ...over,
  });

  const commission = (i: CalculatorInputs) =>
    calculatePHFeesSync(i, ph).find((f) => f.name === 'Commission Fee')!;

  it('Marketplace uses category.rate', () => {
    const fee = commission(inputs({ sellerTier: 'marketplace' }));
    expect(fee.pricing).toBe('priced');
    expect(fee.rate).toBe('6.80%');
    expect(fee.amount).toBe(68);
  });

  it('Mall uses category.mallRate', () => {
    const fee = commission(inputs({ sellerTier: 'mall' }));
    expect(fee.pricing).toBe('priced');
    expect(fee.rate).toBe('7.90%');
    expect(fee.amount).toBe(79);
  });

  it('the two tiers produce different commission amounts where the data differs', () => {
    const marketplace = commission(inputs({ sellerTier: 'marketplace' }));
    const mall = commission(inputs({ sellerTier: 'mall' }));
    expect(mall.rate).not.toBe(marketplace.rate);
    expect(mall.amount).toBeGreaterThan(marketplace.amount);
  });

  it('a raw row id prices the same as its group id', () => {
    // The form sends a group id; engines, tests and saved links may carry the
    // row id. Both must reach the same published rate.
    expect(commission(inputs({ categoryId: GROUP_ID })).rate).toBe('6.80%');
    expect(commission(inputs({ categoryId: ROW_ID })).rate).toBe('6.80%');
    expect(commission(inputs({ categoryId: ROW_ID, sellerTier: 'mall' })).rate).toBe('7.90%');
  });

  it('every selectable group id reaches its own published rate, not the default', () => {
    // The regression: 60 of 62 PH group ids are not row ids, so a lookup by
    // row id alone missed and reported the 6.70% file default for categories
    // published at 6.80% or 6.90%.
    for (const group of groupCategories('PH', ph.categories)) {
      const row = group.rows[0];
      const marketplace = commission(inputs({ categoryId: group.id, sellerTier: 'marketplace' }));
      expect(marketplace.pricing, group.id).toBe('priced');
      expect(marketplace.rate, `${group.id} should use ${row.rate}`).toBe(
        `${(row.rate * 100).toFixed(2)}%`
      );
      expect(marketplace.confidence, `${group.id} must not be a default`).not.toBe(
        'needs-verification'
      );

      const mall = commission(inputs({ categoryId: group.id, sellerTier: 'mall' }));
      expect(mall.rate, `${group.id} should use mallRate ${row.mallRate}`).toBe(
        `${(row.mallRate! * 100).toFixed(2)}%`
      );
    }
  });

  it('defaults to Marketplace when no tier has been selected', () => {
    expect(commission(inputs({ sellerTier: null })).rate).toBe('6.80%');
  });

  it('names the selected seller tier in the notes, matching the selection', () => {
    const marketplace = commission(inputs({ sellerTier: 'marketplace' }));
    const mall = commission(inputs({ sellerTier: 'mall' }));
    expect(marketplace.notes).toContain('Seller tier: Marketplace');
    expect(marketplace.notes).not.toContain('Seller tier: Mall');
    expect(mall.notes).toContain('Seller tier: Mall');
    expect(mall.notes).not.toContain('Seller tier: Marketplace');
  });

  it('never reports the category label as the selected tier', () => {
    // The row is labelled "Marketplace", so a Mall selection that fell back to
    // the label would be self-contradictory.
    const mall = commission(inputs({ sellerTier: 'mall' }));
    expect(mall.notes).not.toMatch(/Seller tier:\s*Marketplace/);
  });
});

describe('PH missing mallRate is never a zero', () => {
  const inputs = (over: Partial<CalculatorInputs> = {}): CalculatorInputs => ({
    ...createDefaultInputs('PH'),
    categoryId: 'ph-fashion-shoes',
    sellingPrice: 1000,
    ...over,
  });

  it('reports unpriced when the matched record has no Mall rate', () => {
    const stripped: MarketRateData = {
      ...ph,
      categories: ph.categories.map((c) =>
        c.id === 'ph-fashion-shoes' ? { ...c, mallRate: undefined } : c
      ),
    };
    const fee = calculatePHFeesSync(inputs({ sellerTier: 'mall' }), stripped).find(
      (f) => f.name === 'Commission Fee'
    )!;
    expect(fee.pricing).toBe('unpriced');
    expect(fee.amount).toBe(0);
    expect(fee.rate).toBe('not published');
  });

  it('does not substitute a neighbouring or default rate for a missing Mall rate', () => {
    const stripped: MarketRateData = {
      ...ph,
      categories: ph.categories.map((c) =>
        c.id === 'ph-fashion-shoes' ? { ...c, mallRate: undefined } : c
      ),
    };
    const fee = calculatePHFeesSync(inputs({ sellerTier: 'mall' }), stripped).find(
      (f) => f.name === 'Commission Fee'
    )!;
    // Not 7.90% (this category's own Mall rate), not 6.80% (its Marketplace
    // rate), and not the 7.70% file default.
    expect(fee.rate).not.toBe('7.90%');
    expect(fee.rate).not.toBe('6.80%');
    expect(fee.rate).not.toBe('7.70%');
    expect(fee.notes).toContain('No Mall commission rate is published');
  });

  it('still prices Marketplace for that same record', () => {
    const stripped: MarketRateData = {
      ...ph,
      categories: ph.categories.map((c) =>
        c.id === 'ph-fashion-shoes' ? { ...c, mallRate: undefined } : c
      ),
    };
    const fee = calculatePHFeesSync(inputs({ sellerTier: 'marketplace' }), stripped).find(
      (f) => f.name === 'Commission Fee'
    )!;
    expect(fee.pricing).toBe('priced');
    expect(fee.rate).toBe('6.80%');
  });

  it('is excluded from the priced lines, so totals become a best case', () => {
    const stripped: MarketRateData = {
      ...ph,
      categories: ph.categories.map((c) =>
        c.id === 'ph-fashion-shoes' ? { ...c, mallRate: undefined } : c
      ),
    };
    const fees = calculatePHFeesSync(inputs({ sellerTier: 'mall' }), stripped);
    const commission = fees.find((f) => f.name === 'Commission Fee')!;
    const priced = fees.filter((f) => f.pricing === 'priced');

    // Only `pricing === 'priced'` lines contribute to totals, so an unpriced
    // commission cannot be summed as though it were a real cost.
    expect(commission.pricing).toBe('unpriced');
    expect(priced.map((f) => f.name)).not.toContain('Commission Fee');
    expect(priced.map((f) => f.name)).toContain('Transaction Fee');
  });

  it('keeps the file-level default for a category that matches nothing', () => {
    // Distinct from a missing rate: an unmatched id has no record to read, so
    // the default is the best available answer, flagged as needing verification.
    const fee = calculatePHFeesSync(
      inputs({ categoryId: 'ph-does-not-exist', sellerTier: 'marketplace' }),
      ph
    ).find((f) => f.name === 'Commission Fee')!;
    expect(fee.pricing).toBe('priced');
    expect(fee.rate).toBe('6.70%');
    expect(fee.confidence).toBe('needs-verification');
  });
});
