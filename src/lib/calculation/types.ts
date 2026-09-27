export type Market = 'US' | 'UK' | 'SG' | 'MY' | 'PH';

export type SellerTier = 'standard' | 'bxp' | 'mall' | 'marketplace';

export type AffiliateMode = 'none' | 'open' | 'targeted' | 'shopAds';

export type FulfillmentMethod = 'fbt' | 'selfShip';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'needs-verification';

export interface CalculatorInputs {
  market: Market;
  sellerTier: SellerTier | null;
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
  fulfillmentMethod: FulfillmentMethod;
  productWeightLb?: number;
  dimensionsIn?: string;
  isPreOrder: boolean;
  isShippingProgramEnrolled: boolean;
  isGMVMaxActive: boolean;
}

export interface FeeBreakdownItem {
  name: string;
  rate: string;
  base: number;
  amount: number;
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
  totalPlatformFees: number;
  netProfit: number;
  profitMargin: number;
  effectiveTakeRate: number;
  contributionMargin: number;
  contributionMarginPct: number;
  breakEvenPrice: number;
  targetProfitPrice: (target: number) => number;
  maxCPA: (targetROAS: number) => number;
  monthlyProjection: (units: number) => MonthlyProjection;
  calculatedAt: string;
  rateVersion: string;
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
