export type Market = 'US' | 'UK' | 'SG' | 'MY' | 'PH';

/**
 * Canonical seller-tier tokens.
 *
 * These are internal identifiers, never display labels. The rate files use
 * per-market labels ("BXP Marketplace", "BXP Mixed", "Mall"), and the form used
 * to send those labels straight into the engine while the engine compared
 * lowercase tokens, so an explicitly selected tier was silently ignored. Every
 * tier now has one canonical token; `SELLER_TIER_LABELS` in `@/lib/rates/tiers`
 * renders it, and `normalizeSellerTier` accepts any published label.
 */
export type SellerTier =
  // Philippines
  | 'marketplace'
  | 'mall'
  // Singapore
  | 'standard'
  | 'bxp'
  | 'bxp-restricted'
  | 'bxp-mixed'
  // Malaysia
  | 'bxp-marketplace'
  | 'bxp-mall'
  | 'non-bxp-marketplace'
  | 'non-bxp-mall';

export type AffiliateMode = 'none' | 'open' | 'targeted' | 'shopAds';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'needs-verification';

export interface CalculatorInputs {
  market: Market;
  sellerTier: SellerTier | null;
  /**
   * A category-group id from `@/lib/rates/tiers`, not a raw rate-row id.
   *
   * Tiered rate files publish one row per (category, tier), so a raw row id
   * would pin the category to one tier and make the others unreachable. The
   * group id plus `sellerTier` together identify the rate.
   */
  categoryId: string;
  sellingPrice: number;
  sellerDiscount: number;
  platformDiscount: number;
  customerShipping: number;
  cogs: number;
  outboundShipping: number;
  affiliateMode: AffiliateMode;
  affiliateRate: number;
  returnRate: number;
  cpa: number;
  newSellerPromo: boolean;
  promoDaysRemaining: number;
  isPreOrder: boolean;
  isShippingProgramEnrolled: boolean;
  isGMVMaxActive: boolean;
}

/**
 * Whether a fee could be priced from a verified published rate.
 *
 * `unpriced` means no rate could be verified for this combination. Such a fee
 * is excluded from every total and marks the calculation incomplete, because
 * charging it as 0 would understate fees and overstate profit. A genuine
 * published 0% is `priced` with an amount of 0: the two states are different
 * facts and are not interchangeable.
 */
export type FeePricingState = 'priced' | 'unpriced';

export interface FeeBreakdownItem {
  name: string;
  rate: string;
  base: number;
  amount: number;
  /**
   * Required, not optional.
   *
   * An optional field cannot be told apart from a forgotten one at the call
   * site: the engine would have to decide whether `undefined` means "priced" or
   * "unknown", and either choice silently misreports a fee. Requiring it moves
   * the decision to each engine, which is the only place that can make it
   * correctly. Every published rate, including a genuine 0%, is `priced`.
   */
  pricing: FeePricingState;
  sourceUrl: string;
  effectiveDate: string;
  lastVerified: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

export interface MonthlyProjection {
  units: number;
  gmv: number;
  totalFees: number;
  totalProfit: number;
  avgProfitPerUnit: number;
}

export interface CalculationResult {
  inputs: CalculatorInputs;
  fees: FeeBreakdownItem[];
  /** Sum of priced fees only. Unpriced fees are excluded, never counted as 0. */
  totalPlatformFees: number;
  /**
   * False when any fee could not be priced from a verified published rate.
   *
   * Derived figures are still returned so the user sees the known part of the
   * picture, but the UI must present them as incomplete and name the missing
   * fees rather than implying a final answer.
   */
  complete: boolean;
  /** Names of fees that could not be priced. Empty when `complete` is true. */
  unpricedFees: string[];
  netProfit: number;
  profitMargin: number;
  effectiveTakeRate: number;
  contributionMargin: number;
  contributionMarginPct: number;
  breakEvenPrice: number;
  targetProfitPrice: (target: number) => TargetPriceResult;
  maxCPA: (targetROAS: number) => number;
  monthlyProjection: (units: number) => MonthlyProjection;
  calculatedAt: string;
  rateVersion: string;
}

/**
 * Result of solving for a price that earns a target profit.
 *
 * The engine previously signalled "unachievable" by returning 0, which is
 * indistinguishable from a real 0.00 price, so the caller guessed with
 * `price > 0`. Achievability is now an explicit field.
 */
export interface TargetPriceResult {
  price: number;
  achievable: boolean;
}

export interface FixedFee {
  name: string;
  rate?: number;
  currency?: string;
  perOrder?: boolean;
  base?: string;
  taxInclusive?: boolean;
  effectiveFrom?: string;
  confidence?: ConfidenceLevel;
  notes?: string;
}

export interface TransactionFeeConfig {
  rate: number;
  base: string;
  taxInclusive: boolean;
  confidence: ConfidenceLevel;
  notes?: string;
}

export interface AffiliateConfig {
  openCollabRange: [number, number];
  targetedCollabRange: [number, number];
  shopAdsMinRatio: number;
  decreaseProtectionDays: number;
  sourceUrl: string;
}
