import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DisclaimerPage, { generateMetadata as disclaimerMeta } from './page';
import { documentForSlug } from '@/lib/legal/content';

afterEach(cleanup);

describe('/disclaimer', () => {
  it('renders the disclaimer content', () => {
    const { container } = render(<DisclaimerPage />);
    const document = documentForSlug('disclaimer')!;
    expect(container.querySelector('h1')?.textContent).toBe(document.title);
    for (const section of document.sections) {
      expect(container.querySelector(`#${section.id}`)).not.toBeNull();
    }
  });

  it('exports metadata with a canonical URL and no robots block', () => {
    const meta = disclaimerMeta();
    expect(meta.title).toContain('Disclaimer');
    expect(meta.alternates?.canonical).toBe('/disclaimer');
    expect((meta as { robots?: unknown }).robots).toBeUndefined();
  });
});
