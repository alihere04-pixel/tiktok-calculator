import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import {
  SEO_MARKETS,
  buildDescription,
  buildFaqJsonLd,
  buildMarketPageModel,
  buildWebPageJsonLd,
  metaForSlug,
} from '@/lib/seo/market-pages';
import { formatIsoDate } from '@/lib/seo/format';
import { DataDisclosureCard } from '@/components/seo/DataDisclosureCard';
import {
  CategoryExceptionList,
  CategoryRateTable,
  FeeLineTable,
  KnownRangeList,
  TierNotes,
} from '@/components/seo/FeeBreakdownTables';
import { AffiliateGuide } from '@/components/seo/AffiliateGuide';
import { CategoryTableFilter } from '@/components/seo/CategoryTableFilter';
import { FaqAccordion } from '@/components/seo/FaqAccordion';
import { MiniFeeCalculator } from '@/components/seo/MiniFeeCalculator';
import { SellerCenterCta } from '@/components/seo/SellerCenterCta';
import { SponsorLinks } from '@/components/seo/SponsorLinks';

/**
 * Step 10: the five `/[market]/tiktok-shop-fees` pages.
 *
 * Static by construction. `generateStaticParams` enumerates the five markets and
 * `dynamicParams = false` rejects everything else, so this segment prerenders
 * exactly five HTML files and any other slug is a 404 rather than an
 * on-demand-rendered page. Nothing here reads cookies, headers or search params,
 * which is what lets the whole page prerender.
 *
 * All rate data is read at build time by this server component. The one
 * interactive part, the mini estimator, is a client component that calls the
 * existing `runCalculation` server action, so the static page gains interactivity
 * without becoming dynamic.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_MARKETS.map((meta) => ({ market: meta.slug }));
}

type PageProps = { params: Promise<{ market: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { market: slug } = await params;
  const meta = metaForSlug(slug);
  if (!meta) return {};

  const model = buildMarketPageModel(loadMarketRatesSync(meta.market), meta);
  const description = buildDescription(model);
  const url = `/${meta.slug}/tiktok-shop-fees`;

  return {
    title: meta.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: meta.ogTitle,
      description,
      url,
      siteName: 'TikTok Shop Profit Calculator',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: meta.ogTitle,
      description,
    },
  };
}

/**
 * JSON-LD is injected as a string, so `<` is escaped to `\u003c`. Without it, a
 * value containing `</script>` could close the tag early. The content is ours,
 * but the habit is cheap and the failure mode is silent.
 */
