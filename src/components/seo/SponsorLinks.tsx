import { activeSponsorLinks, SPONSOR_LINKS_ENABLED } from '@/lib/seo/sponsor-links';
import { sourceHost } from '@/lib/seo/format';

/**
 * Affiliate and sponsor links.
 *
 * Renders nothing while the programme is switched off, which is the current
 * state. See `@/lib/seo/sponsor-links` for why it ships disabled.
 *
 * When links do render, two things are non-negotiable and both are tested:
 *
 *   - `rel="sponsored noopener noreferrer"`. `sponsored` is what tells a
 *     search engine the link is a paid placement, `noopener` stops the target
 *     reaching back through `window.opener`, and `noreferrer` withholds the
 *     referrer. A paid link without `sponsored` is a manual-action risk.
 *   - A visible label saying it is an affiliate link. A label in a tooltip or
 *     an `aria-label` is not a disclosure; it has to be visible text.
 *
 * The component is a server component, so the links are in the static HTML.
 */
export function SponsorLinks({ className }: { className?: string }) {
  const links = activeSponsorLinks();

  if (links.length === 0) return null;

  const hasAffiliate = links.some((link) => link.affiliate);

  return (
    <section
      aria-labelledby="sponsor-links"
      className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ''}`}
    >
      <h2
        id="sponsor-links"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Next steps
      </h2>

      {hasAffiliate ? (
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          Some links below are affiliate links. We may earn a commission if you sign up. It does
          not change what you pay, and it does not change the numbers on this page.
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {link.label}
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens {sourceHost(link.url)} in a new tab)</span>
            </a>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {link.affiliate ? 'Affiliate link. ' : ''}
              {link.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Exposed for the launch checklist, not for rendering. */
export const SPONSOR_PROGRAMME_ENABLED = SPONSOR_LINKS_ENABLED;
