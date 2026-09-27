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

    it('preserves the US missingCategories note', async () => {
      const rates = await loadMarketRates('US');
      expect(rates.missingCategories).toBeTruthy();
      expect(typeof rates.missingCategories).toBe('string');
    });

    it('preserves the UK defaultRate and excelFile reference', async () => {
      const rates = await loadMarketRates('UK');
      expect(rates.defaultRate).toBe(0.09);
      expect(rates.excelFile?.needsManualDownload).toBe(true);
      expect(rates.excelFile?.name).toContain('Commission Rates');
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
