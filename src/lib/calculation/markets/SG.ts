import type {
  CalculatorInputs,
  FeeBreakdownItem,
  SellerTier,
} from '@/lib/calculation/types';
import type { MarketRateData } from '@/lib/rates/schema';
import { findCategoryRow, sellerTierLabel } from '@/lib/rates/tiers';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';

const SG_SOURCES = {
  commission:
    'https://seller-sg.tiktok.com/university/essay?knowledge_id=2161524467910401',
  transaction:
    'https://seller-sg.tiktok.com/university/essay?knowledge_id=2161524467910401',
  preOrder:
    'https://seller-sg.tiktok.com/university/essay?knowledge_id=8168516851353345',
  affiliate:
    'https://seller-sg.tiktok.com/university/essay?knowledge_id=8168516851353345',
};

const SG_TRANSACTION_RATE = 0.0327; // GST inclusive
const SG_PRE_ORDER_RATE = 0.0109; // from Dec 22, 2025
const SG_BXP_SERVICE_FEE_RATE = 0.0327; // mixed BXP orders only
const SG_TRANSACTION_DATE = '2026-04-01';

/**
 * The four SG seller programmes, in selector order.
 *
 * SG's published rate table is keyed by programme, not by seller: the same
 * category is charged a different rate under Standard, BXP, BXP Restricted and
 * BXP Mixed. The rate file stores one row per (category, programme), and
 * `@/lib/rates/tiers` groups them so the form offers one entry per category and
 * the programme the seller is on picks the row.
 */
const SG_TIERS: readonly SellerTier[] = ['standard', 'bxp', 'bxp-restricted', 'bxp-mixed'];

/** The programme charged when the seller has not chosen one. */
const SG_DEFAULT_TIER: SellerTier = 'standard';

function isSGProgram(tier: SellerTier | null): tier is SellerTier {
  return tier !== null && SG_TIERS.includes(tier);
}

/** The programme to price. The seller's explicit selection is authoritative. */
function resolveTier(inputs: CalculatorInputs): SellerTier {
  return isSGProgram(inputs.sellerTier) ? inputs.sellerTier : SG_DEFAULT_TIER;
}

function resolveCluster(categoryId: string): string {
  if (categoryId.includes('electronics')) return 'electronics';
  if (categoryId.includes('lifestyle')) return 'electronics';
  return 'other';
}

