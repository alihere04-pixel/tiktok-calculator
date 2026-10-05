// CANONICAL SELLER-TIER VOCABULARY AND CATEGORY GROUPING
//
// One vocabulary, shared by the form, the engines and the tests.
//
// Two defects in the calculator traced back to the tier system, and both are
// fixed here rather than in each engine:
//
//   F-01 / F-08 (MY): the rate file stores one row per (category, seller tier).
//     The form listed those rows verbatim, so "Electronics" appeared four times
//     and each row's own `tier` overrode the tier the user had selected, which
//     made the Non-BXP Mall published rates unreachable.
//   F-02 (PH): `mallRate` exists on all 63 categories but the marketplace/mall
//     choice was not offered, so Mall commission was unreachable.
//   F-03 (SG): the form sent the display label ("BXP") while the engine
//     compared a lowercase token ('bxp'), so the selection was ignored.
//
// The fix is a canonical token per tier plus a "category group" that collects
// every rate row belonging to the same logical category. The form selects a
// group and a tier; the engine resolves (group, tier) to a row. Selecting the
// same category at a different tier is now a supported, expected move.
//
// This module is pure data + pure functions with no runtime dependency on the
// loader, so the browser bundle and the server engines can share it.

import type { SellerTier } from '@/lib/calculation/types';

/**
 * Every seller tier the calculator can model, as one canonical token.
 *
 * These are internal identifiers, not display labels. They are what
 * `CalculatorInputs.sellerTier` holds, so the form and the engine can never
 * disagree about spelling. `SELLER_TIER_LABELS` renders them for humans and
 * `normalizeSellerTier` accepts any published label, however it is cased or
 * spaced.
 */
export type CanonicalSellerTier = SellerTier;

export const SELLER_TIER_LABELS: Record<CanonicalSellerTier, string> = {
  // Philippines
  marketplace: 'Marketplace',
  mall: 'Mall',
  // Singapore
  standard: 'Standard',
  bxp: 'BXP',
  'bxp-restricted': 'BXP Restricted',
  'bxp-mixed': 'BXP Mixed',
  // Malaysia
  'bxp-marketplace': 'BXP Marketplace',
  'bxp-mall': 'BXP Mall',
  'non-bxp-marketplace': 'Non-BXP Marketplace',
  'non-bxp-mall': 'Non-BXP Mall',
};

/**
 * Display order for the tier selector, grouped by market.
 *
 * Order is fixed rather than derived from file order so the dropdown does not
 * reshuffle when a rate file is re-serialised. Tiers a market does not offer
 * are simply absent from the list built for that market.
 */
const TIER_ORDER: readonly CanonicalSellerTier[] = [
  'marketplace',
  'mall',
  'standard',
  'bxp',
  'bxp-restricted',
  'bxp-mixed',
  'bxp-marketplace',
  'bxp-mall',
  'non-bxp-marketplace',
  'non-bxp-mall',
];

/**
 * Published label -> canonical token.
 *
 * Matched on a comparison key with case, spaces, underscores and hyphens
 * removed, so "BXP", "bxp", "BXP Mixed" and "bxp-mixed" all resolve. The map is
 * keyed by that same folded form, so lookup is order-independent and a label
 * like "BXP Marketplace" can never be mis-read as plain "BXP".
 */
const TIER_BY_FOLDED_LABEL: Readonly<Record<string, CanonicalSellerTier>> = {
  marketplace: 'marketplace',
  mall: 'mall',
  standard: 'standard',
  bxp: 'bxp',
  bxprestricted: 'bxp-restricted',
  bxpmixed: 'bxp-mixed',
  bxpmarketplace: 'bxp-marketplace',
  bxpmall: 'bxp-mall',
  nonbxpmarketplace: 'non-bxp-marketplace',
  nonbxpmall: 'non-bxp-mall',
};

/**
 * Collapses a label to the form used for tier lookup: lowercase, with every
 * separator removed. Kept separate from `slugify` because tier folding must be
 * total and must never drop or reorder characters.
 */