function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export default async function MarketFeesPage({ params }: PageProps) {
  const { market: slug } = await params;
  const meta = metaForSlug(slug);
  if (!meta) notFound();

  const data = loadMarketRatesSync(meta.market);
  const model = buildMarketPageModel(data, meta);

  const miniCalculatorRates = {
    market: data.market,
    currency: data.currency,
    categories: data.categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentCategory: category.parentCategory,
      tier: category.tier,
      rate: category.rate,
      confidence: category.confidence,
    })),
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <JsonLd data={buildWebPageJsonLd(model)} />
      <JsonLd data={buildFaqJsonLd(model)} />

      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {model.meta.h1}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{model.intro}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Rate file dated {formatIsoDate(model.sourceDate)}. Last verified{' '}
            {formatIsoDate(model.lastVerified)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SellerCenterCta url={model.sourceUrl} />
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Open the profit calculator
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        {/* 1. Category rates */}
        <section aria-labelledby="category-rates">
          <h2
            id="category-rates"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Category commission rates
          </h2>
          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{model.rateRangeNote}</p>
          {model.tierNotes.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Seller tiers</h3>
              <div className="mt-1.5">
                <TierNotes notes={model.tierNotes} />
              </div>
            </div>
          ) : null}
          {model.knownRanges.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Published ranges</h3>
              <div className="mt-1.5">
                <KnownRangeList ranges={model.knownRanges} />
              </div>
            </div>
          ) : null}
          {/* UK's Excel lists 343 sub-categories, so the table gets a search
              box. UK only: the other four markets top out at 63 rows and stay
              a plain static table. The rows are still server-rendered, so all
              347 are in the HTML for search engines and for readers without
              JavaScript. */}
          {meta.market === 'UK' ? (
            <div className="mt-4">
              <CategoryTableFilter>
                <CategoryRateTable
                  rows={model.categoryRates}
                  currency={model.currency}
                  showParentLabel
                />
              </CategoryTableFilter>
            </div>
          ) : (
            <div className="mt-4">
              <CategoryRateTable rows={model.categoryRates} currency={model.currency} />
            </div>
          )}
        </section>

        {/* 2. Transaction fees */}
        <section aria-labelledby="transaction-fees">
          <h2
            id="transaction-fees"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Transaction fees
          </h2>
          {model.transactionFees.status === 'available' ? (
            <div className="mt-3">
              <FeeLineTable
                lines={model.transactionFees.data}
                caption={`Transaction fees in ${model.currency}.`}
              />
            </div>
          ) : (
            <div className="mt-3">
              <DataDisclosureCard
                reason={model.transactionFees.reason}
                guidance={model.transactionFees.guidance}
                sourceUrl={model.sourceUrl}
              />
            </div>
          )}
        </section>

        {/* 3. Fixed and per-order fees */}
        <section aria-labelledby="fixed-fees">
          <h2 id="fixed-fees" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Fixed and per-order fees
          </h2>
          {model.fixedFees.status === 'available' ? (
            <div className="mt-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {model.fixedFees.data.intro}
              </p>
              <div className="mt-3">
                <FeeLineTable
                  lines={model.fixedFees.data.lines}
                  caption={`Fixed and per-order fees in ${model.currency}.`}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <DataDisclosureCard
                reason={model.fixedFees.reason}
                guidance={model.fixedFees.guidance}
                sourceUrl={model.sourceUrl}
              />
            </div>
          )}
        </section>

        {/* 4. Category exceptions */}
        <section aria-labelledby="category-exceptions">
          <h2
            id="category-exceptions"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Category exceptions
          </h2>
          {model.exceptions.length > 0 ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
                Categories that are charged differently from the table above.
              </p>
              <CategoryExceptionList rows={model.exceptions} />
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                No category-level exception rules are recorded in our dataset for{' '}
                {meta.countryName}. Our extraction coverage for this market is &ldquo;
                {model.coverage}&rdquo;, so treat a flat reading of the table above with that in
                mind.
              </p>
              {model.tierNotes.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Seller tiers instead
                  </h3>
                  <div className="mt-1.5">
                    <TierNotes notes={model.tierNotes} />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* 5. Refund administration fee - US only, per the PRD */}
        {meta.market === 'US' ? (
          <section aria-labelledby="refund-admin-fee">
            <h2
              id="refund-admin-fee"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Refund administration fees
            </h2>
            <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              Some sellers are charged a fee when they process a refund. Whether it applies to you
              depends on your account and your return rate.
            </p>
            <div className="mt-3">
              <DataDisclosureCard
                reason={model.refundAdminFee.status === 'unverified' ? model.refundAdminFee.reason : ''}
                guidance={
                  model.refundAdminFee.status === 'unverified' ? model.refundAdminFee.guidance : undefined
                }
                sourceUrl={model.sourceUrl}
              />
            </div>
          </section>
        ) : null}

        {/* 6. New seller promotions */}
        <section aria-labelledby="new-seller-promo">
          <h2
            id="new-seller-promo"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            New seller promotions
          </h2>
          {model.newSellerPromo.status === 'available' ? (
            <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm text-green-900 dark:text-green-200">
                Promotional rate: <span className="font-semibold">{model.newSellerPromo.data.rateLabel}</span>
              </p>
              <p className="mt-1.5 text-sm text-green-900/90 dark:text-green-200/90">
                {model.newSellerPromo.data.notes}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <DataDisclosureCard
                reason={model.newSellerPromo.reason}
                guidance={model.newSellerPromo.guidance}
                sourceUrl={model.sourceUrl}
              />
            </div>
          )}
        </section>

        {/* 7. Affiliate commission */}
        <section aria-labelledby="affiliate-commission">
          <h2
            id="affiliate-commission"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Affiliate commission guide
          </h2>
          <div className="mt-3">
            <AffiliateGuide section={model.affiliate} sourceUrl={model.sourceUrl} />
          </div>
        </section>

        {/* 8. Mini calculator */}
        <section aria-labelledby="estimate-fees">
          <h2 id="estimate-fees" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Estimate fees for your price
          </h2>
          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            Enter a price and a category. This runs the same engine as the full calculator, so the
            estimate matches what you would get there.
          </p>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <MiniFeeCalculator rates={miniCalculatorRates} />
          </div>
          <p className="mt-3 text-sm">
            <Link href="/" className="font-medium underline underline-offset-2 dark:text-zinc-200">
              Add your costs and see real profit
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq">
          <h2 id="faq" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Frequently asked questions
          </h2>
          <div className="mt-3">
            <FaqAccordion items={model.faq} />
          </div>
        </section>

        {/* Affiliate / sponsor links. Renders nothing until a real tracking URL
            exists; see @/lib/seo/sponsor-links. */}
        <SponsorLinks />

        {/* Provenance */}
        <section aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Where these numbers come from
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Official source</dt>
              <dd>
                <a
                  href={model.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {model.sourceUrl}
                  <span className="sr-only"> - opens in a new tab</span>
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Rate file dated</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{formatIsoDate(model.sourceDate)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Last verified</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{formatIsoDate(model.lastVerified)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Extraction coverage</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {model.coverage}. {model.coverageNote}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <SellerCenterCta url={model.sourceUrl} />
            <SellerCenterCta url={model.sourceUrl} label="Check your account's real fees" variant="secondary" />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 text-sm sm:px-6">
          <p className="text-zinc-600 dark:text-zinc-400">
            Rates change. Confirm anything you plan to rely on in TikTok Seller Center before you act
            on it.
          </p>
          <p className="mt-2">
            <Link href="/" className="underline underline-offset-2 dark:text-zinc-200">
              TikTok Shop Profit Calculator
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
