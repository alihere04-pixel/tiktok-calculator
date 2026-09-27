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

function resolveTier(inputs: CalculatorInputs): MYTier {
  const extra = getExtra(inputs);
  if (extra.myTier) {
    return extra.myTier;
  }

  const isBxp =
    inputs.sellerTier === 'bxp' || extra.isBxpSeller === true;
  const isMall = inputs.sellerTier === 'mall' || extra.isMall === true;

  if (isBxp) {
    return isMall ? 'BXP Mall' : 'BXP Marketplace';
  }
  return isMall ? 'Non-BXP Mall' : 'Non-BXP Marketplace';
}

// Published ranges per tier, used as a flagged fallback when a category has no
// exact entry. The midpoint is used rather than an invented point estimate.
const MY_KNOWN_RANGES: Record<MYTier, [number, number]> = {
  'BXP Marketplace': [0.0486, 0.0918],
  'Non-BXP Marketplace': [0.1134, 0.1782],
  'BXP Mall': [0.0891, 0.1242],
  'Non-BXP Mall': [0.1458, 0.189],
};

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

  const tier = resolveTier(inputs);
  const extraFees = rates.additionalFees ?? {};

  // Commission. Note that 4.86% is the lower bound of the BXP Marketplace
  // commission range, not a separate fee stacked on top of commission, so it
  // is never charged as an extra line item here.
  const category = findCategoryRate(rates, inputs.categoryId, tier);
  const [rangeLow, rangeHigh] = MY_KNOWN_RANGES[tier];

  const commissionRate = category?.rate ?? (rangeLow + rangeHigh) / 2;
  const commissionConfidence = category
    ? category.confidence
    : 'needs-verification';
  const commissionNotes = category
    ? (category.notes ?? '') +
      ` Seller tier: ${tier}. SST inclusive.`
    : `No MY rate-table entry for "${inputs.categoryId}" on the ${tier} tier. Fell back to the midpoint of the published ${(
        rangeLow * 100
      ).toFixed(2)}%-${(rangeHigh * 100).toFixed(
        2
      )}% range. MY category coverage is examples-only. SST inclusive.`;

  fees.push({
    name: 'Commission Fee',
    rate: `${(commissionRate * 100).toFixed(3)}%`,
    base: roundToTwo(netSales),
    amount: roundToTwo(netSales * commissionRate),
    sourceUrl: category?.sourceUrl || rates.sourceUrl,
    effectiveDate: category?.sourceDate || rates.sourceDate,
    lastVerified: category?.lastVerified || rates.lastVerified,
    confidence: commissionConfidence,
    notes: commissionNotes,
  });

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
