import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MarketRateData } from './schema';
import { validateMarketRateData } from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type MarketCode = MarketRateData['market'];

const MARKET_FILE_MAP: Record<MarketCode, string> = {
  US: 'US-categories.json',
  PH: 'PH-categories.json',
  SG: 'SG-categories.json',
  MY: 'MY-categories.json',
  UK: 'UK-categories.json',
};

// `src/lib/rates` -> app root, then `src`. The app-root copy is the canonical
// one; the `src` copy is kept as a fallback so the loader keeps working if the
// duplicate directory is removed.
const CANDIDATE_DATA_DIRS = [
  path.resolve(__dirname, '../../../data/rates'),
  path.resolve(__dirname, '../../data/rates'),
];

const rateCache = new Map<MarketCode, MarketRateData>();

function resolveDataDir(): string {
  for (const dir of CANDIDATE_DATA_DIRS) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  throw new Error(
    `Could not locate a rates directory. Looked in:\n${CANDIDATE_DATA_DIRS.join('\n')}`
  );
}

function readMarketFile(market: string): MarketRateData {
  const marketKey = market.toUpperCase() as MarketCode;
  const fileName = MARKET_FILE_MAP[marketKey];
  if (!fileName) {
    throw new Error(`No rate file mapping for market: ${market}`);
  }

  const filePath = path.join(resolveDataDir(), fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Rate file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawData = JSON.parse(fileContent);

  return validateMarketRateData(rawData);
}

/**
 * Synchronous, cached rate loader for the market calculation engines.
 *
 * Every read goes through `validateMarketRateData`, so the engines can never
 * observe a rate file that the schema has not accepted.
 */
export function loadMarketRatesSync(market: string): MarketRateData {
  const marketKey = market.toUpperCase() as MarketCode;
  const cached = rateCache.get(marketKey);
  if (cached) {
    return cached;
  }

  const rates = readMarketFile(marketKey);
  rateCache.set(marketKey, rates);
  return rates;
}

export async function loadMarketRates(market: string): Promise<MarketRateData> {
  return loadMarketRatesSync(market);
}

export async function loadAllMarketRates(): Promise<Record<string, MarketRateData>> {
  const markets = Object.keys(MARKET_FILE_MAP) as MarketCode[];
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

export function clearRatesCache(): void {
  rateCache.clear();
}

export function getAvailableMarkets(): string[] {
  return Object.keys(MARKET_FILE_MAP);
}

export function getRateFilePath(market: string): string {
  const fileName = MARKET_FILE_MAP[market.toUpperCase() as MarketCode];
  if (!fileName) {
    throw new Error(`No rate file mapping for market: ${market}`);
  }
  return path.join(resolveDataDir(), fileName);
}
