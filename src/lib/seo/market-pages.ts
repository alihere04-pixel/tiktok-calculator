import type { Market, ConfidenceLevel } from '@/lib/calculation/types';
import type { MarketRateData, CategoryRate } from '@/lib/rates/schema';
import { feeToLine, formatRate, type FeeLine, type FeeRateValue } from './format';

/**
 * Static content model for the five `/[market]/tiktok-shop-fees` pages.
 *
 * Everything a page renders is derived here, at build time, from the rate files
 * via the loader. Two rules govern this module:
 *
 *   1. No number is ever invented. Every rate on a page comes from a rate file.
 *      Where a rate file has nothing, the section reports
 *      `status: 'unverified'` and the component draws a disclosure card.
 *   2. All eight PRD sections are always present. Nothing is dropped, so the
 *      page shape is identical across all five markets and a reader always gets
 *      the same eight sections in the same order.
 *
 * Because the data is read from JSON at build time, adding a verified rate to a
 * rate file later makes the corresponding disclosure card disappear and be
 * replaced by the real table, with no change to these components.
 */

export type SectionData<T> =
  | { status: 'available'; data: T }
  | { status: 'unverified'; reason: string; guidance?: string };

export interface MarketPageMeta {
  slug: string;
  market: Market;
  /** "TikTok Shop US" */
  marketName: string;
  countryName: string;
  currency: string;
  h1: string;
  title: string;
  ogTitle: string;
}

export interface CategoryRateRow {
  id: string;
  name: string;
  rateLabel: string;
  secondaryRateLabel?: string;
  tier?: string;
  /**
   * The parent category, carried for search and for markets that publish
   * sub-categories. UK lists 116 sub-categories under Beauty & Personal Care,
   * where a bare name like "Accessories" is ambiguous without it.
   *
   * Only rendered when a page asks for it, so the other four market tables stay
   * byte-identical.
   */
  parentLabel?: string;
  confidence: ConfidenceLevel;
}

export interface CategoryExceptionRow {
  category: string;
  detail: string;
  confidence: ConfidenceLevel;
}

export interface AdditionalFeeSection {
  /** Shown above the table, e.g. "Additional per-order and program fees". */
  intro: string;
  lines: FeeLine[];
}

export interface RefundAdminFeeSection {
  marketLabel: string;
}

export interface NewSellerPromoSection {
  rateLabel: string;
  confidence: ConfidenceLevel;
  notes: string;
}

