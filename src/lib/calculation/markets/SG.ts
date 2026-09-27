import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
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

// The SG rate file only covers commission clusters, so the category table is
// used to resolve the rate for whichever cluster a category falls into.
const SG_CLUSTER_BY_CATEGORY_PREFIX: Array<[string, string]> = [
  ['sg-electronics', 'electronics'],
  ['sg-bxp-restricted-electronics', 'restricted'],
  ['sg-bxp-mixed-electronics', 'mixed'],
];

/**
 * SG-specific switches that `CalculatorInputs` does not model. They are read
 * defensively so the engine keeps working when a caller omits them.
 */
interface SGExtraInputs {
  isBxpRestricted?: boolean;
  isBxpMixed?: boolean;
}

type SGInputs = CalculatorInputs & SGExtraInputs;

type SGProgramStatus = 'standard' | 'bxp' | 'bxp-restricted' | 'bxp-mixed';

function getExtra(inputs: CalculatorInputs): SGExtraInputs {
  return inputs as SGInputs;
}

function isBxpSeller(sellerTier: CalculatorInputs['sellerTier']): boolean {
  return sellerTier === 'bxp';
}

function resolveProgramStatus(inputs: CalculatorInputs): SGProgramStatus {
  if (!isBxpSeller(inputs.sellerTier)) {
    return 'standard';
  }
  const extra = getExtra(inputs);
  // A mixed order implies the order also contains restricted products, but the
  // mixed rate is the one that must be applied, so it is checked first.
  if (extra.isBxpMixed) {
    return 'bxp-mixed';
  }
  if (extra.isBxpRestricted) {
    return 'bxp-restricted';
  }
  return 'bxp';
}

// The rate table labels each cluster by program, so a matched category is a more
// reliable signal than the caller's optional flags.
const STATUS_BY_CATEGORY_TIER: Record<string, SGProgramStatus> = {
  BXP: 'bxp',
  'BXP Mixed': 'bxp-mixed',
  'BXP Restricted': 'bxp-restricted',
  Standard: 'standard',
};

function resolveStatus(
  inputs: CalculatorInputs,
  category: CategoryRate | null
): SGProgramStatus {
  const flagStatus = resolveProgramStatus(inputs);
  if (!isBxpSeller(inputs.sellerTier) || !category?.tier) {
    return flagStatus;
  }
  return STATUS_BY_CATEGORY_TIER[category.tier] ?? flagStatus;
}

function resolveCluster(categoryId: string): string {
  for (const [prefix, cluster] of SG_CLUSTER_BY_CATEGORY_PREFIX) {
    if (categoryId === prefix || categoryId.startsWith(`${prefix}-`)) {
      return cluster;
    }
  }
  return 'other';
}

function findCategoryRate(
  rates: MarketRateData,
  categoryId: string
): CategoryRate | null {
  return rates.categories.find(c => c.id === categoryId) || null;
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

  const exactCategory = findCategoryRate(rates, inputs.categoryId);
  const status = resolveStatus(inputs, exactCategory);
  const cluster = resolveCluster(inputs.categoryId);
  const extraFees = rates.additionalFees ?? {};

  // Resolve commission: prefer an exact rate-table match, otherwise fall back to
  // the cluster default for the seller's program status.
  let commissionRate: number;
  let commissionConfidence: FeeBreakdownItem['confidence'];
  let commissionNotes: string;
  let commissionSourceUrl = rates.sourceUrl;

  if (exactCategory) {
    commissionRate = exactCategory.rate;
    commissionConfidence = exactCategory.confidence;
    commissionSourceUrl = exactCategory.sourceUrl || rates.sourceUrl;
    commissionNotes = exactCategory.notes ?? '';
  } else {
    const fallbackId = {
      standard: 'sg-other-standard',
      bxp: 'sg-other-bxp',
      'bxp-restricted': 'sg-bxp-restricted-other',
      'bxp-mixed': 'sg-bxp-mixed-other',
    }[status];
    const fallback =
      rates.categories.find(c => c.id === fallbackId) ?? null;
    commissionRate = fallback?.rate ?? 0;
    commissionConfidence = 'needs-verification';
    commissionNotes = `No SG rate-table entry for "${inputs.categoryId}". Fell back to the ${
      fallback?.name ?? status
    } rate. SG category coverage is cluster-level only.`;
  }

  const tierLabel =
    status === 'standard'
      ? 'Standard'
      : status === 'bxp'
        ? 'BXP'
        : status === 'bxp-restricted'
          ? 'BXP Restricted'
          : 'BXP Mixed';

  fees.push({
    name: 'Commission Fee',
    rate: `${(commissionRate * 100).toFixed(3)}%`,
    base: roundToTwo(customerPayment),
    amount: roundToTwo(customerPayment * commissionRate),
    sourceUrl: commissionSourceUrl,
    effectiveDate: rates.sourceDate,
    lastVerified: rates.lastVerified,
    confidence: commissionConfidence,
    notes:
      commissionNotes ||
      `Commission on Customer Payment for the ${tierLabel} program (${cluster} cluster). GST inclusive.`,
  });

  // BXP service fee: mixed BXP orders only, and never on restricted products.
  if (status === 'bxp-mixed') {
    const serviceFee = extraFees.bxpServiceFee;
    const serviceRate = serviceFee?.rate ?? SG_BXP_SERVICE_FEE_RATE;
    fees.push({
      name: 'BXP Service Fee',
      rate: `${(serviceRate * 100).toFixed(2)}%`,
      base: roundToTwo(customerPayment),
      amount: roundToTwo(customerPayment * serviceRate),
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
    sourceUrl: SG_SOURCES.transaction,
    effectiveDate: '2026-04-01',
    lastVerified: rates.lastVerified,
    confidence: 'medium',
    notes: '3.27% on Customer Payment + Platform Discount from Apr 1, 2026. The rate is confirmed, but the base change could not be verified on the Transaction Fee page. GST inclusive.',
  });

  if (inputs.isPreOrder) {
    const preOrderFee = extraFees.preOrderFee;
    const preOrderRate = preOrderFee?.rate ?? SG_PRE_ORDER_RATE;
    fees.push({
      name: 'Pre-order Fee',
      rate: `${(preOrderRate * 100).toFixed(2)}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * preOrderRate),
      sourceUrl: SG_SOURCES.preOrder,
      effectiveDate: '2025-12-22',
      lastVerified: rates.lastVerified,
      confidence: preOrderFee?.confidence ?? 'high',
      notes: '1.09% pre-order fee from Dec 22, 2025, applied to (Item Price - Seller Discount). GST inclusive.',
    });
  }

  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * (inputs.affiliateRate / 100)),
      sourceUrl: SG_SOURCES.affiliate,
      effectiveDate: '2026-08-17',
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
