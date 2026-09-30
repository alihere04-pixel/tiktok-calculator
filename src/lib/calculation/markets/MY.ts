import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import {
  findCategoryRow,
  normalizeSellerTier,
  sellerTierLabel,
  type CanonicalSellerTier,
} from '@/lib/rates/tiers';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';

const MY_SOURCES = {
  commission:
    'https://seller-my.tiktok.com/university/essay?knowledge_id=6907739532281602',
  platformSupport:
    'https://seller-my.tiktok.com/university/essay?knowledge_id=7992113007347457',
};

const MY_PLATFORM_SUPPORT_FEE = 0.54; // MYR per order, from Feb 15, 2026

/**
 * The four MY bands, in selector order.
 *
 * MY is the reason the rate file stores one row per (category, tier): the band
 * a category is charged at depends on both whether the seller is BXP-enrolled
 * and whether they trade in Mall. The rows are grouped by category in
 * `@/lib/rates/tiers`, so the form offers one "Electronics" and one "Toys"
 * option and the tier picks the row.
 */
const MY_TIERS: readonly CanonicalSellerTier[] = [
  'bxp-marketplace',
  'bxp-mall',
  'non-bxp-marketplace',
  'non-bxp-mall',
];

/** The band used when the seller has not chosen one. */
const MY_DEFAULT_TIER: CanonicalSellerTier = 'non-bxp-marketplace';

/**
 * Published commission band per tier, read from `knownRanges` in the rate file
 * so the calculator quotes exactly the string the fee page shows. A band is a
 * set of bounds; it is never reduced to a single point, because the midpoint is
 * a rate TikTok has never published and a seller could act on.
 */
const MY_RANGE_KEYS: Record<string, string> = {
  'bxp-marketplace': 'bxpMarketplace',
  'bxp-mall': 'bxpMall',
  'non-bxp-marketplace': 'nonBxpMarketplace',
  'non-bxp-mall': 'nonBxpMall',
};

function publishedBand(rates: MarketRateData, tier: CanonicalSellerTier): string {
  const key = MY_RANGE_KEYS[tier];
  return (key && rates.knownRanges?.[key]) || 'not published for this tier';
}

/**
 * The band to charge.
 *
 * The tier the user selected is authoritative. The previous implementation
 * let the selected category's own `tier` field override it, which meant the
 * Non-BXP Mall and BXP Mall published rates were unreachable no matter what the
 * seller chose. Any legacy call that passed a full label (rather than a
 * canonical token) is still accepted and normalised here.
 */
function resolveTier(inputs: CalculatorInputs): CanonicalSellerTier {
  const normalized = normalizeSellerTier(inputs.sellerTier);
  if (normalized && MY_TIERS.includes(normalized)) return normalized;
  return MY_DEFAULT_TIER;
}

