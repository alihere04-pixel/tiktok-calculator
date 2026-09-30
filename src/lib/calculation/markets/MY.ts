import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';

const MY_SOURCES = {
  commission:
    'https://seller-my.tiktok.com/university/essay?knowledge_id=6907739532281602',
  platformSupport:
    'https://seller-my.tiktok.com/university/essay?knowledge_id=7992113007347457',
};

const MY_PLATFORM_SUPPORT_FEE = 0.54; // MYR per order, from Feb 15, 2026

type MYTier =
  | 'BXP Marketplace'
  | 'BXP Mall'
  | 'Non-BXP Marketplace'
  | 'Non-BXP Mall';

const MY_TIERS: readonly MYTier[] = [
  'BXP Marketplace',
  'BXP Mall',
  'Non-BXP Marketplace',
  'Non-BXP Mall',
];

/**
 * MY switches that `CalculatorInputs` does not model. The core
 * `sellerTier` union cannot express all four MY combinations (BXP vs Non-BXP
 * crossed with Marketplace vs Mall), so these are read defensively.
 */
interface MYExtraInputs {
  myTier?: MYTier;
  isBxpSeller?: boolean;
  isMall?: boolean;
  isDynamicCommission?: boolean;
}

function getExtra(inputs: CalculatorInputs): MYExtraInputs {
  return inputs as CalculatorInputs & MYExtraInputs;
}

function isMYTier(value: string): value is MYTier {
  return (MY_TIERS as readonly string[]).includes(value);
}

function resolveTier(inputs: CalculatorInputs): MYTier {
  const extra = getExtra(inputs);
  if (extra.myTier) {
    return extra.myTier;
  }

  // The seller-tier control is populated from the `tier` strings in the rate
  // file, so MY stores a full tier label here ("Non-BXP Mall", "BXP Mall", …)
  // rather than one of the shared SellerTier tokens. That label already names
  // the band, so it has to be honoured before the legacy tokens are considered:
  // comparing "Non-BXP Mall" against 'bxp'/'mall' silently resolved every MY
  // seller to Non-BXP Marketplace and made the Non-BXP Mall published rates
  // unreachable.
  const label = inputs.sellerTier as string | null;
  if (label && isMYTier(label)) {
    return label;
  }

  const isBxp = label === 'bxp' || extra.isBxpSeller === true;
  const isMall = label === 'mall' || extra.isMall === true;

  if (isBxp) {
    return isMall ? 'BXP Mall' : 'BXP Marketplace';
  }
  return isMall ? 'Non-BXP Mall' : 'Non-BXP Marketplace';
}

// Selected category tier, when available, is used by resolveTier to pick the
// correct BXP / Non‑BXP band.  The caller (buildMYFees) passes the tier string
// found on the category object so that resolveTier can honour it.
function getCategoryTier(
  inputs: CalculatorInputs,
  rates: MarketRateData
): string | undefined {
  return rates.categories.find((c) => c.id === inputs.categoryId)?.tier;
}

// The published commission band per tier, read from `knownRanges` in the rate
// file so the calculator quotes exactly the string the fee page shows. A band is
// a set of bounds; it is never reduced to a single point, because the midpoint
// is a rate TikTok has never published and a seller could act on.
const MY_RANGE_KEYS: Record<MYTier, string> = {
  'BXP Marketplace': 'bxpMarketplace',
  'BXP Mall': 'bxpMall',
  'Non-BXP Marketplace': 'nonBxpMarketplace',
  'Non-BXP Mall': 'nonBxpMall',
};

function publishedBand(rates: MarketRateData, tier: MYTier): string {
  return (
    rates.knownRanges?.[MY_RANGE_KEYS[tier]] ?? 'not published for this tier'
  );
}