function foldTierLabel(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Resolves any published tier label, or a token, to its canonical form.
 *
 * Returns null for an unrecognised or absent label rather than guessing a
 * default, so an unknown tier surfaces as an unpriced result instead of
 * silently resolving to the wrong band.
 */
export function normalizeSellerTier(
  value: string | null | undefined
): CanonicalSellerTier | null {
  if (typeof value !== 'string') return null;
  const folded = foldTierLabel(value.trim());
  if (folded === '') return null;
  return TIER_BY_FOLDED_LABEL[folded] ?? null;
}

export function sellerTierLabel(tier: CanonicalSellerTier): string {
  return SELLER_TIER_LABELS[tier];
}

/**
 * The minimum a row needs to be grouped and tier-resolved.
 *
 * Declared structurally rather than as `CategoryRate` so the browser-side
 * `MarketRateSummary` (a trimmed projection of the same data) satisfies it
 * without the client importing the Zod schema.
 */
export interface TierableCategory {
  id: string;
  name: string;
  parentCategory?: string;
  tier?: string;
  rate: number;
  /** PH carries both seller tiers on one record: `rate` and `mallRate`. */
  mallRate?: number;
  confidence?: string;
}

/**
 * One logical category, plus every rate row that belongs to it.
 *
 * MY's six published rows collapse to two groups (Electronics, Toys); SG's ten
 * collapse to six, each holding the rows for the tiers that category supports.
 * No row is discarded: `rows` always contains every record, so no published
 * rate is lost by grouping.
 *
 * Generic in the row type so callers keep the full `CategoryRate` shape,
 * including the per-category source metadata the fee lines depend on.
 */
export interface CategoryGroup<T extends TierableCategory = TierableCategory> {
  /** Stable id used as `inputs.categoryId`. */
  id: string;
  /** Human label for the category selector. */
  label: string;
  parentCategory?: string;
  /** Every rate row in this group, in rate-file order. */
  rows: T[];
  /** Canonical tiers this group can price, in selector order. */
  tiers: CanonicalSellerTier[];
}

/**
 * URL-safe id fragment. Capped so a long parent category cannot produce an
 * unwieldy id; collisions are resolved by the caller.
 */
function slugify(value: string, maxLength = 40): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > maxLength ? slug.slice(0, maxLength).replace(/-+$/, '') : slug;
}

/**
 * The label a group is shown under.
 *
 * A group spanning several rate rows is a real published category, so its
 * `parentCategory` is the accurate name ("Electronics", "Toys"). A group of one
 * uses the row's own `name`, which is more specific than its parent: the SG
 * BXP-Restricted rows share an enumeration of products as a parent but are
 * named for the sub-category they price, and that name is what a seller
 * recognises.
 */
function groupLabel(rows: TierableCategory[]): string {
  if (rows.length > 1) {
    const parent = rows[0].parentCategory?.trim();
    if (parent) return parent;
  }
  return rows[0].name.trim();
}

/**
 * Normalises a grouping key.
 *
 * Published parent categories are written by hand, so the same logical category
 * appears with inconsistent punctuation. SG is the case that matters: the
 * BXP Mixed electronics row is filed under "Electronics/Selected Lifestyle"
 * while the Standard and BXP rows use "Electronics / Selected Lifestyle", which
 * split one published category into two selector entries. Folding case, runs of
 * whitespace and the spacing around separators makes those two spellings one
 * key without merging genuinely different categories, because a real difference
 * in the words survives folding.
 */
function normalizeGroupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([/,&-])\s*/g, '$1');
}

/**
 * Groups rate rows into one entry per logical category.
 *
 * Rows are grouped by their normalised `parentCategory`, falling back to the
 * row name when a market does not set one. Grouping is only applied when it is
 * lossless: a group is a single row unless the rows that share a parent also
 * differ in tier, which is exactly the shape MY and SG publish. US and UK have
 * no tiers, so every row stays its own option and nothing is merged.
 *
 * One exception guards the selector: if splitting a bucket into single rows
 * would leave two options with the same label, they are merged back and labelled
 * by their shared name. Without it SG offers "BXP-Restricted Products" twice.
 */
