import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { findCategoryRow } from '@/lib/rates/tiers';

const US_SOURCES = {
  refundAdmin:
    'https://seller-us.tiktok.com/university/essay?knowledge_id=5982454398175018',
  affiliate:
    'https://seller-us.tiktok.com/university/essay?knowledge_id=6077860360177451',
};

/**
 * Effective dates that are not stored in the US rate file.
 *
 * Unlike the other four markets, `US-categories.json` has no `additionalFees`
 * block, so there is no `effectiveFrom` to read. These are the verified
 * constants the calculation has always used, named here so they are not magic
 * values repeated across the file.
 */
const US_REFUND_ADMIN_DATE = '2025-05-15';
const US_AFFILIATE_DATE = '2026-09-14';

// Cache for loaded rates
let usRatesCache: MarketRateData | null = null;

async function getUSRates(): Promise<MarketRateData> {
  if (!usRatesCache) {
    usRatesCache = loadMarketRatesSync('US');
  }
  return usRatesCache!;
}

/**
 * Resolves `inputs.categoryId` to a US rate row.
 *
 * `categoryId` is a category-group id, the contract documented on
 * `CalculatorInputs` and the value the form actually sends: the selector's
 * options are built from `groupCategories`, so the browser submits `group.id`.
 * This used to compare `categoryId` against raw rate-row ids only, which never
 * matches: every US group id is derived from the category *name*
 * (`us-diamond`), while the row id is derived from the section plus the name
 * (`us-jewelry-diamond`). All 202 US categories therefore missed the lookup and
 * fell back to `getDefaultRate()`. That was invisible for the 185 categories
 * whose published rate is the same 6%, but the 17 categories published at 5%
 * (Jewelry: Diamond, Gold, Jade, Platinum/Carat Gold, Ruby/Sapphire/Emerald;
 * Pre-Owned: Bags, Collectible Trading Cards, Luggage & Travel, Watches,
 * Footwear, Refurbished Phones & Electronics, Fashion Accessories, Menswear,
 * Womenswear, Collectible Coins and Paper Money, Collectible Figures,
 * Collectible Comic Books) were charged 6% instead of 5%.
 *
 * Resolution goes through the shared `findCategoryRow`, which accepts a group id
 * and still accepts a raw row id for saved links and tests. That is the same
 * helper PH, MY and SG already use, so the engines can no longer disagree
 * about how a category id is read.
 *
 * `null` is passed for the tier deliberately. US does not tier its commission
 * rates, so there is no tier to disambiguate and each group holds exactly one
 * row. Forwarding `inputs.sellerTier` would be actively wrong: US rows carry no
 * `tier` field, so a tier lookup would match nothing and reintroduce the same
 * silent fallback to the default rate.
 */
function findCategoryRate(rates: MarketRateData, categoryId: string): CategoryRate | null {
  return findCategoryRow(rates.market, rates.categories, categoryId, null);
}

function getDefaultRate(): number {
  return 0.06; // Standard 6% referral fee
}

// Category records may omit their own source metadata, so fall back on falsy
// values rather than nullish ones to avoid emitting a blank source URL.
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

function calculateTieredFee(
  baseAmount: number,
  rate: number,
  specialRules: CategoryRate['specialRules']
): { fee: number; notes?: string } {
  if (!specialRules || specialRules.length === 0) {
    return { fee: baseAmount * rate };
  }

  for (const rule of specialRules) {
    if (
      rule.type === 'tieredThreshold' &&
      typeof rule.threshold === 'number' &&
      rule.rateAboveThreshold !== undefined
    ) {
      if (baseAmount <= rule.threshold) {
        return { fee: baseAmount * rate };
      }
      return {
        fee: rule.threshold * rate + (baseAmount - rule.threshold) * rule.rateAboveThreshold,
        notes: `Tiered: ${(rate * 100).toFixed(1)}% on first $${rule.threshold.toLocaleString()}, ${(rule.rateAboveThreshold * 100).toFixed(1)}% on amount above`,
      };
    }
  }
  return { fee: baseAmount * rate };
}

