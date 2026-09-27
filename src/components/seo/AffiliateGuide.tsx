import { Badge } from '@/components/ui/Badge';
import { formatRate } from '@/lib/seo/format';
import type { SectionData, AffiliateSection } from '@/lib/seo/market-pages';
import { DataDisclosureCard } from './DataDisclosureCard';

/**
 * Affiliate commission guide.
 *
 * The three collaboration models below are named in our own rate schema
 * (`openCollabRange`, `targetedCollabRange`, `shopAdsMinRatio`), so describing
 * what each one *is* is grounded in our data model. The rates are a different
 * matter: `affiliate` is not populated in any of the five rate files, and the
 * schema only constrains those fields to a two-element array of values between 0
 * and 1. That is a validation bound, not a published rate range.
 *
 * So this component prints no number for affiliate commission at all. If a rate
 * file later populates `affiliate`, the real values are rendered from the model
 * and the disclosure card disappears, with no change here.
 */

const MODELS: { term: string; definition: string }[] = [
  {
    term: 'Open collaboration',
    definition:
      'Any creator can apply to promote your products. You set a commission rate that applies to everyone who joins, which is why it is usually the simpler of the two to set up.',
  },
  {
    term: 'Targeted collaboration',
    definition:
      'You invite specific creators and agree a rate with each of them, usually for higher-volume or higher-quality content. Rates differ per creator, so this is not a single platform figure either.',
  },
  {
    term: 'Shop Ads',
    definition:
      'Commission is tied to advertising spend rather than to a creator agreement. Our schema tracks a minimum commission-to-spend ratio for this, because a Shop Ads order can cost you ad spend on top of commission.',
  },
];

/** One collaboration model. `dl` is used so the term/definition pairing is explicit. */
function ModelList() {
  return (
    <dl className="space-y-3">
      {MODELS.map((model) => (
        <div
          key={model.term}
          className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{model.term}</dt>
          <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{model.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Real numbers, rendered only when a rate file actually supplies them. */
function AffiliateRateTable({ config }: { config: NonNullable<AffiliateSection['config']> }) {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Open collaboration range',
      value: `${formatRate(config.openCollabRange[0])} - ${formatRate(config.openCollabRange[1])}`,
    },
    {
      label: 'Targeted collaboration range',
      value: `${formatRate(config.targetedCollabRange[0])} - ${formatRate(config.targetedCollabRange[1])}`,
    },
    {
      label: 'Minimum Shop Ads commission ratio',
      value: formatRate(config.shopAdsMinRatio),
    },
    {
      label: 'Commission decrease protection',
      value: `${config.decreaseProtectionDays} days`,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="pb-2 text-left text-sm text-zinc-600 dark:text-zinc-400">
          Affiliate commission rates for this market.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th
              scope="col"
              className="px-2 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Model
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <th
                scope="row"
                className="px-2 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {row.label}
              </th>
              <td className="px-2 py-2 text-sm font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        <a
          href={config.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Official source
          <span className="sr-only"> - opens in a new tab</span>
        </a>
      </p>
    </div>
  );
}

export function AffiliateGuide({
  section,
  sourceUrl,
}: {
  section: SectionData<AffiliateSection>;
  sourceUrl: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Affiliate commission is money you pay a creator, on top of the platform fees above. TikTok
        Shop runs three models for it, and which one applies changes the rate you will actually
        pay.
      </p>

      <ModelList />

      {section.status === 'available' && section.data.config ? (
        <AffiliateRateTable config={section.data.config} />
      ) : (
        <div className="space-y-3">
          <DataDisclosureCard
            reason={section.status === 'unverified' ? section.reason : ''}
            guidance={section.status === 'unverified' ? section.guidance : undefined}
            sourceUrl={sourceUrl}
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            <Badge level="needs-verification" label="Unverified" /> This is a structural guide, not a
            rate table. Nothing above is a price.
          </p>
        </div>
      )}
    </div>
  );
}
