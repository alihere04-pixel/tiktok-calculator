/**
 * Site-wide configuration.
 *
 * The absolute site URL matters more than it looks. Next resolves relative
 * canonicals against `metadataBase`, and when that is unset it falls back to
 * `http://localhost:3000` and prints a build warning. The result is a site whose
 * canonical tags all point at localhost, which is the kind of mistake that
 * quietly costs rankings for months before anyone notices.
 *
 * There is no known production domain, so `siteUrl()` returns a localhost
 * fallback and `SITE_URL_OPEN_ITEM` stays true. That keeps the build green while
 * making the missing value impossible to overlook: the launch checklist and the
 * test suite both read it.
 *
 * Set NEXT_PUBLIC_SITE_URL to the real origin, with no trailing slash.
 */

const LOCAL_FALLBACK = 'http://localhost:3000';

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return LOCAL_FALLBACK;
  // A trailing slash produces a double slash in every canonical and sitemap URL.
  return configured.replace(/\/+$/, '');
}

/** True when no real domain has been supplied yet. Blocks launch. */
export function SITE_URL_OPEN_ITEM(): boolean {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return !configured || configured === LOCAL_FALLBACK;
}

export function siteUrlOpenItems(): string[] {
  return SITE_URL_OPEN_ITEM()
    ? [
        'NEXT_PUBLIC_SITE_URL is not set. Set it to the real origin (e.g. https://example.com) before launch, or canonical and sitemap URLs will point at localhost.',
      ]
    : [];
}

/**
 * The public contact address.
 *
 * Namecheap email forwarding, `contact@fynza.store` -> a Gmail inbox. Nothing
 * here sends mail: the site only ever renders a `mailto:` link, so there is no
 * SMTP credential, no provider SDK and no third-party script on the page.
 *
 * Kept as a constant rather than inlined so the footer link has one definition.
 * The privacy notice in `src/lib/legal/content.ts` publishes the same address but
 * is deliberately *not* wired to this constant: a legal notice has its own
 * exact-set test, and coupling them would mean adding a footer link could
 * silently rewrite a published legal contact. They must be changed together, on
 * purpose, once delivery to any new address has been confirmed.
 */
export const CONTACT_EMAIL = 'contact@fynza.store';

/** Absolute URL for an internal path. */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${clean}`;
}
