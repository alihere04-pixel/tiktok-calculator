import { describe, it, expect } from 'vitest';
import {
  SPONSOR_LINKS,
  SPONSOR_LINKS_ENABLED,
  SPONSOR_OPEN_ITEMS,
  activeSponsorLinks,
  sponsorLinksReady,
} from './sponsor-links';

describe('sponsor link configuration', () => {
  it('ships with the programme switched off', () => {
    // The whole point: we have no affiliate contract and no tracking URL, so
    // nothing renders until a real value is supplied.
    expect(SPONSOR_LINKS_ENABLED).toBe(false);
  });

  it('renders nothing while disabled', () => {
    expect(activeSponsorLinks()).toEqual([]);
  });

  it('is not ready to launch, and says so', () => {
    expect(sponsorLinksReady()).toBe(false);
  });

  it('holds no URL until a real one is supplied', () => {
    // Guards the specific failure mode: a hand-typed `?aff=` URL that looks
    // real, 404s, or steals someone else's attribution.
    for (const link of SPONSOR_LINKS) {
      expect(link.url).toBe('');
    }
  });

  it('holds only absolute https URLs, so a relative path cannot ship', () => {
    // An affiliate link must be a full external URL. A relative path would
    // silently point at a page on this site that does not exist.
    for (const link of SPONSOR_LINKS) {
      if (link.url === '') continue;
      expect(() => new URL(link.url)).not.toThrow();
      expect(link.url.startsWith('https://')).toBe(true);
    }
  });

  it('expects a real affiliate URL to carry a tracking parameter', () => {
    // The inverse of the old assertion, which had it backwards. An affiliate
    // link is a tracking identifier on someone else's URL: a configured link
    // with no identifier is not an affiliate link and pays nobody.
    for (const link of SPONSOR_LINKS.filter((l) => l.affiliate && l.url !== '')) {
      expect(link.url).toMatch(/[?&](aff|affiliate|via|utm_|ref|cid)=/i);
    }
  });

  it('marks the signup link as an affiliate link and Seller Center as not', () => {
    // Seller Center is an official page with no money in it, so labelling it
    // "affiliate" would be a false disclosure.
    const signup = SPONSOR_LINKS.find((l) => l.id === 'tiktok-shop-seller-signup');
    const center = SPONSOR_LINKS.find((l) => l.id === 'seller-center');
    expect(signup?.affiliate).toBe(true);
    expect(center?.affiliate).toBe(false);
  });

  it('gives every link a label and description', () => {
    for (const link of SPONSOR_LINKS) {
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.description.length).toBeGreaterThan(20);
    }
  });

  it('uses unique ids', () => {
    const ids = SPONSOR_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists one open item per unconfigured link for the launch checklist', () => {
    expect(SPONSOR_OPEN_ITEMS).toHaveLength(SPONSOR_LINKS.length);
    expect(SPONSOR_OPEN_ITEMS[0]).toMatch(/real tracking URL/);
  });
});