export function groupCategories<T extends TierableCategory>(
  market: string,
  rows: readonly T[]
): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    const key = normalizeGroupKey(row.parentCategory?.trim() || row.name);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const usedIds = new Map<string, number>();
  const groups: CategoryGroup<T>[] = [];

  for (const [, bucket] of buckets) {
    // Grouping is only ever justified when the rows of a bucket are
    // *alternatives for the same category*, distinguished by tier. That is
    // exactly the shape MY (Electronics x4 tiers) and SG (each cluster x
    // programme) publish.
    //
    // It is deliberately not justified by a shared parent alone. PH files 63
    // genuinely different categories under 20 section headings like "Fashion",
    // and US/UK under their own parents; merging those would hide real
    // categories from the selector and drop their rates. PH needs no grouping
    // at all because one record prices both of its tiers, via `mallRate`.
    const distinctTiers = new Set(
      bucket
        .map((row) => normalizeSellerTier(row.tier))
        .filter((tier): tier is CanonicalSellerTier => tier !== null)
    );
    const isTiered = bucket.length > 1 && distinctTiers.size > 1;

    const subgroups = isTiered ? [bucket] : mergeIndistinguishable(bucket.map((row) => [row]));

    for (const rowsInGroup of subgroups) {
      groups.push({
        id: '',
        label: groupLabel(rowsInGroup),
        parentCategory: rowsInGroup[0].parentCategory,
        rows: rowsInGroup,
        tiers: tiersForGroup(rowsInGroup),
      });
    }
  }

  return finaliseGroups(market, groups, usedIds);
}

/**
 * Makes every label and id unique across the market.
 *
 * Two published categories can carry the same name in different sections. PH
 * files "Sports & Outdoor" twice, once under Fashion at 6.8%/8.3% and once
 * under its own section at 6.4%/7.7%, and "Pre-Owned" three times. A selector
 * showing the same name twice cannot be chosen between, and the two sports
 * entries are priced differently, so this is a correctness problem rather than
 * a cosmetic one.
 *
 * A repeated label is therefore qualified with the section it belongs to. Ids
 * are built from the final label so they stay in step with it. Nothing is
 * merged: two rows with different rates are two rows.
 */
function finaliseGroups<T extends TierableCategory>(
  market: string,
  groups: CategoryGroup<T>[],
  usedIds: Map<string, number>
): CategoryGroup<T>[] {
  const labelCounts = new Map<string, number>();
  for (const group of groups) {
    const key = group.label.toLowerCase();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }

  return groups.map((group) => {
    const isRepeated = (labelCounts.get(group.label.toLowerCase()) ?? 0) > 1;
    const section = group.parentCategory?.trim();
    const label =
      isRepeated && section && section.toLowerCase() !== group.label.toLowerCase()
        ? `${group.label} (${section})`
        : group.label;

    return { ...group, label, id: uniqueGroupId(market, label, usedIds) };
  });
}

/**
 * Re-joins single-row groups whose labels would be identical.
 *
 * Runs only on the untiered path, so a market that publishes distinct rows
 * under one parent (US, UK) keeps every one of them: their names differ, so
 * nothing is merged. Rows that would render as the same option are collapsed
 * into one group rather than shown twice under the same heading.
 */
function mergeIndistinguishable<T extends TierableCategory>(candidates: T[][]): T[][] {
  const byLabel = new Map<string, T[]>();

  for (const [row] of candidates) {
    const label = groupLabel([row]);
    const existing = byLabel.get(label);
    if (existing) existing.push(row);
    else byLabel.set(label, [row]);
  }

  return [...byLabel.values()];
}

function hasMallRate(rows: readonly TierableCategory[]): boolean {
  return rows.some((row) => typeof row.mallRate === 'number');
}

/**
 * Builds a unique, stable group id and records it so a later collision can be
 * suffixed rather than overwriting an existing group.
 */
