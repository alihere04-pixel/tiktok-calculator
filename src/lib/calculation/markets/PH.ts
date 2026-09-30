import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import { normalizeSellerTier, findCategoryRow } from '@/lib/rates/tiers';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';

const PH_SOURCES = {
  commission:
    'https://seller-ph.tiktok.com/university/essay?knowledge_id=3157977859229442',
  transaction:
    'https://seller-ph.tiktok.com/university/essay?knowledge_id=2675772847064834',
  affiliate:
    'https://seller-ph.tiktok.com/university/essay?knowledge_id=1859045888018192',
};

const PH_TRANSACTION_RATE = 0.0224; // VAT inclusive
const PH_PRE_ORDER_RATE = 0.02; // from Nov 24, 2025
const PH_SHIPPING_SERVICE_RATE = 0.0525; // + PHP 5 per order
const PH_SHIPPING_SERVICE_FIXED = 5;

const FALLBACK_MARKETPLACE_RATE = 0.067;
const FALLBACK_MALL_RATE = 0.077;

const PH_TRANSACTION_DATE = '2026-05-08';
const PH_COMMISSION_DATE = '2026-05-08';
const PH_PRE_ORDER_DATE = '2025-11-19';

async function getPHRates(): Promise<MarketRateData> {
  return loadMarketRatesSync('PH');
}

/**
 * Whether the seller trades in Mall.
 *
 * Accepts the canonical `mall` token and any published label, so the selector
 * works whether the value came from the form or a legacy caller. PH stores both
 * tiers on one record (`rate` for Marketplace, `mallRate` for Mall), so the
 * distinction lives here rather than in the category id.
 */
function isMallTier(sellerTier: CalculatorInputs['sellerTier']): boolean {
  return normalizeSellerTier(sellerTier) === 'mall';
}

function findCategoryRate(
  rates: MarketRateData,
  categoryId: string,
  sellerTier: CalculatorInputs['sellerTier']
): CategoryRate | null {
  // The selector sends a *group* id, and PH's group ids are not the same string
  // as the underlying row ids: a group is labelled by the row's own name
  // ("Luggage & Bags" -> `ph-luggage-bags`) while the row id carries its section
  // (`ph-fashion-luggage-bags`). 60 of PH's 62 groups differ this way, so a
  // lookup by `category.id` alone failed to match and every such selection fell
  // through to the file-level default, reporting 6.70% for categories whose
  // published rates are 6.80% and 6.90%. `findCategoryRow` accepts either form.
  return findCategoryRow(rates.market, rates.categories, categoryId, normalizeSellerTier(sellerTier));
}

/**
 * Commission rate for the selected category and seller tier.
 *
 * PH publishes both channels on every category record, so a matched category is
 * priced directly. Two different things can go wrong, and they are reported
 * differently:
 *
 *   - The category matched but the record has no rate for the selected channel.
 *     The result is `unpriced`. Substituting a neighbouring rate, or the
 *     file-level default, would state a commission the category was never
 *     published at; a zero would be worse still, claiming the fee is free.
 *   - The category did not match at all, so there is no record to read. The
 *     file-level default is used and marked `needs-verification`, because it is
 *     the best available answer rather than no answer.
 */
function resolveCommissionRate(
  category: CategoryRate | null,
  isMall: boolean,
  rates: MarketRateData
): {
  rate: number | null;
  confidence: FeeBreakdownItem['confidence'];
  isDefault: boolean;
} {
  const defaults = rates.defaultRates?.from2025 ?? {};

  if (category) {
    const rate = isMall ? category.mallRate : category.rate;
    if (typeof rate === 'number') {
      return { rate, confidence: category.confidence, isDefault: false };
    }
    return { rate: null, confidence: 'needs-verification', isDefault: false };
  }

  // No category match.
  return {
    rate: isMall
      ? defaults.mall ?? FALLBACK_MALL_RATE
      : defaults.marketplace ?? FALLBACK_MARKETPLACE_RATE,
    confidence: 'needs-verification',
    isDefault: true,
  };
}

// Category records carry no per-category source metadata, and the rate schema
// fills those gaps with empty strings, so fall back on falsy values.
function pickMeta(
  category: CategoryRate | null,
  rates: MarketRateData
): { sourceUrl: string; sourceDate: string; lastVerified: string } {
  return {
    sourceUrl: category?.sourceUrl || rates.sourceUrl,
    sourceDate: category?.sourceDate || rates.sourceDate,
    lastVerified: category?.lastVerified || rates.lastVerified,
  };
}

