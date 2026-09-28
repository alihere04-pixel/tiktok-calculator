import { describe, it, expect } from 'vitest';
import {
  loadMarketRates,
  loadAllMarketRates,
  getAvailableMarkets,
  getRateFilePath,
} from './loader';

const MARKETS = ['US', 'UK', 'SG', 'MY', 'PH'] as const;

describe('lib/rates/loader', () => {
  it('reports all five markets as available', () => {
    expect(getAvailableMarkets().sort()).toEqual([...MARKETS].sort());
  });

  it('resolves an existing path for every market', () => {
    for (const market of MARKETS) {
      expect(getRateFilePath(market)).toMatch(/rates[\\/].*\.json$/);
    }
  });

  it('rejects an unknown market', () => {
    expect(() => getRateFilePath('DE')).toThrow(/No rate file mapping/);
  });

  describe.each(MARKETS)('%s rate file', market => {
    it('loads and validates without throwing', async () => {
      const rates = await loadMarketRates(market);
      expect(rates.market).toBe(market);
      expect(rates.categories.length).toBeGreaterThan(0);
    });

    it('every category passes validation and keeps a non-empty rate', async () => {
      const rates = await loadMarketRates(market);
      for (const category of rates.categories) {
        expect(typeof category.rate).toBe('number');
        expect(category.rate).toBeGreaterThanOrEqual(0);
        expect(category.rate).toBeLessThanOrEqual(1);
      }
    });

    it('categories inherit non-empty source metadata', async () => {
      const rates = await loadMarketRates(market);
      for (const category of rates.categories) {
        expect(category.sourceUrl).toMatch(/^https:\/\//);
        expect(category.sourceDate).not.toBe('');
        expect(category.lastVerified).not.toBe('');
      }
    });
  });

  describe('tier labels used by the rate files', () => {
    it('accepts the PH "Marketplace" label', async () => {
      const rates = await loadMarketRates('PH');
      const tiers = new Set(rates.categories.map(c => c.tier));
      expect(tiers).toContain('Marketplace');
    });

    it('accepts the SG "BXP Mixed" and "BXP Restricted" labels', async () => {
      const rates = await loadMarketRates('SG');
      const tiers = new Set(rates.categories.map(c => c.tier));
      expect(tiers).toContain('BXP Mixed');
      expect(tiers).toContain('BXP Restricted');
      expect(tiers).toContain('Standard');
      expect(tiers).toContain('BXP');
    });

    it('accepts all four MY BXP/Non-BXP Marketplace/Mall labels', async () => {
      const rates = await loadMarketRates('MY');
      const tiers = new Set(rates.categories.map(c => c.tier));
      expect(tiers).toEqual(
        new Set([
          'BXP Marketplace',
          'BXP Mall',
          'Non-BXP Marketplace',
          'Non-BXP Mall',
        ])
      );
    });

    it('keeps the lowercase internal identifiers valid', async () => {
      const { validateCategoryRate } = await import('./schema');
      const parsed = validateCategoryRate({
        id: 'x',
        name: 'X',
        parentCategory: 'X',
        rate: 0.05,
        tier: 'standard',
      });
      expect(parsed.tier).toBe('standard');
    });

    it('rejects a tier label that is not a known seller tier', async () => {
      const { validateCategoryRate } = await import('./schema');
      expect(() =>
        validateCategoryRate({
          id: 'x',
          name: 'X',
          parentCategory: 'X',
          rate: 0.05,
          tier: 'Platinum',
        })
      ).toThrow();
    });
  });

  describe('fields that Zod would otherwise strip', () => {
    it('preserves the PH mallRate on every category', async () => {
      const rates = await loadMarketRates('PH');
      expect(rates.categories.length).toBeGreaterThan(0);
      for (const category of rates.categories) {
        expect(typeof category.mallRate).toBe('number');
        expect(category.mallRate!).toBeGreaterThan(0);
      }
    });

    it('preserves the MY Dynamic Commission range and cap', async () => {
      const rates = await loadMarketRates('MY');
      const dynamic = rates.additionalFees?.dynamicCommission;
      expect(dynamic?.rateRange).toBe('4.00% - 6.00%');
      expect(dynamic?.capPerItem).toBe(650000);
    });

    it('preserves the SG BXP service fee scope and suspended description', async () => {
      const rates = await loadMarketRates('SG');
      expect(rates.additionalFees?.bxpServiceFee?.appliesTo).toContain(
        'Non-BXP-restricted'
      );
      expect(rates.additionalFees?.bxpSuspendedRate?.description).toContain(
        'suspended'
      );
    });

    it('marks the US table complete and drops the missingCategories note', async () => {
      const rates = await loadMarketRates('US');
      // The Seller University page ships the whole commission table in its
      // server-side HTML, so the "pagination gap" this file used to declare was
      // never real. The note is removed rather than left to describe a gap that
      // no longer exists.
      expect(rates.extractionStatus).toBe('complete');
      expect(rates.coverage).toBe('complete');
      expect(rates.missingData).toBe('none');
      expect(rates.missingCategories).toBeUndefined();
    });

    it('carries the full US category table from the Seller University page', async () => {
      const rates = await loadMarketRates('US');

      // 78 previously transcribed rows plus the 124 that were never extracted.
      expect(rates.categories).toHaveLength(202);
      expect(new Set(rates.categories.map((c) => c.id)).size).toBe(202);
      expect(new Set(rates.categories.map((c) => c.name)).size).toBe(202);

      // 27 parents: the 15 that existed plus the 12 that were missing entirely.
      expect(new Set(rates.categories.map((c) => c.parentCategory)).size).toBe(27);

      for (const category of rates.categories) {
        expect(category.id.startsWith('us-')).toBe(true);
        expect(category.name.length).toBeGreaterThan(0);
        expect(category.parentCategory.length).toBeGreaterThan(0);
        expect(category.rate).toBeGreaterThanOrEqual(0);
        expect(category.rate).toBeLessThanOrEqual(1);
      }

      // The page publishes only 6% and 5%. Anything else means a row was
      // transcribed from the wrong column.
      const ratesPublished = new Set(rates.categories.map((c) => c.rate));
      expect([...ratesPublished].sort()).toEqual([0.05, 0.06]);

      // TikTok's own QA stubs are published in the same table but are not
      // categories a seller can list under, so they must never reach the file.
      const qaFixtures = rates.categories.filter(
        (c) => /test category/i.test(c.parentCategory) || /test category/i.test(c.name)
      );
      expect(qaFixtures).toEqual([]);

      // The two rows the page renamed. Their ids are preserved so any saved
      // calculator link keeps resolving to the same rate.
      const renamed = rates.categories.find((c) => c.id === 'us-books-schooling');
      expect(renamed?.name).toBe('Education & Schooling');
      const crystal = rates.categories.find((c) => c.id === 'us-jewelry-crystal');
      expect(crystal?.name).toBe('Natural Crystal');

      // The 16 rows that carry the $10,000 threshold note keep the tiered rule.
      const tieredRates = rates.categories
        .map((c) => c.specialRules?.[0])
        .filter((rule) => rule?.type === 'tieredThreshold');
      expect(tieredRates).toHaveLength(16);
      for (const rule of tieredRates) {
        expect(rule?.rateAboveThreshold).toBe(0.03);
      }
    });

    it('preserves the UK defaultRate and excelFile reference', async () => {
      const rates = await loadMarketRates('UK');
      expect(rates.defaultRate).toBe(0.09);
      // The Excel has been downloaded and fully extracted, so the file is no
      // longer something a human has to fetch by hand.
      expect(rates.excelFile?.needsManualDownload).toBe(false);
      expect(rates.excelFile?.name).toContain('Commission Rates');
      expect(rates.extractionStatus).toBe('complete');
      expect(rates.coverage).toBe('complete');
    });

    it('carries the full UK category table extracted from the Excel', async () => {
      const rates = await loadMarketRates('UK');

      // 4 policy-level records plus the 343 rows of the published Excel.
      expect(rates.categories).toHaveLength(347);
      expect(new Set(rates.categories.map((c) => c.id)).size).toBe(347);

      // Every Excel row is a real record, not a placeholder: no empty labels and
      // every rate is a usable decimal.
      for (const category of rates.categories) {
        expect(category.name.length).toBeGreaterThan(0);
        expect(category.parentCategory.length).toBeGreaterThan(0);
        expect(category.rate).toBeGreaterThanOrEqual(0);
        expect(category.rate).toBeLessThanOrEqual(1);
      }
    });
  });

  it('loadAllMarketRates returns every market', async () => {
    const all = await loadAllMarketRates();
    expect(Object.keys(all).sort()).toEqual([...MARKETS].sort());
  });

  it('returns a consistent shape across all markets', async () => {
    const all = await loadAllMarketRates();
    for (const [market, rates] of Object.entries(all)) {
      expect(rates.market).toBe(market);
      expect(rates.currency).toMatch(/^[A-Z]{3}$/);
      expect(rates.coverage).toBeTruthy();
      expect(rates.extractionStatus).toMatch(/partial|complete|failed/);
      expect(Array.isArray(rates.categories)).toBe(true);
    }
  });
});
