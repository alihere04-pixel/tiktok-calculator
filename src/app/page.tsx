import { loadAllMarketRates } from '@/lib/rates/loader';
import { CalculatorForm } from '@/components/calculator/CalculatorForm';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { Market } from '@/hooks/useCalculator';

/**
 * Step 9 page: the input form plus the results panel the form renders after a
 * successful calculation.
 *
 * This is a server component because `lib/rates/loader.ts` reads the rate
 * files from disk with `fs`, which cannot run in the browser. Rate data is
 * narrowed to a serialisable summary here and passed down as props, so the
 * client bundle never imports the loader. The actual calculation happens in the
 * `runCalculation` server action, not on this page.
 */
export default async function Home() {
  const allRates = await loadAllMarketRates();

  const ratesByMarket: Partial<Record<Market, MarketRateSummary>> = {};
  for (const [key, rates] of Object.entries(allRates)) {
    if (!rates) continue;
    ratesByMarket[key as Market] = {
      market: rates.market,
      currency: rates.currency,
      categories: rates.categories.map(
        (category: MarketRateSummary['categories'][number]) => ({
          id: category.id,
          name: category.name,
          parentCategory: category.parentCategory,
          tier: category.tier,
          rate: category.rate,
          confidence: category.confidence,
        })
      ),
    };
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl dark:text-zinc-50">
            TikTok Shop Profit Calculator
          </h1>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            See your real profit after every platform fee.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        <CalculatorForm ratesByMarket={ratesByMarket} />
      </main>
    </div>
  );
}