function buildPHFees(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  const fees: FeeBreakdownItem[] = [];

  // Item Price - Seller Discount. PH commission and the shipping service fee
  // are charged on the item price, excluding shipping.
  const netPrice = inputs.sellingPrice - inputs.sellerDiscount;
  // Customer Payment = Item Price - Seller Discount + Customer Shipping.
  const customerPayment = netPrice + inputs.customerShipping;

  const isMall = isMallTier(inputs.sellerTier);
  const category = findCategoryRate(rates, inputs.categoryId, inputs.sellerTier);
  const { rate: commissionRate, confidence, isDefault } = resolveCommissionRate(
    category,
    isMall,
    rates
  );
  const { sourceUrl, sourceDate, lastVerified } = pickMeta(category, rates);
  // Named from the seller's selection, never from the category's own `tier`
  // label. PH's rows are all labelled "Marketplace" as their default channel,
  // so reading the label back would contradict a Mall selection and tell the
  // seller they are on a tier they did not pick.
  const tierName = isMall ? 'Mall' : 'Marketplace';

  if (commissionRate === null) {
    // The category was found but carries no rate for the selected channel.
    fees.push({
      name: 'Commission Fee',
      rate: 'not published',
      base: roundToTwo(netPrice),
      amount: 0,
      pricing: 'unpriced',
      sourceUrl,
      effectiveDate: sourceDate,
      lastVerified,
      confidence: 'needs-verification',
      notes:
        `No ${tierName} commission rate is published for "${category?.name ?? inputs.categoryId}". ` +
        `This fee is excluded from the totals, which are therefore a best case. ` +
        `Switch the seller tier or pick another category to price it.`,
    });
  } else {
    fees.push({
      name: 'Commission Fee',
      rate: `${(commissionRate * 100).toFixed(2)}%`,
      base: roundToTwo(netPrice),
      amount: roundToTwo(netPrice * commissionRate),
      pricing: 'priced',
      sourceUrl,
      effectiveDate: sourceDate,
      lastVerified,
      confidence,
      notes:
        `Commission on (Item Price - Seller Discount), excluding shipping. Seller tier: ${tierName}. VAT inclusive.` +
        (isDefault
          ? ` This is the file-level default ${tierName} rate, not a published rate for "${inputs.categoryId}".`
          : ''),
    });
  }

  fees.push({
    name: 'Transaction Fee',
    rate: `${(PH_TRANSACTION_RATE * 100).toFixed(2)}%`,
    base: roundToTwo(customerPayment),
    amount: roundToTwo(customerPayment * PH_TRANSACTION_RATE),
    pricing: 'priced',
    sourceUrl: PH_SOURCES.transaction,
    effectiveDate: PH_TRANSACTION_DATE,
    lastVerified: rates.lastVerified,
    confidence: 'high',
    notes: '2.24% on Customer Payment, including customer shipping. VAT inclusive.',
  });

  if (inputs.isShippingProgramEnrolled) {
    fees.push({
      name: 'Shipping Service Fee',
      rate: `${(PH_SHIPPING_SERVICE_RATE * 100).toFixed(
        2
      )}% + PHP ${PH_SHIPPING_SERVICE_FIXED}/order`,
      base: roundToTwo(netPrice),
      amount: roundToTwo(
        netPrice * PH_SHIPPING_SERVICE_RATE + PH_SHIPPING_SERVICE_FIXED
      ),
      pricing: 'priced',
      sourceUrl: PH_SOURCES.commission,
      effectiveDate: PH_COMMISSION_DATE,
      lastVerified: rates.lastVerified,
      confidence: 'medium',
      notes: 'Shipping Service Fee of 5.25% + PHP 5 per order applies to enrolled sellers. Enrollment is optional and its interaction with customer shipping charges is not confirmed in Seller University.',
    });
  }

  if (inputs.isPreOrder) {
    const preOrderFee = rates.additionalFees?.preOrderFee;
    const preOrderRate = preOrderFee?.rate ?? PH_PRE_ORDER_RATE;
    fees.push({
      name: 'Pre-order Service Fee',
      rate: `${(preOrderRate * 100).toFixed(2)}%`,
      base: roundToTwo(netPrice),
      amount: roundToTwo(netPrice * preOrderRate),
      pricing: 'priced',
      sourceUrl: PH_SOURCES.commission,
      effectiveDate: preOrderFee?.effectiveFrom ?? PH_PRE_ORDER_DATE,
      lastVerified: rates.lastVerified,
      confidence: preOrderFee?.confidence ?? 'high',
      notes: `${(preOrderRate * 100).toFixed(2)}% pre-order service fee on (Item Price - Seller Discount). VAT inclusive.`,
    });
  }

  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netPrice),
      amount: roundToTwo(netPrice * (inputs.affiliateRate / 100)),
      pricing: 'priced',
      sourceUrl: PH_SOURCES.affiliate,
      effectiveDate: rates.sourceDate,
      lastVerified: rates.lastVerified,
      confidence: 'high',
      notes: `Affiliate commission on (Item Price - Seller Discount). Mode: ${inputs.affiliateMode}.`,
    });
  }

  return fees;
}

export async function calculatePHFees(
  inputs: CalculatorInputs
): Promise<FeeBreakdownItem[]> {
  const rates = await getPHRates();
  return buildPHFees(inputs, rates);
}

export function calculatePHFeesSync(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  return buildPHFees(inputs, rates);
}
