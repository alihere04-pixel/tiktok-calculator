import { describe, it, expect } from 'vitest';
import {
  LEGAL_DOCUMENTS,
  LEGAL_SLUGS,
  documentForSlug,
  legalOpenItems,
} from './content';

const OPEN = 'OPEN_ITEM';

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

  it('claims no cookies, which is true of the code as written', () => {
    // The app sets no cookies: there is no session, no auth and no tracker. If
    // this test ever fails because someone added a cookie, the page is right and
    // the code is wrong.
    const text = JSON.stringify(privacy);
    expect(text).toContain('No cookies are set by this site.');
    expect(text).toContain('No analytics or tracking scripts run by default.');
  });

  it('does not promise a data subject access process it cannot support', () => {
    // With no stored data there is nothing to export or delete, so the page says
    // so rather than implying a portal exists.
    expect(JSON.stringify(privacy)).toContain('collect nothing about you');
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
  it('reports every section that still needs a real value', () => {
    const open = legalOpenItems();
    // These are the values a real legal document needs and this repo does not
    // have: operator identity, contact address, governing jurisdiction.
    expect(open.map((o) => o.marker)).toEqual(
      expect.arrayContaining(['contact', 'acceptance', 'governing-law'])
    );
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
    expect(text).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/); // no invented email
  });
});
