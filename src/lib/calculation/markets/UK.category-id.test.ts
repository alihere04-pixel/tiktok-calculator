import { describe, it, expect } from 'vitest';
import { calculateUKFeesSync } from './UK';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { findCategoryRow, groupCategories } from '@/lib/rates/tiers';
import type { CalculatorInputs, SellerTier } from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';

/**
 * Regression tests for the UK category-group id / rate-row id defect.
 *
 * The selector submits a category-group id (`groupCategories(...)[i].id`), while
 * the engine compared it against raw rate-row ids. A group id is built from the
 * category name alone and a row id from the section plus the name, so only one
 * of the 347 UK groups (`uk-electronics`) could ever match. The other 346 fell
 * back to the 9% default, which silently overcharged the 129 categories
 * published at 5%.
 *
 * These tests drive the engine the way the form does (by group id) and assert
 * the published rate, not merely that a rate was found.
 */

// Loaded at module scope, not in `beforeAll`, because the expectations below are
// derived from the rate file and have to exist before the first test runs.
const ukRates: MarketRateData = loadMarketRatesSync('UK');
const ukGroups = groupCategories('UK', ukRates.categories);

const baseInputs: CalculatorInputs = {
  market: 'UK',
  // UK does not tier its commission rates, but a tier is still present on many
  // call sites and saved payloads. Resolution must not depend on it.
  sellerTier: 'standard',
  categoryId: '',
  sellingPrice: 100,
  sellerDiscount: 0,
  platformDiscount: 0,
  customerShipping: 0,
  cogs: 30,
  outboundShipping: 5,
  affiliateMode: 'none',
  affiliateRate: 0,
  returnRate: 0,
  cpa: 0,
  newSellerPromo: false,
  promoDaysRemaining: 0,
  isPreOrder: false,
  isShippingProgramEnrolled: false,
  isGMVMaxActive: false,
};

const PROMO_ROW_ID = 'uk-new-seller-promo';

function commissionFor(overrides: Partial<CalculatorInputs>) {
  const fees = calculateUKFeesSync({ ...baseInputs, ...overrides }, ukRates);
  const commission = fees.find(f => f.name === 'Platform Commission Fee');
  expect(commission).toBeDefined();
  return commission!;
}

/** The group id the form would submit for a rate row. */
function groupIdForRow(rowId: string): string {
  const group = ukGroups.find(g => g.rows.some(r => r.id === rowId));
  if (!group) throw new Error(`No UK group contains row ${rowId}`);
  return group.id;
}

const rowsAtFive = ukRates.categories.filter(c => c.rate === 0.05);
const fivePercentRows = rowsAtFive.map(c => c.id);

/**
 * The 129 affected categories, pinned by the section they are filed under.
 *
 * Named rather than left as an opaque count so that a rate file edit which
 * moves a category between the 5% and 9% bands has to be a deliberate change to
 * one of these numbers.
 */
const FIVE_PERCENT_BY_SECTION: Record<string, number> = {
  'Phones & Electronics': 64,
  'Computers & Office Equipment': 46,
  'Beauty & Personal Care': 14,
  'Pre-Owned': 3,
  Electronics: 1,
  'Household Appliances': 1,
};