export interface AffiliateSection {
  marketName: string;
  /** Present only when a rate file actually populates `affiliate`. */
  config?: {
    openCollabRange: [number, number];
    targetedCollabRange: [number, number];
    shopAdsMinRatio: number;
    decreaseProtectionDays: number;
    sourceUrl: string;
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface MarketPageModel {
  meta: MarketPageMeta;
  currency: string;
  intro: string;
  lastUpdated: string;
  sourceDate: string;
  lastVerified: string;
  coverage: string;
  sourceUrl: string;
  coverageNote: string;
  categoryRates: CategoryRateRow[];
  rateRangeNote: string;
  transactionFees: SectionData<FeeLine[]>;
  fixedFees: SectionData<AdditionalFeeSection>;
  exceptions: CategoryExceptionRow[];
  tierNotes: string[];
  knownRanges: { key: string; label: string }[];
  refundAdminFee: SectionData<RefundAdminFeeSection>;
  newSellerPromo: SectionData<NewSellerPromoSection>;
  affiliate: SectionData<AffiliateSection>;
  faq: FaqItem[];
}

/**
 * The five markets, in the order the PRD lists them.
 *
 * `slug` is the URL segment; `market` is the code the rate files and the
 * calculation engine use. They are kept separate because the slug is lowercase
 * and the market code is not.
 */
export const SEO_MARKETS: MarketPageMeta[] = [
  {
    slug: 'us',
    market: 'US',
    marketName: 'TikTok Shop US',
    countryName: 'United States',
    currency: 'USD',
    h1: 'US TikTok Shop Seller Fees (2026)',
    title: 'TikTok Shop US Seller Fees (2026)',
    ogTitle: 'TikTok Shop US Seller Fees (2026) - Full Breakdown',
  },
  {
    slug: 'uk',
    market: 'UK',
    marketName: 'TikTok Shop UK',
    countryName: 'United Kingdom',
    currency: 'GBP',
    h1: 'UK TikTok Shop Seller Fees (2026)',
    title: 'TikTok Shop UK Seller Fees (2026)',
    ogTitle: 'TikTok Shop UK Seller Fees (2026) - Full Breakdown',
  },
  {
    slug: 'my',
    market: 'MY',
    marketName: 'TikTok Shop Malaysia',
    countryName: 'Malaysia',
    currency: 'MYR',
    h1: 'Malaysia TikTok Shop Seller Fees (2026)',
    title: 'TikTok Shop Malaysia Seller Fees (2026)',
    ogTitle: 'TikTok Shop Malaysia Seller Fees (2026) - Full Breakdown',
  },
  {
    slug: 'sg',
    market: 'SG',
    marketName: 'TikTok Shop Singapore',
    countryName: 'Singapore',
    currency: 'SGD',
    h1: 'Singapore TikTok Shop Seller Fees (2026)',
    title: 'TikTok Shop Singapore Seller Fees (2026)',
    ogTitle: 'TikTok Shop Singapore Seller Fees (2026) - Full Breakdown',
  },
  {
    slug: 'ph',
    market: 'PH',
    marketName: 'TikTok Shop Philippines',
    countryName: 'Philippines',
    currency: 'PHP',
    h1: 'Philippines TikTok Shop Seller Fees (2026)',
    title: 'TikTok Shop Philippines Seller Fees (2026)',
    ogTitle: 'TikTok Shop Philippines Seller Fees (2026) - Full Breakdown',
  },
];

export const SEO_SLUGS = SEO_MARKETS.map((m) => m.slug);

export function metaForSlug(slug: string): MarketPageMeta | undefined {
  return SEO_MARKETS.find((m) => m.slug === slug);
}

function formatThreshold(threshold: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency,
    maximumFractionDigits: 0,
  })
    .format(threshold)
    .replace(/\u00a0/g, ' ');
}

function toCategoryRow(category: CategoryRate): CategoryRateRow {
  const row: CategoryRateRow = {
    id: category.id,
    name: category.name,
    rateLabel: formatRate(category.rate),
    confidence: category.confidence,
  };
  if (typeof category.mallRate === 'number') {
    row.secondaryRateLabel = `Mall ${formatRate(category.mallRate)}`;
  }
  if (category.tier) row.tier = category.tier;
  // Carried on every row so `CategoryTableFilter` can match a parent category
  // as well as a sub-category name. Whether it is displayed is decided by the
  // table, which keeps the other four market pages unchanged.
  row.parentLabel = category.parentCategory;
  return row;
}

/**
 * Lowest and highest headline rate on the page.
 *
 * This is deliberately a range rather than a single "standard" number: the rate
 * files disagree about what a default is (UK carries an explicit `defaultRate`,
 * PH carries dated `defaultRates`, US and SG carry none), so quoting one figure
 * as "the" rate would be an invention. A range is always defensible.
 *
 * Promotional zero rates are excluded from the range. UK stores its new seller
 * promotion as a 0% category, and folding that in would report UK's range as
 * "0% to 9%" and make the page look like most UK categories are free. The
 * promotion is called out in its own section instead.
 */