function uniqueGroupId(
  market: string,
  label: string,
  used: Map<string, number>
): string {
  const base = `${market.toLowerCase()}-${slugify(label) || 'category'}`;
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

/**
 * The channels a row can price, in selector order.
 *
 * Two shapes exist in the data and they must not be read the same way.
 *
 * MY and SG publish one row per (category, tier), so the row's own `tier`
 * label is the tier and the union of a group's labels is what it can price.
 *
 * PH publishes one row per category and stores both of its channels on that
 * record: `rate` is Marketplace and `mallRate` is Mall. Its `tier` label is
 * therefore *the record's default channel*, not the set of channels it can
 * price, and all 63 rows are labelled "Marketplace" even though every one also
 * carries a Mall rate. Reading availability from the distinct labels yields a
 * single tier, the market looks untiered, and the Seller tier control does not
 * render at all. A row carrying `mallRate` is therefore read structurally and
 * its label is deliberately not consulted.
 */
function tiersForGroup(rows: readonly TierableCategory[]): CanonicalSellerTier[] {
  const found = new Set<CanonicalSellerTier>();

  if (hasMallRate(rows)) {
    // `rate` is the Marketplace channel; `hasMallRate` guarantees at least one
    // numeric `mallRate`, so the Mall channel is available too.
    found.add('marketplace');
    found.add('mall');
  } else {
    for (const row of rows) {
      const tier = normalizeSellerTier(row.tier);
      if (tier) found.add(tier);
    }
  }

  return TIER_ORDER.filter((tier) => found.has(tier));
}

/**
 * Seller tiers a market is known to offer, declared rather than inferred.
 *
 * Only PH needs this. Where a market's file shape makes the channel set
 * ambiguous, the model states it here, so a label that means "default" can
 * never be mistaken for a single-option market. The declaration is still
 * intersected with what the data can actually price, so it can describe the
 * model but cannot invent a rate.
 */
const DECLARED_MARKET_TIERS: Readonly<Record<string, readonly CanonicalSellerTier[]>> = {
  PH: ['marketplace', 'mall'],
};

/**
 * Every tier the market can price, across all its groups.
 *
 * This is what the seller-tier selector offers. A market offers nothing when it
 * has a single tier, because a one-option control is not a choice.
 */
export function availableSellerTiers(
  market: string,
  rows: readonly TierableCategory[]
): CanonicalSellerTier[] {
  const found = new Set<CanonicalSellerTier>();
  for (const group of groupCategories(market, rows)) {
    for (const tier of group.tiers) found.add(tier);
  }
  const supported = TIER_ORDER.filter((tier) => found.has(tier));

  const declared = DECLARED_MARKET_TIERS[market.toUpperCase()];
  if (!declared) return supported;

  return TIER_ORDER.filter((tier) => declared.includes(tier) && supported.includes(tier));
}

/** Whether the seller-tier selector should be shown for this market. */
export function hasSellerTierChoice(
  market: string,
  rows: readonly TierableCategory[]
): boolean {
  return availableSellerTiers(market, rows).length > 1;
}

/**
 * Resolves a group's row for the selected seller tier.
 *
 * The tier is matched against the row's canonical token, never against the
 * group's identity, so a category that supports several tiers prices the one
 * the user actually chose. Returns null when the group has no published row for
 * that tier, which callers must report as unpriced rather than substituting a
 * neighbouring rate.
 */
export function resolveGroupRow<T extends TierableCategory>(
  group: CategoryGroup<T>,
  tier: CanonicalSellerTier | null
): T | null {
  if (!tier) {
    // A group with exactly one row can be priced without a tier choice; a
    // multi-row group cannot, because the rows differ by tier.
    return group.rows.length === 1 ? group.rows[0] : null;
  }

  const byTier = group.rows.find(
    (row) => normalizeSellerTier(row.tier) === tier
  );
  if (byTier) return byTier;

  // PH prices both tiers from one record, so a `mallRate` hit is a tier hit.
  if (tier === 'mall' && group.rows.some((row) => typeof row.mallRate === 'number')) {
    return group.rows.find((row) => typeof row.mallRate === 'number') ?? null;
  }
  if (
    tier === 'marketplace' &&
    group.rows.every((row) => typeof row.mallRate === 'number')
  ) {
    return group.rows[0] ?? null;
  }

  return null;
}

/**
 * Resolves `inputs.categoryId` to a rate row.
 *
 * Accepts either a group id (what the form now sends) or a raw rate-row id
 * (what the engines, tests and any saved link may still carry). A raw row id is
 * translated into its group and then re-resolved against the selected tier, so
 * a legacy id cannot reintroduce the F-01 defect by pinning one tier.
 */
export function findCategoryRow<T extends TierableCategory>(
  market: string,
  rows: readonly T[],
  categoryId: string,
  tier: CanonicalSellerTier | null
): T | null {
  const groups = groupCategories(market, rows);

  const byId = groups.find((group) => group.id === categoryId);
  if (byId) return resolveGroupRow(byId, tier);

  const group = groups.find((candidate) =>
    candidate.rows.some((row) => row.id === categoryId)
  );
  if (!group) return null;

  if (group.rows.length === 1) return group.rows[0];
  return resolveGroupRow(group, tier) ?? group.rows[0];
}

/** Looks up a single group by id. */
export function findCategoryGroup<T extends TierableCategory>(
  market: string,
  rows: readonly T[],
  categoryId: string
): CategoryGroup<T> | null {
  return groupCategories(market, rows).find((group) => group.id === categoryId) ?? null;
}
