import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import TermsPage, { generateMetadata as termsMeta } from './page';
import { documentForSlug } from '@/lib/legal/content';

afterEach(cleanup);

describe('/terms', () => {
  it('renders the terms content', () => {
    const { container } = render(<TermsPage />);
    const document = documentForSlug('terms')!;
    expect(container.querySelector('h1')?.textContent).toBe(document.title);
    for (const section of document.sections) {
      expect(container.querySelector(`#${section.id}`)).not.toBeNull();
    }
  });

  it('exports metadata with a canonical URL', () => {
    const meta = termsMeta();
    expect(meta.title).toContain('Terms of Use');
    expect(meta.alternates?.canonical).toBe('/terms');
  });
});
