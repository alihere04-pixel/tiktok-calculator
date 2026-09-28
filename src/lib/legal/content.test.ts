import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  LEGAL_DOCUMENTS,
  LEGAL_SLUGS,
  documentForSlug,
  legalOpenItems,
  OPEN_ITEM_MARKER,
  type LegalDocument,
} from './content';
import { monitoringConfig } from '@/lib/monitoring/config';

const OPEN = 'OPEN_ITEM';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('legal documents', () => {
  it('defines exactly the three pages the PRD asks for', () => {
    expect(LEGAL_SLUGS).toEqual(['disclaimer', 'privacy', 'terms']);
  });

  it('gives every document a title, description, summary and review date', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.metaDescription.length).toBeGreaterThan(50);
      expect(doc.summary.length).toBeGreaterThan(0);
      expect(doc.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('gives every document at least three sections with content', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.sections.length).toBeGreaterThanOrEqual(3);
      for (const section of doc.sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        for (const paragraph of section.paragraphs) {
          expect(paragraph.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('uses unique section ids per document, so heading anchors cannot collide', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('resolves a slug and rejects an unknown one', () => {
    expect(documentForSlug('privacy')?.title).toBe('Privacy Policy');
    expect(documentForSlug('cookies')).toBeUndefined();
  });

  it('states on every page that it is not affiliated with TikTok', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const text = JSON.stringify(doc);
      expect(text).toContain('not affiliated with');
    }
  });
});

describe('privacy page accuracy', () => {
  const privacy = documentForSlug('privacy')!;

  it('claims no cookies, and no analytics, in a way the code actually backs', () => {
    // This used to be a string search: assert the sentence is in the document.
    // That passed while the root layout mounted Vercel Web Analytics
    // unconditionally, so the page shipped a claim the code contradicted. The
    // failure this guards is the reverse one now: the page must not say "no
    // analytics" unless the config that gates the tracker agrees. The gate lives
    // in `lib/monitoring/config.ts`; `AnalyticsGate` is what honours it, and
    // `AnalyticsGate.test.tsx` asserts the resulting DOM.
    const text = JSON.stringify(privacy);
    expect(text).toContain('No cookies are set by this site.');
    expect(text).toContain('No analytics or tracking scripts run by default.');

    for (const key of [
      'NEXT_PUBLIC_ANALYTICS_PROVIDER',
      'NEXT_PUBLIC_ANALYTICS_DOMAIN',
      'NEXT_PUBLIC_CONSENT_GATE',
    ]) {
      vi.stubEnv(key, '');
    }
    // The prose is only honest while the tracker is off. If someone turns
    // analytics on, this fails and forces the page to be updated in the same
    // change rather than at some later review.
    expect(monitoringConfig().analytics.enabled).toBe(false);
  });

  it('discloses the server log data it does receive, rather than denying all of it', () => {
    // The failure this guards: a privacy page that claims to collect no personal
    // data at all, while the host records an IP address on every request. That
    // claim is false, and a false claim in a privacy notice is the kind of thing
    // a regulator checks first. The page must name IP address explicitly.
    const text = JSON.stringify(privacy);
    expect(text).toContain('IP address');
    expect(text).toMatch(/server log/i);
    // The lawful basis for that data has to be named, or the rights section
    // below it is decorative.
    expect(text).toContain('legitimate interests');
  });

  it('states the rights a UK data subject can exercise', () => {
    const rights = privacy.sections.find((s) => s.id === 'data-protection-rights');
    const bullets = rights?.bullets ?? [];
    // All seven rights the ICO lists. A partial list is a weaker notice.
    for (const right of [
      'access',
      'rectification',
      'erasure',
      'restriction of processing',
      'object',
      'data portability',
      'withdraw consent',
    ]) {
      expect(bullets.join(' ').toLowerCase()).toContain(right);
    }
  });

  it('gives a one-month response window and a complaints route', () => {
    const text = JSON.stringify(privacy);
    expect(text).toContain('one month');
    expect(text).toContain('Information Commissioner');
  });

  it('names a real contact address for privacy requests', () => {
    // The operator has supplied one, so the page must not still point at a
    // placeholder. A privacy notice with no reachable contact is unenforceable
    // in practice.
    const contact = privacy.sections.find((s) => s.id === 'contact-details');
    expect(contact?.paragraphs.join(' ')).toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/);
    expect(contact?.paragraphs.join(' ')).not.toContain(OPEN);
  });

  it('discloses that the calculator inputs are not stored', () => {
    expect(JSON.stringify(privacy)).toContain('is not written to storage');
  });

  it('names the affiliate-link situation, which is now a real feature', () => {
    expect(JSON.stringify(privacy)).toContain('Affiliate links');
  });
});

describe('terms page', () => {
  const terms = documentForSlug('terms')!;

  it('caps the warranty and liability', () => {
    const text = JSON.stringify(terms);
    expect(text).toContain('as is');
    expect(text).toContain('without warranties of any kind');
  });

  it('does not attempt to exclude liability that cannot be excluded', () => {
    expect(JSON.stringify(terms)).toContain('Nothing in these terms excludes liability that cannot lawfully be excluded');
  });

  it('states acceptable use', () => {
    const section = terms.sections.find((s) => s.id === 'permitted-use');
    expect(section?.bullets?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe('unfilled placeholders are surfaced, not hidden', () => {
  it('reports no open items, because every value is now supplied', () => {
    // All three were filled on 2026-09-28: the operator trading name and the
    // jurisdiction on /terms, and the hosting log retention period on /privacy.
    // The next test proves this is an empty result rather than a broken detector.
    expect(legalOpenItems()).toEqual([]);
  });

  it('still detects a placeholder when one is present', () => {
    // The guard against the guard. Asserting the real list is empty proves
    // nothing about the code that produces it: reintroduce an `OPEN_ITEM` and
    // both sides of a marker-count comparison go to one, so a self-consistency
    // check would stay green while a placeholder shipped. This drives the real
    // function with a document that actually carries the marker.
    const smuggled: LegalDocument = {
      slug: 'privacy',
      title: 'Synthetic',
      metaDescription: 'A synthetic document used only to exercise the detector.',
      summary: 'Synthetic.',
      updated: '2026-09-28',
      sections: [
        { id: 'clean', heading: 'Clean', paragraphs: ['Nothing missing here.'] },
        { id: 'smuggled', heading: 'Smuggled', paragraphs: [`Value is ${OPEN_ITEM_MARKER}.`] },
      ],
    };
    expect(legalOpenItems([smuggled])).toEqual([{ document: 'privacy', marker: 'smuggled' }]);
    // And an entirely clean document still yields nothing, so the detector is not
    // simply reporting the last section or matching on section count.
    expect(legalOpenItems([{ ...smuggled, sections: [smuggled.sections[0]] }])).toEqual([]);
  });

  it('uses exactly the known placeholder marker, and nothing else', () => {
    // A stray `{{company}}` or `${TODO}` would reach production as-is. The only
    // allowed template marker is the one `legalOpenItems()` reports on.
    for (const doc of LEGAL_DOCUMENTS) {
      const text = JSON.stringify(doc);
      const stray = text.match(/\{\{|\$\{|TODO|FIXME|XXX|Lorem ipsum/gi) ?? [];
      expect(stray).toEqual([]);
      // Every remaining marker is the known one, so the count matches the
      // number of open items reported for this document.
      const markerCount = text.split(OPEN).length - 1;
      const openForDoc = legalOpenItems().filter((o) => o.document === doc.slug).length;
      expect(markerCount).toBe(openForDoc);
    }
  });

  it('does not invent an operator name, company number or address', () => {
    // The failure mode this guards: filling a legal page with a plausible
    // company that does not exist. ByteDance Ltd. is exempt because it is a
    // real third party we must name correctly in the disclaimer.
    const text = JSON.stringify(LEGAL_DOCUMENTS).replace(/ByteDance Ltd\./g, '');
    expect(text).not.toMatch(/\b(Inc|LLC|Ltd|GmbH|Pte Ltd)\b/);
    expect(text).not.toMatch(/\b\d{6,}\b/); // no invented company number

    // Exactly one email is allowed, and it is the address the operator actually
    // supplied. Any other address would be a guess that 404s into a dead
    // mailbox, which is the whole failure mode this test exists to prevent.
    const emails = text.match(/[\w.-]+@[\w-]+\.[a-z]{2,}/g) ?? [];
    expect(new Set(emails)).toEqual(new Set(['alihere04@gmail.com']));
  });

  it('does not invent a postal address, which stays an open item', () => {
    // The ICO's address is exempt: it is a real published address and the
    // notice has to give it for a complaint to be actionable. Any other
    // postal-looking address is a fabrication.
    const icoAddress = 'Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF';
    const text = JSON.stringify(LEGAL_DOCUMENTS);
    const postcodes = text.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g) ?? [];
    expect(new Set(postcodes)).toEqual(new Set(['SK9 5AF']));
    expect(text).toContain(icoAddress);
  });
});