describe('UK category id resolution', () => {
  it('publishes exactly 129 categories at 5%, and the section split is unchanged', () => {
    expect(rowsAtFive).toHaveLength(129);

    const bySection = new Map<string, number>();
    for (const row of rowsAtFive) {
      bySection.set(row.parentCategory, (bySection.get(row.parentCategory) ?? 0) + 1);
    }

    expect(Object.fromEntries([...bySection.entries()].sort((a, b) => b[1] - a[1]))).toEqual(
      FIVE_PERCENT_BY_SECTION
    );
  });

  it('cannot match 346 of the 347 group ids against a row id, which is the defect', () => {
    // The structural precondition. If this ever starts passing wholesale, the id
    // derivation has changed and these tests need re-reading rather than trusting.
    const rowIds = new Set(ukRates.categories.map(c => c.id));
    const unmatchable = ukGroups.filter(g => !rowIds.has(g.id));

    expect(ukGroups).toHaveLength(347);
    expect(unmatchable).toHaveLength(346);
    // The single coincidence that let some UK categories price correctly.
    expect(ukGroups.filter(g => rowIds.has(g.id)).map(g => g.id)).toEqual(['uk-electronics']);
  });

  it.each(fivePercentRows)('charges 5%% not 9%% for the group id holding row %s', (rowId) => {
    const commission = commissionFor({ categoryId: groupIdForRow(rowId) });
    // GBP 100 at the published 5%, not the 9% fallback.
    expect(commission.amount).toBe(5);
    expect(commission.rate).toBe('5.00%');
  });

  it.each(fivePercentRows)('reads the row metadata for %s, proving the row was found', (rowId) => {
    const row = ukRates.categories.find(c => c.id === rowId)!;
    const commission = commissionFor({ categoryId: groupIdForRow(rowId) });

    // Before the fix no UK category matched a row except `uk-electronics`, so
    // every other line fell back to 'needs-verification'. The published
    // confidence and source prove the row itself was resolved.
    expect(commission.confidence).toBe(row.confidence);
    expect(commission.confidence).toBe('high');
    expect(commission.sourceUrl).toBe(row.sourceUrl);
    expect(commission.effectiveDate).toBe(row.sourceDate);
    expect(commission.lastVerified).toBe(row.lastVerified);
  });

  it.each(fivePercentRows)('resolves %s identically from its group id and its row id', (rowId) => {
    const viaGroup = commissionFor({ categoryId: groupIdForRow(rowId) });
    const viaRow = commissionFor({ categoryId: rowId });

    expect(viaGroup.amount).toBe(viaRow.amount);
    expect(viaGroup.rate).toBe(viaRow.rate);
    expect(viaGroup.confidence).toBe(viaRow.confidence);
    expect(viaGroup.notes).toBe(viaRow.notes);
  });

  it('prices every published UK category from its own row', () => {
    // The blanket invariant behind the bug: no selector option may fall back to
    // the 9% default. Catches any future group id that cannot be resolved, in
    // either direction, including the published 0% promo row.
    const mispriced: string[] = [];
    for (const group of ukGroups) {
      const row = group.rows[0];
      const commission = commissionFor({ categoryId: group.id });
      if (Math.abs(commission.amount - row.rate * 100) > 0.005) {
        mispriced.push(`${group.id}: published ${row.rate}, charged ${commission.amount / 100}`);
      }
    }
    expect(mispriced).toEqual([]);
  });

  it('leaves the 217 categories published at 9% charging 9%', () => {
    // These were right before the fix, but only by accident: the fallback
    // happened to equal the published rate. They must still resolve from their
    // own row rather than from the default.
    const atNine = ukGroups.filter(g => g.rows[0].rate === 0.09);
    expect(atNine).toHaveLength(217);

    for (const group of atNine) {
      const commission = commissionFor({ categoryId: group.id });
      expect(commission.amount, group.id).toBe(9);
      expect(commission.confidence, group.id).toBe(group.rows[0].confidence);
      expect(commission.confidence, group.id).not.toBe('needs-verification');
    }
  });

  it('resolves the published 0% promo category instead of the 9% fallback', () => {
    const groupId = groupIdForRow(PROMO_ROW_ID);
    expect(groupId).toBe('uk-new-seller-promotional-rate');
    expect(groupId).not.toBe(PROMO_ROW_ID);

    const commission = commissionFor({ categoryId: groupId });
    // A genuine published 0% is a priced rate of zero, not an unknown rate and
    // not the 9% standard fee.
    expect(commission.rate).toBe('0.00%');
    expect(commission.amount).toBe(0);
    expect(commission.pricing).toBe('priced');
    expect(commission.confidence).toBe('medium');
  });

  it('recognises the promo category by group id, not only by row id', () => {
    // The message differs because the id shapes do. Before the fix the form's
    // own value never matched, so the engine told sellers the promo was only
    // "assumed to apply" to the category that publishes it.
    const viaGroup = calculateUKFeesSync(
      { ...baseInputs, categoryId: groupIdForRow(PROMO_ROW_ID), newSellerPromo: true, promoDaysRemaining: 45 },
      ukRates
    ).find(f => f.name.includes('New Seller Promo'))!;

    const viaRow = calculateUKFeesSync(
      { ...baseInputs, categoryId: PROMO_ROW_ID, newSellerPromo: true, promoDaysRemaining: 45 },
      ukRates
    ).find(f => f.name.includes('New Seller Promo'))!;

    expect(viaGroup.notes).toBe(viaRow.notes);
    expect(viaGroup.notes).toContain('The new seller promo waives commission');
    expect(viaGroup.notes).not.toContain('is assumed to apply');
    expect(viaGroup.pricing).toBe('unpriced');
  });

  it('still says the promo is only assumed for a category that is not the promo', () => {
    const other = commissionFor({ categoryId: groupIdForRow('uk-beauty-personal-care') });
    expect(other.rate).toBe('5.00%');

    const promo = calculateUKFeesSync(
      { ...baseInputs, categoryId: groupIdForRow('uk-beauty-personal-care'), newSellerPromo: true, promoDaysRemaining: 45 },
      ukRates
    ).find(f => f.name.includes('New Seller Promo'))!;

    expect(promo.notes).toContain('is assumed to apply');
    expect(promo.pricing).toBe('unpriced');
    // The published rate it would apply to is still shown to the seller.
    expect(promo.notes).toContain('5.00%');
  });

  it('still falls back to 9% for an id that matches nothing', () => {
    const commission = commissionFor({ categoryId: 'uk-definitely-not-real' });
    expect(commission.amount).toBe(9);
    expect(commission.rate).toBe('9.00%');
    expect(commission.confidence).toBe('needs-verification');
  });

  it('resolves group ids regardless of the seller tier on the payload', () => {
    // UK publishes no tiers, so a tier must not be used to disambiguate: every
    // UK row has no `tier` field and a tier-aware lookup would match nothing.
    const tiers: Array<SellerTier | null> = [null, 'standard', 'marketplace', 'mall', 'bxp'];

    for (const sellerTier of tiers) {
      const commission = commissionFor({
        categoryId: groupIdForRow('uk-beauty-personal-care'),
        sellerTier,
      });
      expect(commission.amount, String(sellerTier)).toBe(5);
    }
  });

  it('resolves through the shared resolver every UK group offers', () => {
    // Guards the helper this engine now depends on, so UK cannot drift from the
    // PH, MY and SG engines again.
    const unresolved = ukGroups
      .map(group => findCategoryRow('UK', ukRates.categories, group.id, null)?.id)
      .filter(id => id === undefined);

    expect(unresolved).toEqual([]);
  });
});