function buildMYFees(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  const fees: FeeBreakdownItem[] = [];

  // Item Price - Seller Discount
  const netSales = inputs.sellingPrice - inputs.sellerDiscount;
  // Customer Payment = Item Price - Seller Discount + Customer Shipping
  const customerPayment = netSales + inputs.customerShipping;

  const tier = resolveTier(inputs);
  const tierName = sellerTierLabel(tier);
  const extraFees = rates.additionalFees ?? {};

  // Commission. Note that 4.86% is the lower bound of the BXP Marketplace
  // commission range, not a separate fee stacked on top of commission, so it is
  // never charged as an extra line item here.
  const category: CategoryRate | null = findCategoryRow(
    'MY',
    rates.categories,
    inputs.categoryId,
    tier
  );

  if (category) {
    fees.push({
      name: 'Commission Fee',
      rate: `${(category.rate * 100).toFixed(3)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * category.rate),
      pricing: 'priced',
      sourceUrl: category.sourceUrl || rates.sourceUrl,
      effectiveDate: category.sourceDate || rates.sourceDate,
      lastVerified: category.lastVerified || rates.lastVerified,
      confidence: category.confidence,
      notes: `${category.notes ?? ''} Seller tier: ${tierName}. SST inclusive.`.trim(),
    });
  } else {
    // MY's rate table is examples-only, so a category/tier pair with no
    // published row is common rather than exceptional. The commission is quoted
    // as a band and left unpriced: it is excluded from the fee total and marks
    // the calculation incomplete, because guessing a point rate would overstate
    // profit.
    const band = publishedBand(rates, tier);
    fees.push({
      name: 'Commission Fee',
      rate: band,
      base: 0,
      amount: 0,
      pricing: 'unpriced',
      sourceUrl: rates.sourceUrl,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: 'needs-verification',
      notes:
        `No MY rate-table entry for "${inputs.categoryId}" on the ${tierName} tier, so the commission is not priced. ` +
        `The published band for this tier is ${band}; the midpoint of a band is not a published rate and is deliberately not used. ` +
        'This is excluded from the fee total, and the result is incomplete until you verify the rate in Seller Centre. ' +
        'MY category coverage is examples-only. SST inclusive.',
    });
  }

  // Transaction fee: 3.78% on Customer Payment, SST inclusive.
  const transactionFee = extraFees.transactionFee;
  const transactionRate = transactionFee?.rate ?? 0.0378;

  fees.push({
    name: 'Transaction Fee',
    rate: `${(transactionRate * 100).toFixed(2)}%`,
    base: roundToTwo(customerPayment),
    amount: roundToTwo(customerPayment * transactionRate),
    pricing: 'priced',
    sourceUrl: MY_SOURCES.commission,
    effectiveDate: transactionFee?.effectiveFrom ?? rates.sourceDate,
    lastVerified: rates.lastVerified,
    confidence: transactionFee?.confidence ?? 'high',
    notes: `${(transactionRate * 100).toFixed(2)}% on Customer Payment, including customer shipping. SST inclusive.`,
  });

  // Platform Support Fee: RM 0.54 per order from Feb 15, 2026.
  const supportFee = extraFees.platformSupportFee;
  const supportAmount = supportFee?.rate ?? MY_PLATFORM_SUPPORT_FEE;
  const supportDate = supportFee?.effectiveFrom ?? '2026-02-15';

  fees.push({
    name: 'Platform Support Fee',
    rate: `RM ${supportAmount.toFixed(2)}/order`,
    base: 1,
    amount: roundToTwo(supportAmount),
    pricing: 'priced',
    sourceUrl: MY_SOURCES.platformSupport,
    effectiveDate: supportDate,
    lastVerified: rates.lastVerified,
    confidence: supportFee?.confidence ?? 'high',
    notes: `Flat RM ${supportAmount.toFixed(2)} Platform Support Fee per order, effective ${supportDate}. SST inclusive.`,
  });

  // Dynamic Commission (4%-6%, capped at RM 650,000 per item) is deliberately
  // not modelled. It used to be reachable only through an untyped
  // `isDynamicCommission` cast on the inputs that no form control ever set, so
  // the branch was dead code in the product. It is removed rather than wired to
  // an invented trigger: `isGMVMaxActive` is a different programme, and the
  // sub-category rates are not published, so there is no way to price it. The
  // published band remains in the rate file for reference.

  if (inputs.isPreOrder) {
    const preOrderFee = extraFees.preOrderFee;
    const preOrderRate = preOrderFee?.rate ?? 0.02;
    const preOrderDate = preOrderFee?.effectiveFrom ?? '2025-11-24';
    fees.push({
      name: 'Pre-order Fee',
      rate: `${(preOrderRate * 100).toFixed(2)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * preOrderRate),
      pricing: 'priced',
      sourceUrl: MY_SOURCES.commission,
      effectiveDate: preOrderDate,
      lastVerified: rates.lastVerified,
      confidence: preOrderFee?.confidence ?? 'high',
      notes: `${(preOrderRate * 100).toFixed(2)}% pre-order fee from ${preOrderDate}, applied to (Item Price - Seller Discount). SST inclusive.`,
    });
  }

  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * (inputs.affiliateRate / 100)),
      pricing: 'priced',
      sourceUrl: MY_SOURCES.commission,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: 'high',
      notes: `Affiliate commission on (Item Price - Seller Discount). Mode: ${inputs.affiliateMode}.`,
    });
  }

  return fees;
}

export async function calculateMYFees(
  inputs: CalculatorInputs
): Promise<FeeBreakdownItem[]> {
  return buildMYFees(inputs, loadMarketRatesSync('MY'));
}

export function calculateMYFeesSync(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  return buildMYFees(inputs, rates);
}