function findCategoryRate(
  rates: MarketRateData,
  categoryId: string,
  tier: MYTier
): CategoryRate | null {
  return (
    rates.categories.find(
      c => c.id === categoryId && (c.tier as string | undefined) === tier
    ) || null
  );
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

  let tier = resolveTier(inputs);
  // Honour the category's own tier label when it is available, so that a
  // BXP‑Mall category is recognised even if the seller‑tier dropdown still
  // shows ‘standard’ or ‘mall’.  Only apply when the category tier does not
  // already indicate a Non‑BXP classification, preserving the existing fallback
  // behaviour for categories whose tier label is “Non‑BXP …”.
  const categoryTier = getCategoryTier(inputs, rates);
  if (categoryTier) {
    if (/BXP Mall/i.test(categoryTier) && !/Non-/.test(categoryTier)) tier = 'BXP Mall';
    else if (/BXP Marketplace/i.test(categoryTier) && !/Non-/.test(categoryTier)) tier = 'BXP Marketplace';
  }
  const extraFees = rates.additionalFees ?? {};

  // Commission. Note that 4.86% is the lower bound of the BXP Marketplace
  // commission range, not a separate fee stacked on top of commission, so it
  // is never charged as an extra line item here.
  const category = findCategoryRate(rates, inputs.categoryId, tier);

  if (category) {
    fees.push({
      name: 'Commission Fee',
      rate: `${(category.rate * 100).toFixed(3)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * category.rate),
      sourceUrl: category.sourceUrl || rates.sourceUrl,
      effectiveDate: category.sourceDate || rates.sourceDate,
      lastVerified: category.lastVerified || rates.lastVerified,
      confidence: category.confidence,
      notes: (category.notes ?? '') + ` Seller tier: ${tier}. SST inclusive.`,
    });
  } else {
    // No published point rate for this category and tier, so the commission is
    // quoted as a band and left unpriced rather than guessed. This mirrors how
    // Dynamic Commission is handled below: an unpriced line carries amount 0,
    // stays out of the fee total, and is flagged for verification.
    const band = publishedBand(rates, tier);
    fees.push({
      name: 'Commission Fee (not calculable)',
      rate: band,
      base: 0,
      amount: 0,
      sourceUrl: rates.sourceUrl,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: 'needs-verification',
      notes:
        `No MY rate-table entry for "${inputs.categoryId}" on the ${tier} tier, so the commission is not priced. ` +
        `The published band for this tier is ${band}; the midpoint of a band is not a published rate and is deliberately not used. ` +
        'This is excluded from the fee total and must be verified in Seller Centre before relying on the result. ' +
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
    sourceUrl: MY_SOURCES.commission,
    effectiveDate: '2025-09-13',
    lastVerified: rates.lastVerified,
    confidence: transactionFee?.confidence ?? 'high',
    notes: '3.78% on Customer Payment, including customer shipping. SST inclusive.',
  });

  // Platform Support Fee: RM 0.54 per order from Feb 15, 2026.
  const supportFee = extraFees.platformSupportFee;
  const supportAmount = supportFee?.rate ?? MY_PLATFORM_SUPPORT_FEE;

  fees.push({
    name: 'Platform Support Fee',
    rate: `RM ${supportAmount.toFixed(2)}/order`,
    base: 1,
    amount: roundToTwo(supportAmount),
    sourceUrl: MY_SOURCES.platformSupport,
    effectiveDate: '2026-02-15',
    lastVerified: rates.lastVerified,
    confidence: supportFee?.confidence ?? 'high',
    notes: 'Flat RM 0.54 Platform Support Fee per order, effective Feb 15, 2026. SST inclusive.',
  });

  // Dynamic Commission: 4%-6% capped at RM 650,000. The exact sub-category
  // rates are not published, so the amount cannot be derived and is reported
  // as an explicit zero rather than being silently folded into commission.
  if (getExtra(inputs).isDynamicCommission) {
    fees.push({
      name: 'Dynamic Commission (not calculable)',
      rate: '4.00% - 6.00%',
      base: 0,
      amount: 0,
      sourceUrl: MY_SOURCES.commission,
      effectiveDate: '2025-06-10',
      lastVerified: rates.lastVerified,
      confidence: 'needs-verification',
      notes: 'Dynamic Commission is capped at RM 650,000 per item, but the sub-category rates are not published, so no amount can be calculated. This is excluded from the fee total and must be verified in Seller Centre before relying on the result.',
    });
  }

  if (inputs.isPreOrder) {
    const preOrderFee = extraFees.preOrderFee;
    const preOrderRate = preOrderFee?.rate ?? 0.02;
    fees.push({
      name: 'Pre-order Fee',
      rate: `${(preOrderRate * 100).toFixed(2)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * preOrderRate),
      sourceUrl: MY_SOURCES.commission,
      effectiveDate: '2025-11-24',
      lastVerified: rates.lastVerified,
      confidence: preOrderFee?.confidence ?? 'high',
      notes: '2% pre-order fee from Nov 24, 2025, applied to (Item Price - Seller Discount). SST inclusive.',
    });
  }

  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * (inputs.affiliateRate / 100)),
      sourceUrl: MY_SOURCES.commission,
      effectiveDate: '2025-09-13',
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
