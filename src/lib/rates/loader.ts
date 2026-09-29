import type { MarketRateData } from './schema';
import { validateMarketRateData } from './schema';

import usRaw from '../../../data/rates/US-categories.json';
import phRaw from '../../../data/rates/PH-categories.json';
import sgRaw from '../../../data/rates/SG-categories.json';
import myRaw from '../../../data/rates/MY-categories.json';
import ukRaw from '../../../data/rates/UK-categories.json';

type MarketCode = MarketRateData['market'];

const rateCache = new Map<MarketCode, MarketRateData>();

const MARKET_MODULES: Record<MarketCode, unknown> = {
  US: usRaw,
  PH: phRaw,
  SG: sgRaw,
  MY: myRaw,
  UK: ukRaw,
};

/**
 * Synchronous, cached rate loader for the market calculation engines.
 *
 * Every read goes through `validateMarketRateData`, so the engines can never
 * observe a rate file that the schema has not accepted.
 *
 * Uses static imports that work in both Next.js (bundled) and Vitest (resolved).
 */
export function loadMarketRatesSync(market: string): MarketRateData {
  const marketKey = market.toUpperCase() as MarketCode;
  const cached = rateCache.get(marketKey);
  if (cached) {
    return cached;
  }

  const rawModule = MARKET_MODULES[marketKey];
  if (!rawModule) {
    throw new Error(`No rate file mapping for market: ${market}`);
  }

  const rawData = (rawModule as { default?: unknown }).default ?? rawModule;
  const rates = validateMarketRateData(rawData);
  rateCache.set(marketKey, rates);
  return rates;
}

export async function loadMarketRates(market: string): Promise<MarketRateData> {
  return loadMarketRatesSync(market);
}

export async function loadAllMarketRates(): Promise<Record<string, MarketRateData>> {
  const markets = Object.keys(MARKET_MODULES) as MarketCode[];
  const results: Record<string, MarketRateData> = {};

  for (const market of markets) {
    try {
      results[market] = loadMarketRatesSync(market);
    } catch (error) {
      console.error(`Failed to load rates for ${market}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Preloads all rate files into the cache.
 * With static imports this is a no-op since loadMarketRatesSync is self-populating,
 * but kept for API compatibility and explicit preloading if needed.
 */
export async function preloadAllRates(): Promise<void> {
  const markets = Object.keys(MARKET_MODULES) as MarketCode[];
  await Promise.all(
    markets.map(async (market) => {
      if (!rateCache.has(market)) {
        loadMarketRatesSync(market);
      }
    })
  );
}

export function clearRatesCache(): void {
  rateCache.clear();
}

export function getAvailableMarkets(): string[] {
  return Object.keys(MARKET_MODULES);
}

export function getRateFilePath(market: string): string {
  // Kept for compatibility.
  const marketKey = market.toUpperCase() as MarketCode;
  const fileName = marketKey === 'US' ? 'US-categories.json'
    : marketKey === 'PH' ? 'PH-categories.json'
    : marketKey === 'SG' ? 'SG-categories.json'
    : marketKey === 'MY' ? 'MY-categories.json'
    : marketKey === 'UK' ? 'UK-categories.json'
    : '';
  if (!fileName) {
    throw new Error(`No rate file mapping for market: ${market}`);
  }
  return `../../../data/rates/${fileName}`;
}
