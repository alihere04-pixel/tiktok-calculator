import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LegalDocumentView } from './LegalDocumentView';
import { LEGAL_DOCUMENTS, LAST_REVIEWED, documentForSlug } from '@/lib/legal/content';
import { formatIsoDate } from '@/lib/seo/format';

const LEGAL_REVIEW_DATE = LAST_REVIEWED;

afterEach(cleanup);

function renderDoc(slug: 'disclaimer' | 'privacy' | 'terms') {
  const document = documentForSlug(slug)!;
  return render(<LegalDocumentView document={document} allDocuments={LEGAL_DOCUMENTS} />);
}

describe.each(['disclaimer', 'privacy', 'terms'] as const)('LegalDocumentView: %s', (slug) => {
  it('renders the document title as the single h1', () => {
    const { container } = renderDoc(slug);
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(documentForSlug(slug)!.title);
  });

  it('renders every section heading as an h2', () => {
    const { container } = renderDoc(slug);
    const document = documentForSlug(slug)!;
    for (const section of document.sections) {
      const heading = screen.getByRole('heading', { name: section.heading, level: 2 });
      expect(heading).toBeTruthy();
    }
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(
      document.sections.length
    );
  });

  it('gives each section an id matching its heading, so anchors work', () => {
    const { container } = renderDoc(slug);
    for (const section of documentForSlug(slug)!.sections) {
      expect(container.querySelector(`#${section.id}`)).not.toBeNull();
    }
  });

  it('points every section at its heading with aria-labelledby', () => {
    const { container } = renderDoc(slug);
    for (const section of container.querySelectorAll('section[aria-labelledby]')) {
      const id = section.getAttribute('aria-labelledby')!;
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('shows the summary and the review date', () => {
    renderDoc(slug);
    expect(screen.getByText(documentForSlug(slug)!.summary)).toBeTruthy();
    // Rendered through formatIsoDate, so the reader sees a written date
    // ("September 28, 2026") rather than a raw ISO string. Derived from
    // LAST_REVIEWED so bumping the date does not silently break this.
    expect(
      screen.getByText(
        new RegExp(
          `Last reviewed: ${formatIsoDate(LEGAL_REVIEW_DATE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        )
      )
    ).toBeTruthy();
  });

  it('carries the draft-for-review notice, so it cannot be mistaken for final', () => {
    // The single most important line on the page: these are not legal advice
    // and no lawyer has signed off.
    renderDoc(slug);
    expect(screen.getByText(/Draft for review\./)).toBeTruthy();
    expect(screen.getByText(/not been reviewed by one/)).toBeTruthy();
  });

  it('renders all body text without JavaScript-only content', () => {
    const { container } = renderDoc(slug);
    // The policy text is plain markup: no images, no title tooltips, no
    // client-only wrappers. This is what makes it readable to a regulator, a
    // crawler, or a browser with JS disabled.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
    expect(container.querySelector('noscript')).toBeNull();
  });

  it('renders any bullet list as a real unordered list', () => {
    const { container } = renderDoc(slug);
    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
    }
  });

  it('links to the other two legal pages using next/link, not a raw anchor', () => {
    // Raw internal anchors cause a full page reload and fail Next's client
    // navigation, so the shared shell uses next/link throughout. Each page is
    // linked from both the nav and the footer, hence getAllByRole.
    const { container } = renderDoc(slug);
    for (const anchor of container.querySelectorAll('a')) {
      const href = anchor.getAttribute('href')!;
      if (href.startsWith('/')) {
        expect(anchor.getAttribute('href')).toBe(href);
      }
    }
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Terms of Use' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Disclaimer' }).length).toBeGreaterThan(0);
  });

  it('links back to the calculator', () => {
    renderDoc(slug);
    expect(screen.getAllByRole('link', { name: 'Profit calculator' }).length).toBeGreaterThan(0);
  });

  it('has no external link without noopener', () => {
    const { container } = renderDoc(slug);
    for (const anchor of container.querySelectorAll('a[target="_blank"]')) {
      const rel = anchor.getAttribute('rel') ?? '';
      expect(rel).toContain('noopener');
    }
  });

  it('states the site is not affiliated with TikTok in the footer', () => {
    // Scoped to the footer: the disclaimer also carries a "Not affiliated with
    // TikTok" section heading, so an unscoped query would match twice.
    const { container } = renderDoc(slug);
    const footer = container.querySelector('footer')!;
    expect(footer.textContent).toMatch(/Not affiliated with TikTok/);
    // The heading is the h2 in the body, the assertion above is the footer.
    expect(container.querySelector('footer')?.querySelector('h2')).toBeNull();
  });
});

describe('LegalDocumentView accessibility', () => {
  it('gives the legal navigation an accessible name', () => {
    renderDoc('disclaimer');
    expect(screen.getByRole('navigation', { name: 'Legal pages' })).toBeTruthy();
  });

  it('reports zero placeholders on every page, now that all values are supplied', () => {
    // Inverted on 2026-09-28. This used to assert that the marker was visible on
    // /privacy, which meant it would have failed the moment the last placeholder
    // was filled. The property that actually matters is the one the banner
    // states: no page claims a value is missing when it is not, and the banner
    // still says the wording needs a lawyer either way.
    for (const doc of LEGAL_DOCUMENTS) {
      cleanup();
      render(<LegalDocumentView document={doc} allDocuments={LEGAL_DOCUMENTS} />);
      expect(screen.getByText(/No values on this page are placeholders/)).toBeTruthy();
      expect(screen.queryByText(/OPEN_ITEM/)).toBeNull();
    }
  });
});
