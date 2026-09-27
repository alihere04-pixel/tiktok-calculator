import { sourceHost } from '@/lib/seo/format';

/**
 * "Verify in Seller Center" call to action.
 *
 * The PRD asks every SEO page to link back to official sources, and the
 * disclosure cards need the same link. Both use this one component so the label
 * and the accessible name never drift between the two.
 *
 * External links open in a new tab, so each one carries `rel="noopener
 * noreferrer"` and an `sr-only` suffix that tells a screen-reader user the link
 * leaves the site. The visible label alone would be ambiguous.
 */
export function SellerCenterCta({
  url,
  label = 'Verify in TikTok Seller Center',
  variant = 'primary',
  className,
}: {
  url: string;
  label?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
      : 'border border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles} ${className ?? ''}`}
    >
      {label}
      <span aria-hidden="true">↗</span>
      <span className="sr-only">
        {' '}
        (opens {sourceHost(url)} in a new tab)
      </span>
    </a>
  );
}
