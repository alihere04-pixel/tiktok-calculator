/**
 * Affiliate and sponsor link configuration.
 *
 * The PRD asks for affiliate links on the SEO pages. They are built, wired and
 * tested, but they are switched OFF, and that is deliberate.
 *
 * An affiliate link is a URL with someone's tracking identifier in it. This
 * repository contains no affiliate ID, no sponsor relationship and no
 * contract, and the only signup URLs anyone has here are guesses. Writing a
 * plausible-looking `?aff=...` URL into the page would create a link that
 * either 404s or, worse, silently attributes someone else's signup to us. So
 * the entries ship with an empty `url` and `enabled: false`.
 *
 * Enabling them is a two-line change plus one real value:
 *
 *   1. Put the actual tracking URL in `url` below.
 *   2. Flip `enabled` to true.
 *
 * `sponsorLinksReady()` exists so a test can assert the site is not shipping a
 * half-configured link, and `SPONSOR_OPEN_ITEMS` feeds the launch checklist.
 */

export interface SponsorLink {
  id: string;
  /** Visible link text. Must not read as an endorsement we have not given. */
  label: string;
  /**
   * The real tracking URL. Empty until a genuine affiliate or sponsor URL
   * exists. Never a guess.
   */
  url: string;
  /** Short explanation shown next to the link. */
  description: string;
  /**
   * Required when we would be paid. Renders the visible affiliate disclosure.
   * Google's guidance treats `rel="sponsored"` and a visible label as the two
   * halves of the same requirement.
   */
  affiliate: boolean;
}

export const SPONSOR_LINKS: SponsorLink[] = [
  {
    id: 'tiktok-shop-seller-signup',
    label: 'Open a TikTok Shop seller account',
    url: '',
    description: 'Official seller registration. Rates on this page come from public documentation; your own account is the authority.',
    affiliate: true,
  },
  {
    id: 'seller-center',
    label: 'Open TikTok Seller Center',
    url: '',
    description: 'Where your real fees, promotions and commission actually live.',
    affiliate: false,
  },
];

/**
 * Master switch. Off until real URLs exist, so no unconfigured link is ever
 * rendered and no placeholder reaches a visitor.
 */
export const SPONSOR_LINKS_ENABLED = false;

/** Links that would render, i.e. are enabled and actually have a URL. */
export function activeSponsorLinks(): SponsorLink[] {
  if (!SPONSOR_LINKS_ENABLED) return [];
  return SPONSOR_LINKS.filter((link) => link.url.trim() !== '');
}

/**
 * True when everything is switched on and configured. A test asserts this stays
 * false until someone has made a deliberate decision, so the omission cannot
 * pass unnoticed.
 */
export function sponsorLinksReady(): boolean {
  return SPONSOR_LINKS_ENABLED && SPONSOR_LINKS.every((link) => link.url.trim() !== '');
}

/** Launch-checklist items for the sponsor programme. */
export const SPONSOR_OPEN_ITEMS: string[] = SPONSOR_LINKS.filter((l) => l.url.trim() === '').map(
  (link) => `Supply a real tracking URL for "${link.label}" (currently blank).`
);