function buildRateRangeNote(categories: CategoryRate[]): string {
  if (categories.length === 0) return 'No category rates are published for this market.';

  const isPromo = (c: CategoryRate) => c.rate === 0 && /promo/i.test(c.name);
  const standard = categories.filter((c) => !isPromo(c));
  const pool = standard.length > 0 ? standard : categories;

  const min = Math.min(...pool.map((c) => c.rate));
  const max = Math.max(...pool.map((c) => c.rate));
  const promoNote =
    standard.length !== categories.length
      ? ` This excludes the promotional rate, which is listed separately.`
      : '';

  if (min === max) return `Every category on this page is charged ${formatRate(min)}.${promoNote}`;
  return `Headline commission across the categories below ranges from ${formatRate(min)} to ${formatRate(max)}.${promoNote}`;
}

/**
 * Category-level exceptions.
 *
 * Only genuine *rules* belong here, and only when a default rate exists to
 * compare against:
 *
 *   - a `tieredThreshold` rule, which changes the rate above an order value
 *   - a promotional zero rate
 *   - a rate that differs from an explicit market default, which is what makes
 *     UK's "Electronics 5%" an exception against its 9% standard
 *
 * A separate Mall rate is deliberately NOT listed as an exception. PH stores
 * one on all 63 categories, so treating it as an exception produced 54 cards
 * that restated the Mall rate already shown in the category table. It is
 * rendered inline in the table's secondary rate cell instead.
 *
 * The same reasoning applies to a rate that *many* categories share. UK
 * publishes a full 343-row Excel table in which 127 categories sit at 5% and
 * the other 216 at the 9% default, so listing every 5% row produced 130 cards
 * that restated the category table. Once a single off-default rate covers more
 * than a handful of categories it is summarised as one row: at that point it
 * is the market's second rate, not a list of exceptions. The individual
 * categories stay in the table, so nothing is hidden by the collapse.
 *
 * A market with no recorded rule set (SG, MY) gets an empty list and the page
 * says so, rather than a padded one.
 */
const DEVIATION_COLLAPSE_THRESHOLD = 4;

/** Weakest confidence in the group, so a summary never overstates certainty. */
const CONFIDENCE_RANK: ConfidenceLevel[] = [
  'high',
  'medium',
  'low',
  'needs-verification',
];

function weakestConfidence(categories: CategoryRate[]): ConfidenceLevel {
  return categories.reduce<ConfidenceLevel>(
    (weakest, category) =>
      CONFIDENCE_RANK.indexOf(category.confidence) > CONFIDENCE_RANK.indexOf(weakest)
        ? category.confidence
        : weakest,
    'high'
  );
}

function buildExceptions(data: MarketRateData): CategoryExceptionRow[] {
  const rows: CategoryExceptionRow[] = [];
  const defaultRate = data.defaultRate;

  // Deviations from the market default, bucketed by their own rate.
  const deviations = new Map<number, CategoryRate[]>();

  for (const category of data.categories) {
    for (const rule of category.specialRules ?? []) {
      if (rule.type !== 'tieredThreshold') continue;
      const threshold = rule.threshold;
      const above = rule.rateAboveThreshold;
      if (typeof threshold !== 'number' || typeof above !== 'number') continue;
      rows.push({
        category: category.name,
        detail:
          rule.description ??
          `Any portion of the sale over ${formatThreshold(threshold, data.currency)} is charged ${formatRate(above)} instead of ${formatRate(category.rate)}.`,
        confidence: category.confidence,
      });
    }

    // A zero rate is a promotion, and belongs with the other exceptions.
    if (category.rate === 0) {
      rows.push({
        category: category.name,
        detail: `Promotional rate of ${formatRate(0)} rather than the standard rate.`,
        confidence: category.confidence,
      });
      continue;
    }

    // Only meaningful where the market actually publishes a default to differ
    // from. Without one, "differs from the standard rate" has no referent.
    if (defaultRate !== undefined && category.rate !== defaultRate) {
      const bucket = deviations.get(category.rate);
      if (bucket) bucket.push(category);
      else deviations.set(category.rate, [category]);
    }
  }

  for (const [rate, categories] of deviations) {
    const standard = formatRate(defaultRate as number);
    if (categories.length > DEVIATION_COLLAPSE_THRESHOLD) {
      rows.push({
        category: `${categories.length} categories at ${formatRate(rate)}`,
        detail: `Charged ${formatRate(rate)} instead of the ${standard} standard rate. Each one is listed in the category table below.`,
        confidence: weakestConfidence(categories),
      });
      continue;
    }
    for (const category of categories) {
      rows.push({
        category: category.name,
        detail: `${formatRate(rate)} instead of the ${standard} standard rate.`,
        confidence: category.confidence,
      });
    }
  }

  return rows;
}

