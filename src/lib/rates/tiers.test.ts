import { describe, it, expect } from 'vitest';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { groupCategories, normalizeSellerTier, sellerTierLabel, availableSellerTiers } from './tiers';

const MARKETS = ['US', 'PH', 'SG', 'MY', 'UK'] as const;

/**
 * Invariants the rate files must satisfy no matter how they are edited.
 *
 * These run against the real data rather than fixtures, because the properties
 * being protected are properties of the data: a grouping change that quietly
 * dropped a published rate would still pass every engine test.
 */
describe('category grouping invariants', () => {
  it.each(MARKETS)('%s loses no rate row to grouping', (market) => {
    const rates = loadMarketRatesSync(market);
    const groups = groupCategories(market, rates.categories);
    const kept = groups.reduce((sum, group) => sum + group.rows.length, 0);

    expect(kept, `${market}: every published row must survive grouping`).toBe(
      rates.categories.length
    );
  });

  it.each(MARKETS)('%s produces unique group ids', (market) => {
    const rates = loadMarketRatesSync(market);
    const ids = groupCategories(market, rates.categories).map((g) => g.id);
    expect(new Set(ids).size, `${market}: duplicate group ids`).toBe(ids.length);
  });

  it.each(MARKETS)('%s produces unique category labels', (market) => {
    // A selector cannot offer the same name twice: the seller has no way to
    // choose, and the duplicate may be priced differently.
    const rates = loadMarketRatesSync(market);
    const labels = groupCategories(market, rates.categories).map((g) => g.label);
    const dupes = labels.filter((label, i) => labels.indexOf(label) !== i);
    expect([...new Set(dupes)], `${market}: duplicate category labels`).toEqual([]);
  });

  it.each(MARKETS)('%s keeps every rate row resolvable by its own id', (market) => {
    // A legacy id, or a deep link built before grouping existed, must still
    // reach its rate.
    const rates = loadMarketRatesSync(market);
    const groups = groupCategories(market, rates.categories);
    for (const group of groups) {
      for (const row of group.rows) {
        expect(row.id, `${market}: ${row.id}`).toBeTruthy();
        expect(rates.categories.some((c) => c.id === row.id), `${market}: ${row.id}`).toBe(true);
      }
    }
  });
});

describe('per-market grouping shape', () => {
  it('MY collapses six tier rows into two categories', () => {
    const rates = loadMarketRatesSync('MY');
    const groups = groupCategories('MY', rates.categories);
    expect(groups.map((g) => g.label)).toEqual(['Electronics', 'Toys']);
    expect(groups.find((g) => g.label === 'Electronics')!.rows).toHaveLength(4);
    expect(groups.find((g) => g.label === 'Toys')!.rows).toHaveLength(2);
  });

  it('SG merges each cluster across the programmes it supports', () => {
    const rates = loadMarketRatesSync('SG');
    const groups = groupCategories('SG', rates.categories);
    // 10 rows across 5 groups: the Standard/BXP and BXP Mixed rows of the same
    // cluster are one category, priced by the selected programme.
    expect(groups).toHaveLength(5);
    const electronics = groups.find((g) => g.tiers.includes('bxp-mixed'))!;
    expect(electronics.rows).toHaveLength(3);
  });

  it('PH keeps one entry per category, with both seller tiers on each', () => {
    // PH needs no grouping: a single record prices Marketplace and Mall via
    // mallRate. Grouping its section headings would hide real categories.
    const rates = loadMarketRatesSync('PH');
    const groups = groupCategories('PH', rates.categories);
    expect(groups.length).toBeGreaterThanOrEqual(rates.categories.length - 2);
    for (const group of groups) {
      expect(group.tiers).toEqual(['marketplace', 'mall']);
    }
  });

  it('distinguishes the two PH categories that share a name', () => {
    // "Sports & Outdoor" is published twice at different rates; the selector
    // must not show two identical options.
    const rates = loadMarketRatesSync('PH');
    const labels = groupCategories('PH', rates.categories).map((g) => g.label);
    expect(labels.filter((l) => l.startsWith('Sports & Outdoor'))).toHaveLength(2);
    expect(labels).toContain('Sports & Outdoor (Fashion)');
  });

  it('US and UK are passed through untouched', () => {
    for (const market of ['US', 'UK'] as const) {
      const rates = loadMarketRatesSync(market);
      const groups = groupCategories(market, rates.categories);
      expect(groups, market).toHaveLength(rates.categories.length);
      expect(availableSellerTiers(market, rates.categories), market).toEqual([]);
    }
  });
});

describe('tier vocabulary', () => {
  it('normalises every published label to its canonical token', () => {
    expect(normalizeSellerTier('BXP')).toBe('bxp');
    expect(normalizeSellerTier('bxp')).toBe('bxp');
    expect(normalizeSellerTier('BXP Mixed')).toBe('bxp-mixed');
    expect(normalizeSellerTier('bxp-mixed')).toBe('bxp-mixed');
    expect(normalizeSellerTier('Non-BXP Marketplace')).toBe('non-bxp-marketplace');
    expect(normalizeSellerTier('  marketplace  ')).toBe('marketplace');
  });

  it('never confuses BXP Marketplace with plain BXP', () => {
    // The label prefix is a real hazard: a substring or prefix match would
    // price a BXP Mall seller at the BXP Marketplace rate.
    expect(normalizeSellerTier('BXP Marketplace')).toBe('bxp-marketplace');
    expect(normalizeSellerTier('BXP Marketplace')).not.toBe('bxp');
    expect(normalizeSellerTier('Non-BXP Mall')).toBe('non-bxp-mall');
    expect(normalizeSellerTier('Non-BXP Mall')).not.toBe('bxp-mall');
  });

  it('returns null for an unrecognised or absent tier', () => {
    expect(normalizeSellerTier('Enterprise Plus')).toBeNull();
    expect(normalizeSellerTier('')).toBeNull();
    expect(normalizeSellerTier(null)).toBeNull();
    expect(normalizeSellerTier(undefined)).toBeNull();
  });

  it('renders a label for every token it can produce', () => {
    for (const market of MARKETS) {
      for (const tier of availableSellerTiers(market, loadMarketRatesSync(market).categories)) {
        expect(sellerTierLabel(tier).length, tier).toBeGreaterThan(0);
        // A label must round-trip, so the engine and the form agree.
        expect(normalizeSellerTier(sellerTierLabel(tier)), tier).toBe(tier);
      }
    }
  });
});