/**
 * The single US fee implementation.
 *
 * `calculateUSFees` and `calculateUSFeesSync` previously carried two copies of
 * this logic, which could drift apart. The reverse calculators re-run the engine
 * at other prices on the hot path, so both entry points now share one builder.
 */
function buildUSFees(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  const fees: FeeBreakdownItem[] = [];

  const netPrice = inputs.sellingPrice - inputs.sellerDiscount;
  const customerPayment = netPrice + inputs.customerShipping;
  const commissionBase = customerPayment + inputs.platformDiscount; // Tax excluded per US policy

  const category = findCategoryRate(rates, inputs.categoryId);
  const referralRate = category?.rate ?? getDefaultRate();
  const categoryConfidence = category?.confidence ?? 'needs-verification';
  const { sourceUrl, sourceDate, lastVerified } = pickMeta(category, rates);

  // US does not tier its commission by seller, so the promo is the only rate
  // override. The 1.8% promo rate is not published, and the existing behaviour
  // of charging it while labelling it "NEEDS VERIFICATION" is preserved: the
  // user opted into the promo explicitly and can see the flag on the line.
  let effectiveRate = referralRate;
  let promoNote = '';
  if (inputs.newSellerPromo && inputs.promoDaysRemaining > 0) {
    effectiveRate = 0.018;
    promoNote = 'New seller promo (1.8% - NEEDS VERIFICATION)';
  }

  const tieredResult = calculateTieredFee(commissionBase, effectiveRate, category?.specialRules);
  const referralFee = roundToTwo(tieredResult.fee);

  fees.push({
    name: 'Referral Fee',
    rate: promoNote || `${(effectiveRate * 100).toFixed(1)}%`,
    base: commissionBase,
    amount: referralFee,
    pricing: 'priced',
    sourceUrl,
    effectiveDate: sourceDate,
    lastVerified,
    confidence: categoryConfidence,
    notes: tieredResult.notes || promoNote || 'Standard referral fee on (Customer Payment + Platform Discount - Tax)',
  });

  // Refund Administration Fee (modeled per unit based on return rate)
  if (inputs.returnRate > 0) {
    const refundAdminFeePerUnit = (inputs.returnRate / 100) * Math.min(0.20 * referralFee, 5.00);
    fees.push({
      name: 'Refund Admin Fee (modeled)',
      rate: `20% of referral fee, capped $5/SKU × ${inputs.returnRate}% return rate`,
      base: referralFee,
      amount: roundToTwo(refundAdminFeePerUnit),
      pricing: 'priced',
      sourceUrl: US_SOURCES.refundAdmin,
      effectiveDate: US_REFUND_ADMIN_DATE,
      lastVerified: rates.lastVerified,
      confidence: 'high',
      notes: '20% of refunded referral fee, capped at $5 per SKU (effective May 15, 2025). Modeled per unit using estimated return rate.',
    });
  }

  // Affiliate Commission (if enabled)
  if (inputs.affiliateMode !== 'none' && inputs.affiliateRate > 0) {
    const affiliateBase = netPrice; // (Selling Price - Seller Discount)
    const affiliateFee = roundToTwo(affiliateBase * (inputs.affiliateRate / 100));
    fees.push({
      name: 'Affiliate Commission',
      rate: `${inputs.affiliateRate}%`,
      base: affiliateBase,
      amount: affiliateFee,
      pricing: 'priced',
      sourceUrl: US_SOURCES.affiliate,
      effectiveDate: US_AFFILIATE_DATE,
      lastVerified: rates.lastVerified,
      confidence: 'high',
      notes: `Affiliate commission on (Selling Price - Seller Discount). Mode: ${inputs.affiliateMode}.`,
    });
  }

  // No separate transaction fee in US (included in referral fee per official policy)
  // No platform support fee in US

  return fees;
}

export async function calculateUSFees(inputs: CalculatorInputs): Promise<FeeBreakdownItem[]> {
  return buildUSFees(inputs, await getUSRates());
}

export function calculateUSFeesSync(
  inputs: CalculatorInputs,
  rates: MarketRateData
): FeeBreakdownItem[] {
  return buildUSFees(inputs, rates);
}