/**
 * Tier summary and dated default rates, e.g. BXP vs Standard in SG.
 *
 * A tier that spans many categories collapses to a range. PH's Marketplace tier
 * covers all 63 categories at 21 distinct rates, and listing all 21 told the
 * reader nothing that a range does not tell them better.
 */
function buildTierNotes(data: MarketRateData): string[] {
  const notes: string[] = [];
  const tiers = new Map<string, number[]>();

  for (const category of data.categories) {
    if (!category.tier) continue;
    if (!tiers.has(category.tier)) tiers.set(category.tier, []);
    tiers.get(category.tier)!.push(category.rate);
  }

  for (const [tier, rates] of tiers) {
    // De-duplicate before sorting: SG's Standard tier lists 8.175% twice
    // because two categories share it, and repeating a rate reads as a typo.
    const sorted = [...new Set(rates)].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const label =
      min === max ? formatRate(min) : sorted.length > 4 ? `${formatRate(min)} - ${formatRate(max)}` : sorted.map(formatRate).join(', ');
    notes.push(`${tier}: ${label}`);
  }

  if (data.defaultRate !== undefined) {
    notes.unshift(`Standard rate for most categories: ${formatRate(data.defaultRate)}.`);
  }

  for (const [key, value] of Object.entries(data.defaultRates ?? {})) {
    const parts = Object.entries(value).map(([k, v]) => `${k} ${formatRate(v)}`);
    notes.push(`${key}: ${parts.join(', ')}.`);
  }

  return notes;
}

/** Transaction fee. Only SG and MY publish one in `additionalFees`. */
function buildTransactionFees(data: MarketRateData): SectionData<FeeLine[]> {
  const fee = data.additionalFees?.transactionFee;
  if (!fee) {
    return {
      status: 'unverified',
      reason: `We have not verified a separate per-transaction fee for ${data.market}. Some markets fold this into the category commission rate instead.`,
      guidance: 'Check the Fees tab in Seller Center before you rely on this number.',
    };
  }
  return { status: 'available', data: [feeToLine('Transaction fee', fee, data.currency)] };
}

/** Per-order, program and cap fees. Today only MY has any. */
function buildFixedFees(data: MarketRateData): SectionData<AdditionalFeeSection> {
  const lines: FeeLine[] = [];

  for (const [label, fee] of Object.entries(data.fixedFees ?? {})) {
    lines.push(feeToLine(label, fee, data.currency));
  }

  for (const [key, fee] of Object.entries(data.additionalFees ?? {})) {
    if (key === 'transactionFee') continue;
    lines.push(feeToLine(prettyFeeKey(key), fee, data.currency));
  }

  if (lines.length === 0) {
    return {
      status: 'unverified',
      reason: `No per-order or fixed fees for ${data.market} are in our verified dataset.`,
      guidance: 'Seller Center is the authority for any fixed or per-order charge.',
    };
  }

  return {
    status: 'available',
    data: {
      intro:
        'These sit on top of the category commission rate. They are not a percentage of the same base in every case, so read the basis column.',
      lines,
    },
  };
}

/**
 * Turns a camelCase fee key into a display label: `bxpServiceFee` becomes
 * "BXP Service Fee". The acronym table exists because a naive capitalisation
 * turns "Bxp" into a word TikTok Shop never uses.
 */
const FEE_ACRONYMS: Record<string, string> = { bxp: 'BXP' };

function prettyFeeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (FEE_ACRONYMS[lower]) return FEE_ACRONYMS[lower];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * US-only section per the PRD. No rate file records a refund administration
 * fee, so this is currently a disclosure card for every market that shows it.
 */