function buildSGFees(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  const fees: FeeBreakdownItem[] = [];

  // Item Price - Seller Discount
  const netSales = inputs.sellingPrice - inputs.sellerDiscount;
  // Customer Payment = Item Price - Seller Discount + Customer Shipping
  const customerPayment = netSales + inputs.customerShipping;

  // The seller's selected programme is authoritative. The category supplies the
  // cluster; the programme supplies the rate.
  const status = resolveTier(inputs);
  const tierLabel = sellerTierLabel(status);
  const cluster = resolveCluster(inputs.categoryId);
  const extraFees = rates.additionalFees ?? {};

  // Resolve the row for (category, programme). Because rows are grouped by
  // category, the same category at a different programme resolves to that
  // programme's published rate rather than the one the category was filed under.
  const exactCategory = findCategoryRow(
    'SG',
    rates.categories,
    inputs.categoryId,
    status
  );

  let commissionRate: number;
  let commissionConfidence: FeeBreakdownItem['confidence'];
  let commissionNotes: string;
  let commissionSourceUrl = rates.sourceUrl;
  let commissionPricing: 'priced' | 'unpriced' = 'priced';

  if (exactCategory) {
    commissionRate = exactCategory.rate;
    commissionConfidence = exactCategory.confidence;
    commissionSourceUrl = exactCategory.sourceUrl || rates.sourceUrl;
    commissionNotes = exactCategory.notes ?? '';
  } else {
    // No published row for this category/programme pair. Fall back to the
    // matching "other categories" row for the programme, and if even that is
    // missing, report the fee as unpriced. The previous code substituted 0,
    // which understated fees and overstated profit.
    const FALLBACK_BY_TIER: Partial<Record<SellerTier, string>> = {
      standard: 'sg-other-standard',
      bxp: 'sg-other-bxp',
      'bxp-restricted': 'sg-bxp-restricted-other',
      'bxp-mixed': 'sg-bxp-mixed-other',
    };
    const fallbackId = FALLBACK_BY_TIER[status];
    const fallback = fallbackId
      ? rates.categories.find(c => c.id === fallbackId) ?? null
      : null;

    if (fallback) {
      commissionRate = fallback.rate;
      commissionConfidence = 'needs-verification';
      commissionNotes = `No SG rate-table entry for "${inputs.categoryId}" on the ${tierLabel} programme. Fell back to the ${fallback.name} rate. SG category coverage is cluster-level only.`;
    } else {
      commissionRate = 0;
      commissionConfidence = 'needs-verification';
      commissionPricing = 'unpriced';
      commissionNotes = `No SG rate-table entry for "${inputs.categoryId}" on the ${tierLabel} programme, and no fallback rate is published for it, so the commission is not priced. This is excluded from the fee total, and the result is incomplete until you verify the rate in Seller Centre.`;
    }
  }

  fees.push({
    name: 'Commission Fee',
    rate:
      commissionPricing === 'priced'
        ? `${(commissionRate * 100).toFixed(3)}%`
        : 'not published',
    base: roundToTwo(customerPayment),
    amount: roundToTwo(customerPayment * commissionRate),
    pricing: commissionPricing,
    sourceUrl: commissionSourceUrl,
    effectiveDate: rates.sourceDate,
    lastVerified: rates.lastVerified,
    confidence: commissionConfidence,
    notes:
      commissionNotes ||
      `Commission on Customer Payment for the ${tierLabel} program (${cluster} cluster). GST inclusive.`,
  });

  // BXP service fee: applies to non-restricted products in a mixed BXP order,
  // and never to restricted products. The BXP Mixed programme is what triggers
  // it, so the rate applies whichever BXP variant the seller selected.
  if (status === 'bxp-mixed') {
    const serviceFee = extraFees.bxpServiceFee;
    const serviceRate = serviceFee?.rate ?? SG_BXP_SERVICE_FEE_RATE;
    fees.push({
      name: 'BXP Service Fee',
      rate: `${(serviceRate * 100).toFixed(2)}%`,
      base: roundToTwo(customerPayment),
      amount: roundToTwo(customerPayment * serviceRate),
      pricing: 'priced',
      sourceUrl: rates.sourceUrl,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: serviceFee?.confidence ?? 'high',
      notes: 'Additional 3.27% BXP service fee on non-restricted items in a mixed BXP order. GST inclusive.',
    });
  }

  // Transaction fee: 3.27% on Customer Payment + Platform Discount from
  // Apr 1, 2026. The rate is confirmed; the base change is not.
  const transactionFee = extraFees.transactionFee;
  const transactionRate = transactionFee?.rate ?? SG_TRANSACTION_RATE;
  const transactionBase = customerPayment + inputs.platformDiscount;

  fees.push({
    name: 'Transaction Fee',
    rate: `${(transactionRate * 100).toFixed(2)}%`,
    base: roundToTwo(transactionBase),
    amount: roundToTwo(transactionBase * transactionRate),
    pricing: 'priced',
    sourceUrl: SG_SOURCES.transaction,
    effectiveDate: transactionFee?.effectiveFrom ?? SG_TRANSACTION_DATE,
    lastVerified: rates.lastVerified,
    confidence: transactionFee?.confidence ?? 'medium',
    notes: `${(transactionRate * 100).toFixed(2)}% on Customer Payment + Platform Discount. The rate is confirmed, but the base change could not be verified on the Transaction Fee page. GST inclusive.`,
  });

  if (inputs.isPreOrder) {
    const preOrderFee = extraFees.preOrderFee;
    const preOrderRate = preOrderFee?.rate ?? SG_PRE_ORDER_RATE;
    const preOrderDate = preOrderFee?.effectiveFrom ?? '2025-12-22';
    fees.push({
      name: 'Pre-order Fee',
      rate: `${(preOrderRate * 100).toFixed(2)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * preOrderRate),
      pricing: 'priced',
      sourceUrl: SG_SOURCES.preOrder,
      effectiveDate: preOrderDate,
      lastVerified: rates.lastVerified,
      confidence: preOrderFee?.confidence ?? 'high',
      notes: `${(preOrderRate * 100).toFixed(2)}% pre-order fee from ${preOrderDate}, applied to (Item Price - Seller Discount). GST inclusive.`,
    });
  }

  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * (inputs.affiliateRate / 100)),
      pricing: 'priced',
      sourceUrl: SG_SOURCES.affiliate,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: 'high',
      notes: `Open collaboration commission on (Item Price - Seller Discount). Mode: ${inputs.affiliateMode}.`,
    });
  }

  return fees;
}

export async function calculateSGFees(
  inputs: CalculatorInputs
): Promise<FeeBreakdownItem[]> {
  return buildSGFees(inputs, loadMarketRatesSync('SG'));
}

export function calculateSGFeesSync(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  return buildSGFees(inputs, rates);
}
