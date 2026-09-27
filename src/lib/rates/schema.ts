import { z } from 'zod';

/**
 * Seller tier labels as they actually appear in the rate files.
 *
 * The rate files use canonical, capitalised labels per market:
 *   PH: "Marketplace"
 *   SG: "Standard", "BXP", "BXP Restricted", "BXP Mixed"
 *   MY: "BXP Marketplace", "BXP Mall", "Non-BXP Marketplace", "Non-BXP Mall"
 * US and UK do not tier their commission rates.
 *
 * The lowercase values are the internal identifiers from
 * `calculation/types.ts` (`SellerTier`) and are kept so both the validated
 * data and the calculation layer can share one type.
 */
export const RateTierSchema = z.enum([
  'Marketplace',
  'Mall',
  'Standard',
  'BXP',
  'BXP Marketplace',
  'BXP Mall',
  'Non-BXP Marketplace',
  'Non-BXP Mall',
  'BXP Restricted',
  'BXP Mixed',
  'standard',
  'bxp',
  'mall',
  'marketplace',
]);

export type RateTier = z.infer<typeof RateTierSchema>;

export const SpecialRuleSchema = z.object({
  type: z.enum(['tieredThreshold', 'bxpMixed', 'bxpRestricted', 'bxpSuspended', 'promo']),
  threshold: z.number().optional(),
  rateAboveThreshold: z.number().optional(),
  description: z.string().optional(),
  appliesTo: z.string().optional(),
  discountedRate: z.number().optional(),
  serviceFeeRate: z.number().optional(),
  restrictedCategories: z.array(z.string()).optional(),
});

export const CategoryRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentCategory: z.string(),
  rate: z.number().min(0).max(1),
  // PH stores both seller tiers on one record: `rate` for Marketplace sellers
  // and `mallRate` for Mall sellers. Without this field Zod would silently
  // strip the Mall rate from every PH category.
  mallRate: z.number().min(0).max(1).optional(),
  tier: RateTierSchema.optional(),
  confidence: z.enum(['high', 'medium', 'low', 'needs-verification']).default('needs-verification'),
  sourceUrl: z.string().url().optional().default(''),
  sourceDate: z.string().optional().default(''),
  lastVerified: z.string().optional().default(''),
  specialRules: z.array(SpecialRuleSchema).optional(),
  notes: z.string().optional(),
});

export const FixedFeeSchema = z.object({
  // `fixedFees` and `additionalFees` are keyed maps where the key is the fee
  // name, so the records themselves do not repeat a `name` field.
  name: z.string().optional(),
  rate: z.number().min(0).max(1).optional(),
  currency: z.string().optional(),
  perOrder: z.boolean().optional(),
  base: z.string().optional(),
  taxInclusive: z.boolean().optional(),
  effectiveFrom: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low', 'needs-verification']).optional(),
  appliesTo: z.string().optional(),
  description: z.string().optional(),
  // MY Dynamic Commission publishes a range and a per-item cap rather than a
  // single rate, because the sub-category rates are not disclosed.
  rateRange: z.string().optional(),
  capPerItem: z.number().optional(),
  notes: z.string().optional(),
});

export const TransactionFeeConfigSchema = z.object({
  rate: z.number().min(0).max(1),
  base: z.string(),
  taxInclusive: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low', 'needs-verification']),
  notes: z.string().optional(),
});

export const AffiliateConfigSchema = z.object({
  openCollabRange: z.array(z.number().min(0).max(1)).min(2).max(2),
  targetedCollabRange: z.array(z.number().min(0).max(1)).min(2).max(2),
  shopAdsMinRatio: z.number().min(0).max(1),
  decreaseProtectionDays: z.number().int().positive(),
  sourceUrl: z.string().url(),
}).optional();

export const MarketRateDataSchema = z.object({
  market: z.enum(['US', 'UK', 'SG', 'MY', 'PH']),
  currency: z.string(),
  sourceUrl: z.string().url(),
  sourceDate: z.string(),
  lastVerified: z.string(),
  coverage: z.string(),
  extractionStatus: z.enum(['partial', 'complete', 'failed']),
  missingData: z.string().optional(),
  categories: z.array(CategoryRateSchema),
  defaultRates: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  fixedFees: z.record(z.string(), FixedFeeSchema).optional(),
  transactionFee: TransactionFeeConfigSchema.optional(),
  affiliate: AffiliateConfigSchema,
  additionalFees: z.record(z.string(), FixedFeeSchema).optional(),
  pdfReferences: z.array(z.object({
    name: z.string(),
    size: z.string(),
    description: z.string(),
  })).optional(),
  clusterStructure: z.record(z.string(), z.array(z.string())).optional(),
  knownRanges: z.record(z.string(), z.string()).optional(),
  // US records why its rate table is incomplete, as free text.
  missingCategories: z.string().optional(),
  // UK carries a single headline default alongside its cluster entries.
  defaultRate: z.number().min(0).max(1).optional(),
  // UK points at the source Excel download that has to be pulled manually.
  excelFile: z.object({
    name: z.string(),
    size: z.string(),
    downloadUrl: z.string(),
    needsManualDownload: z.boolean().optional(),
  }).optional(),
});

export type CategoryRate = z.infer<typeof CategoryRateSchema>;
export type FixedFee = z.infer<typeof FixedFeeSchema>;
export type TransactionFeeConfig = z.infer<typeof TransactionFeeConfigSchema>;
export type AffiliateConfig = z.infer<typeof AffiliateConfigSchema>;
export type MarketRateData = z.infer<typeof MarketRateDataSchema>;

export function validateMarketRateData(data: unknown): MarketRateData {
  const parsed = MarketRateDataSchema.parse(data);

  // Category records do not repeat the file-level provenance, so they inherit
  // it here. Without this every category-derived fee line would resolve to an
  // empty source URL.
  parsed.categories = parsed.categories.map(category => ({
    ...category,
    sourceUrl: category.sourceUrl || parsed.sourceUrl,
    sourceDate: category.sourceDate || parsed.sourceDate,
    lastVerified: category.lastVerified || parsed.lastVerified,
  }));

  return parsed;
}

export function validateCategoryRate(data: unknown): CategoryRate {
  return CategoryRateSchema.parse(data);
}