function buildRefundAdminFee(data: MarketRateData): SectionData<RefundAdminFeeSection> {
  return {
    status: 'unverified',
    reason: 'The refund administration fee rate is not in our verified dataset.',
    guidance: `Check the Fees and Refunds tabs in TikTok Seller ${data.market} for the rate that applies to your account.`,
  };
}

/**
 * New seller promotion. Only UK publishes one in our data, as a 0% category.
 * Detected by name rather than hard-coded per market, so a promo added to
 * another market's rate file is picked up automatically.
 */
function buildNewSellerPromo(data: MarketRateData): SectionData<NewSellerPromoSection> {
  const promo = data.categories.find((c) => /promo/i.test(c.name));
  if (!promo) {
    return {
      status: 'unverified',
      reason: `We have not verified a new seller promotional rate for ${data.market}.`,
      guidance: 'New seller promotions are account-specific and time-limited; check your Seller Center invite.',
    };
  }
  return {
    status: 'available',
    data: {
      rateLabel: formatRate(promo.rate),
      confidence: promo.confidence,
      notes:
        promo.notes ??
        'Promotional rates are usually time-limited and tied to an invite. Confirm the end date in Seller Center before you plan around it.',
    },
  };
}

/**
 * Affiliate commission.
 *
 * The structural explainer (open collaboration, targeted collaboration, shop
 * ads) is always shown because those three models are what TikTok Shop sells
 * against, and they are the reason a seller needs to think about this fee at
 * all.
 *
 * No numeric range is quoted. Our rate files do not populate `affiliate` for any
 * market, and the schema only declares validation bounds for those fields
 * (a two-element array of values between 0 and 1), not a published rate range.
 * Quoting a range here would be inventing it. If a rate file later populates
 * `affiliate`, the real numbers are added to the table and the disclosure card
 * is replaced automatically.
 */
function buildAffiliate(data: MarketRateData): SectionData<AffiliateSection> {
  const config = data.affiliate;

  if (!config) {
    return {
      status: 'unverified',
      reason: 'We do not have verified affiliate commission rates for this market.',
      guidance:
        'Commission is set per creator agreement rather than published as a single platform rate, so it is only visible in your Seller Center affiliate tools.',
    };
  }

  // The Zod schema validates both ranges as a two-element array, but infers
  // `number[]` rather than a tuple, so the length has to be re-checked here
  // before the values are narrowed to a tuple for display. A range that did not
  // survive validation is treated as absent rather than rendered half-formed.
  const open = config.openCollabRange;
  const targeted = config.targetedCollabRange;
  if (
    !Array.isArray(open) ||
    !Array.isArray(targeted) ||
    open.length < 2 ||
    targeted.length < 2
  ) {
    return {
      status: 'unverified',
      reason: 'We do not have verified affiliate commission rates for this market.',
      guidance:
        'Commission is set per creator agreement rather than published as a single platform rate, so it is only visible in your Seller Center affiliate tools.',
    };
  }

  return {
    status: 'available',
    data: {
      marketName: data.market,
      config: {
        openCollabRange: [open[0], open[1]],
        targetedCollabRange: [targeted[0], targeted[1]],
        shopAdsMinRatio: config.shopAdsMinRatio,
        decreaseProtectionDays: config.decreaseProtectionDays,
        sourceUrl: config.sourceUrl,
      },
    },
  };
}

