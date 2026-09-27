import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';

const UK_AFFILIATE_SOURCE =
  'https://seller-uk.tiktok.com/university/essay?knowledge_id=7753767378814721';

let ukRatesCache: MarketRateData | null = null;

async function getUKRates(): Promise<MarketRateData> {
  if (!ukRatesCache) {
    ukRatesCache = loadMarketRatesSync('UK');
  }
  return ukRatesCache!;
}

function findCategoryRate(
  rates: MarketRateData,
  categoryId: string
): CategoryRate | null {
  return rates.categories.find(c => c.id === categoryId) || null;
}

function getDefaultRate(): number {
  return 0.09; // UK standard referral fee, VAT inclusive
}

function isPromoCategory(categoryId: string): boolean {
  return categoryId === 'uk-new-seller-promo';
}

// Category records in the rate files do not carry their own source metadata.
// The schema fills those gaps with empty strings, so fall back on falsy values
// rather than nullish ones.
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

function buildUKFees(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  const fees: FeeBreakdownItem[] = [];

  // Commission = (Net Sales + Customer Shipping + Platform Discount) x Rate
  // Refunds are not modeled in the MVP inputs.
  const netSales = inputs.sellingPrice - inputs.sellerDiscount;
  const commissionBase = netSales + inputs.customerShipping + inputs.platformDiscount;

  const category = findCategoryRate(rates, inputs.categoryId);
  const categoryRate = category?.rate ?? getDefaultRate();
  const categoryConfidence = category?.confidence ?? 'needs-verification';
  const { sourceUrl, sourceDate, lastVerified } = pickMeta(category, rates);

  const promoActive =
    inputs.newSellerPromo && inputs.promoDaysRemaining > 0;

  if (promoActive) {
    // UK new seller promo waives commission entirely once Seller Missions
    // are completed. The exact promo rate is not published, so 0% is used.
    fees.push({
      name: 'Platform Commission Fee (New Seller Promo)',
      rate: '0%',
      base: roundToTwo(commissionBase),
      amount: 0,
      sourceUrl,
      effectiveDate: sourceDate,
      lastVerified,
      confidence: 'needs-verification',
      notes: isPromoCategory(inputs.categoryId)
        ? '0% commission after completing required Seller Missions within 45 days of onboarding. Exact promo rate is not published on Seller University.'
        : `New seller promo assumed to apply to ${inputs.categoryId}. Exact promo eligibility and rate are not published, so 0% is applied and flagged for verification.`,
    });
  } else {
    fees.push({
      name: 'Platform Commission Fee',
      rate: `${(categoryRate * 100).toFixed(2)}%`,
      base: roundToTwo(commissionBase),
      amount: roundToTwo(commissionBase * categoryRate),
      sourceUrl,
      effectiveDate: sourceDate,
      lastVerified,
      confidence: categoryConfidence,
      notes: `Commission = (Net Sales + Customer Shipping + Platform Discount) x ${(
        categoryRate * 100
      ).toFixed(2)}%. Refunds are not modeled in the MVP inputs. VAT inclusive.`,
    });
  }

  // Affiliate / open collaboration commission on Net Sales
  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: roundToTwo(netSales),
      amount: roundToTwo(netSales * (inputs.affiliateRate / 100)),
      sourceUrl: UK_AFFILIATE_SOURCE,
      effectiveDate: '2026-07-15',
      lastVerified: '2026-09-26',
      confidence: 'high',
      notes: `Open collaboration commission on Net Sales. Mode: ${inputs.affiliateMode}. Non-refundable once the creator order is settled.`,
    });
  }

  // No separate transaction fee and no fixed per-order fees in the UK MVP data.
  return fees;
}

export async function calculateUKFees(
  inputs: CalculatorInputs
): Promise<FeeBreakdownItem[]> {
  const rates = await getUKRates();
  return buildUKFees(inputs, rates);
}

export function calculateUKFeesSync(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  return buildUKFees(inputs, rates);
}
