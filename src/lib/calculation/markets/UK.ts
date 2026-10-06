import type {
  CalculatorInputs,
  FeeBreakdownItem,
} from '@/lib/calculation/types';
import type { CategoryRate, MarketRateData } from '@/lib/rates/schema';
import { roundToTwo } from '../utils';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import { findCategoryRow } from '@/lib/rates/tiers';

const UK_AFFILIATE_SOURCE =
  'https://seller-uk.tiktok.com/university/essay?knowledge_id=7753767378814721';

let ukRatesCache: MarketRateData | null = null;

async function getUKRates(): Promise<MarketRateData> {
  if (!ukRatesCache) {
    ukRatesCache = loadMarketRatesSync('UK');
  }
  return ukRatesCache!;
}

/**
 * Resolves `inputs.categoryId` to a UK rate row.
 *
 * `categoryId` is a category-group id, the contract documented on
 * `CalculatorInputs` and the value the form actually sends: the selector's
 * options are built from `groupCategories`, so the browser submits `group.id`.
 * This used to compare `categoryId` against raw rate-row ids only, which almost
 * never matches. A group id is derived from the category *name*
 * (`uk-standard-rate-most-categories`, `uk-accessories`), while a row id is
 * derived from the section plus the name (`uk-standard`,
 * `uk-beauty-and-personal-care-accessories`). Exactly one of the 347 UK groups
 * (`uk-electronics`) happens to share its row id, so 346 of the 347 categories
 * the selector offers missed the lookup and fell back to `getDefaultRate()`.
 *
 * The damage was not uniform, because the fallback happened to be correct for
 * one of the three published bands:
 *   - 217 categories published at 9% were charged 9%: right answer, wrong reason,
 *     and their category metadata was silently dropped.
 *   - 129 categories published at 5% were charged 9%: an overstatement of fees.
 *   - the one category published at 0% (the new seller promo) was charged 9%.
 *
 * Resolution goes through the shared `findCategoryRow`, the same helper the US,
 * PH, MY and SG engines use. It accepts a group id and still accepts a raw row
 * id, so saved links, the SEO mini-calculator and the existing tests keep
 * working, and the engines can no longer disagree about how a category id is
 * read.
 *
 * `null` is passed for the tier deliberately. UK does not tier its commission
 * rates, so there is no tier to disambiguate and every UK group holds exactly
 * one row. Forwarding `inputs.sellerTier` would be actively wrong: UK rows carry
 * no `tier` field, so a tier lookup would match nothing and reintroduce the same
 * silent fallback to the 9% default.
 */
function findCategoryRate(rates: MarketRateData, categoryId: string): CategoryRate | null {
  return findCategoryRow(rates.market, rates.categories, categoryId, null);
}

function getDefaultRate(): number {
  return 0.09; // UK standard referral fee, VAT inclusive
}

/**
 * Whether the selected category is the new seller promo category.
 *
 * Detected from the resolved row rather than by comparing the submitted id,
 * because the two id shapes differ: the row is `uk-new-seller-promo` and its
 * group is `uk-new-seller-promotional-rate`. Comparing the raw `categoryId`
 * meant the form's own value never matched, so the engine told sellers the
 * promo "is assumed to apply" to the very category that publishes it.
 */
function isPromoCategory(category: CategoryRate | null): boolean {
  return category?.id === 'uk-new-seller-promo';
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
    // The UK new seller promo waives commission once the required Seller
    // Missions are completed, but the exact promo rate is not published. The
    // previous code applied 0% anyway, which is a different claim: it said the
    // promo costs nothing rather than saying the rate is unknown. A 0% charge
    // would also overstate profit, so the fee is reported as unpriced and the
    // calculation is marked incomplete. The normal published rate is shown in
    // the notes so the seller can see what the promo is being applied against.
    fees.push({
      name: 'Platform Commission Fee (New Seller Promo)',
      rate: 'not published',
      base: roundToTwo(commissionBase),
      amount: 0,
      pricing: 'unpriced',
      sourceUrl,
      effectiveDate: sourceDate,
      lastVerified,
      confidence: 'needs-verification',
      notes:
        (isPromoCategory(category)
          ? 'The new seller promo waives commission after completing the required Seller Missions within 45 days of onboarding, '
          : `The new seller promo is assumed to apply to ${category?.name ?? inputs.categoryId}, `) +
        `but the exact promo rate is not published on Seller University, so no amount is calculated. ` +
        `The standard published rate for this category is ${(categoryRate * 100).toFixed(2)}%. ` +
        'This is excluded from the fee total, and the result is incomplete until you confirm the promo rate in Seller Centre.',
    });
  } else {
    fees.push({
      name: 'Platform Commission Fee',
      rate: `${(categoryRate * 100).toFixed(2)}%`,
      base: roundToTwo(commissionBase),
      amount: roundToTwo(commissionBase * categoryRate),
      pricing: 'priced',
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
      pricing: 'priced',
      sourceUrl: UK_AFFILIATE_SOURCE,
      effectiveDate: '2026-07-15',
      lastVerified: rates.lastVerified,
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