function buildFaq(data: MarketRateData, rangeNote: string, sourceUrl: string): FaqItem[] {
  const items: FaqItem[] = [
    {
      question: `What commission rate does ${data.market} charge on TikTok Shop?`,
      answer: rangeNote,
    },
    {
      question: 'Are the rates on this page tax inclusive?',
      answer:
        'Each row shows its basis and whether the rate is tax inclusive, taken from the rate file. Where a row does not say, we do not know - treat it as unknown rather than assuming.',
    },
    {
      question: 'How many categories are covered?',
      answer: `${data.categories.length} categories are in our verified dataset for ${data.market}. Our extraction coverage for this market is "${data.coverage}".`,
    },
    {
      question: 'How current is this page?',
      answer: `The underlying rate file is dated ${data.sourceDate} and was last verified ${data.lastVerified}.`,
    },
  ];

  const gap = missingDataNote(data);
  items.push({
    question: `Is anything missing from this page?`,
    answer: gap
      ? `Yes. ${gap} Anything not listed here should be treated as unverified.`
      : 'No. Every category rate in our dataset came from official documentation. Anything not listed here should still be treated as unverified.',
  });

  items.push({
    question: 'How do I confirm these numbers for my own account?',
    answer: `These rates come from official documentation, not from your account. Fees, promotions and commission can differ per seller, so treat the Fees and Affiliate tabs in Seller Center (${sourceUrl}) as the final word.`,
  });

  return items;
}

/**
 * The published `missingData` gap note, or null when nothing is missing.
 *
 * UK records the string "none" rather than leaving the field out, and a bare
 * truthiness check read that as a real gap: the FAQ rendered "Yes. none" and
 * the coverage note said "none". A genuine gap is always descriptive prose
 * (see US, SG and MY), so only an explicit negation counts as "nothing missing".
 */
function missingDataNote(data: MarketRateData): string | null {
  const note = data.missingData?.trim();
  if (!note) return null;
  if (/^(none|n\/a|not applicable|nothing|nil|null)$/i.test(note)) return null;
  return note;
}

/** Builds the full page model for one market from its rate file. */
export function buildMarketPageModel(data: MarketRateData, meta: MarketPageMeta): MarketPageModel {
  const transactionFees = buildTransactionFees(data);
  const fixedFees = buildFixedFees(data);
  const exceptions = buildExceptions(data);
  const rateRangeNote = buildRateRangeNote(data.categories);

  const coverageNote =
    missingDataNote(data) ??
    'All category rates in our dataset came from official documentation.';

  return {
    meta,
    currency: data.currency,
    intro: `Every ${meta.marketName} seller fee we have verified against official documentation, in one place. Rates are pulled from the same data that powers our profit calculator, so the numbers here and the numbers there cannot drift apart.`,
    lastUpdated: data.lastVerified,
    sourceDate: data.sourceDate,
    lastVerified: data.lastVerified,
    coverage: data.coverage,
    sourceUrl: data.sourceUrl,
    coverageNote,
    categoryRates: data.categories.map(toCategoryRow),
    rateRangeNote,
    transactionFees,
    fixedFees,
    exceptions,
    tierNotes: buildTierNotes(data),
    knownRanges: Object.entries(data.knownRanges ?? {}).map(([key, label]) => ({ key, label })),
    refundAdminFee: buildRefundAdminFee(data),
    newSellerPromo: buildNewSellerPromo(data),
    affiliate: buildAffiliate(data),
    faq: buildFaq(data, rateRangeNote, data.sourceUrl),
  };
}

/** FAQ metadata, built from the page model so the two can never disagree. */
export function buildFaqJsonLd(model: MarketPageModel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: model.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** WebPage metadata plus a breadcrumb, for the two things rich results use. */
export function buildWebPageJsonLd(model: MarketPageModel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: model.meta.title,
    description: buildDescription(model),
    inLanguage: 'en',
    dateModified: model.lastUpdated,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: `${model.meta.marketName} Seller Fees`,
          item: `/${model.meta.slug}/tiktok-shop-fees`,
        },
      ],
    },
  };
}

/** Meta description. Built from the model so it always matches the page. */
export function buildDescription(model: MarketPageModel): string {
  const base = `${model.meta.marketName} seller fees for 2026: ${model.categoryRates.length} verified category rates, category exceptions and a free fee estimator.`;
  return base.length > 165 ? `${base.slice(0, 162)}...` : base;
}

export type { FeeLine, FeeRateValue };
