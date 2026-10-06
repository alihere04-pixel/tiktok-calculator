import { describe, it, expect, beforeAll } from 'vitest';
import { calculateUSFeesSync } from './US';
import { loadMarketRates } from '@/lib/rates/loader';
import { groupCategories } from '@/lib/rates/tiers';
import type { CalculatorInputs, AffiliateMode } from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

/**
 * Regression tests for the US category-group id / rate-row id defect.
 *
 * The selector submits a category-group id (`groupCategories(...)[i].id`), while
 * the engine compared it against raw rate-row ids. Because every US group id is
 * built from the category name alone and every US row id carries the section as
 * well, no US group id could ever match a row id: all 202 categories missed the
 * lookup and fell back to the 6% default. The 17 categories published at 5%
 * were therefore charged 6%.
 *
 * These tests drive the engine the way the form does (by group id) and assert
 * the published rate, not just that a rate was found.
 */

let usRates: MarketRateData;
let usGroups: ReturnType<typeof groupCategories>;

beforeAll(async () => {
  usRates = await loadMarketRates('US');
  usGroups = groupCategories('US', usRates.categories);
});

const baseInputs: CalculatorInputs = {
  market: 'US',
  // US does not tier its commission rates, but a tier is still present on many
  // call sites and saved payloads. Resolution must not depend on it.
  sellerTier: 'standard',
  categoryId: '',
  sellingPrice: 100,
  sellerDiscount: 0,
  platformDiscount: 0,
  customerShipping: 0,
  cogs: 30,
  outboundShipping: 5,
  affiliateMode: 'none' as AffiliateMode,
  affiliateRate: 0,
  returnRate: 0,
  cpa: 0,
  newSellerPromo: false,
  promoDaysRemaining: 0,
  isPreOrder: false,
  isShippingProgramEnrolled: false,
  isGMVMaxActive: false,
};

function referralFeeFor(overrides: Partial<CalculatorInputs>) {
  const fees = calculateUSFeesSync({ ...baseInputs, ...overrides }, usRates);
  const referral = fees.find(f => f.name === 'Referral Fee');
  expect(referral).toBeDefined();
  return referral!;
}

/** The group id the form would submit for a rate row. */
function groupIdForRow(rowId: string): string {
  const group = usGroups.find(g => g.rows.some(r => r.id === rowId));
  if (!group) throw new Error(`No US group contains row ${rowId}`);
  return group.id;
}

const FIVE_PERCENT_ROWS = [
  // Jewelry Accessories & Derivatives
  'us-jewelry-diamond',
  'us-jewelry-gold',
  'us-jewelry-jade',
  'us-jewelry-platinum-carat-gold',
  'us-jewelry-ruby-sapphire-emerald',
  // Pre-Owned
  'us-preowned-bags',
  'us-preowned-collectible-trading-cards',
  'us-preowned-luggage-travel',
  'us-preowned-watches',
  'us-preowned-footwear',
  'us-preowned-refurbished-phones-electronics',
  'us-preowned-fashion-accessories',
  'us-preowned-menswear',
  'us-preowned-womenswear',
  'us-preowned-collectible-coins-paper-money',
  'us-preowned-collectible-figures',
  'us-preowned-collectible-comic-books',
];

describe('US category id resolution', () => {
  it('publishes exactly 17 categories at 5%, and the list is complete', () => {
    const atFive = usRates.categories.filter(c => c.rate === 0.05);
    expect(atFive).toHaveLength(17);
    expect(atFive.map(c => c.id).sort()).toEqual([...FIVE_PERCENT_ROWS].sort());
  });

  it.each(FIVE_PERCENT_ROWS)(
    'charges 5%% not 6%% for group id resolving to row %s',
    rowId => {
      const fees = calculateUSFeesSync(
        { ...baseInputs, categoryId: groupIdForRow(rowId) },
        usRates
      );
      const referral = fees.find(f => f.name === 'Referral Fee')!;
      // $100 base at the published 5%, not the 6% fallback.
      expect(referral.amount).toBe(5.00);
      expect(referral.rate).toBe('5.0%');
    }
  );

  it.each(FIVE_PERCENT_ROWS)(
    'reads the row metadata for %s, proving the row was found',
    rowId => {
      const row = usRates.categories.find(c => c.id === rowId)!;
      const referral = referralFeeFor({ categoryId: groupIdForRow(rowId) });
      // Before the fix no US category matched a row, so every line fell back to
      // 'needs-verification'. The published confidence proves the row resolved.
      expect(referral.confidence).toBe(row.confidence);
      expect(referral.confidence).toBe('high');
      expect(referral.sourceUrl).toBe(row.sourceUrl);
      expect(referral.effectiveDate).toBe(row.sourceDate);
    }
  );

  it('resolves the same row from a group id and from a raw row id', () => {
    for (const rowId of FIVE_PERCENT_ROWS) {
      const viaGroup = referralFeeFor({ categoryId: groupIdForRow(rowId) });
      const viaRow = referralFeeFor({ categoryId: rowId });
      expect(viaGroup.amount).toBe(viaRow.amount);
      expect(viaGroup.rate).toBe(viaRow.rate);
      expect(viaGroup.notes).toBe(viaRow.notes);
    }
  });

  it('applies the tiered threshold through a group id', () => {
    // Pre-Owned publishes 5% on the first $10,000 and 3% above it. This only
    // works if the group's `specialRules` came from the resolved row.
    const referral = referralFeeFor({
      categoryId: groupIdForRow('us-preowned-bags'),
      sellingPrice: 15000,
    });
    // 5% of $10,000 = $500, 3% of $5,000 = $150.
    expect(referral.amount).toBe(650);
    expect(referral.notes).toContain('Tiered');
  });

  it('uses each group id as a distinct lookup key', () => {
    // Diamond is 5% while Amber, in the same Jewelry section, is 6%.
    expect(referralFeeFor({ categoryId: groupIdForRow('us-jewelry-diamond') }).amount).toBe(5.00);
    expect(referralFeeFor({ categoryId: groupIdForRow('us-jewelry-amber') }).amount).toBe(6.00);
  });

  it('still resolves a group id that does not exist to the 6% default', () => {
    const referral = referralFeeFor({ categoryId: 'us-does-not-exist' });
    expect(referral.amount).toBe(6.00);
    expect(referral.confidence).toBe('needs-verification');
  });

  it('prices every published US category from its own row', () => {
    // The blanket invariant behind the bug: no selector option may fall back to
    // the default rate. Catches any future group id that cannot be resolved.
    const mismatches: string[] = [];
    for (const group of usGroups) {
      const referral = referralFeeFor({ categoryId: group.id, sellingPrice: 100 });
      const row = group.rows[0];
      if (Math.abs(referral.amount - row.rate * 100) > 0.005) {
        mismatches.push(`${group.id} -> ${referral.rate} (row ${row.rate})`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('resolves group ids regardless of the seller tier on the payload', () => {
    // US publishes no tiers, so a tier must not be used to disambiguate: every
    // US row has no `tier` field and a tier-aware lookup would match nothing.
    for (const sellerTier of [null, 'standard', 'marketplace', 'mall', 'bxp'] as const) {
      const referral = referralFeeFor({
        categoryId: groupIdForRow('us-jewelry-diamond'),
        sellerTier,
      });
      expect(referral.amount).toBe(5.00);
    }
  });
});
