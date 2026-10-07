"use client";

import { loadMarketRatesSync, getAvailableMarkets } from "@/lib/rates/loader";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";
import type { MarketRateSummary } from "@/hooks/useCalculator";
import type { Market } from "@/hooks/useCalculator";

export default function HomePage() {
  const markets = getAvailableMarkets();
  const ratesByMarket: Partial<Record<Market, MarketRateSummary>> = {};

  for (const market of markets) {
    const rates = loadMarketRatesSync(market);
    ratesByMarket[market as Market] = {
      market: rates.market,
      currency: rates.currency,
      categories: rates.categories.map((category) => ({
        id: category.id,
        name: category.name,
        parentCategory: category.parentCategory,
        tier: category.tier,
        rate: category.rate,
        mallRate: category.mallRate,
        confidence: category.confidence,
      })),
    };
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <a
            href="https://fynza.store"
            className="mb-1.5 block text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Fynza
          </a>
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
