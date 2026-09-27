import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PrivacyPage, { generateMetadata as privacyMeta } from './page';
import { documentForSlug } from '@/lib/legal/content';

afterEach(cleanup);

describe('/privacy', () => {
  it('renders the privacy content', () => {
    const { container } = render(<PrivacyPage />);
    const document = documentForSlug('privacy')!;
    expect(container.querySelector('h1')?.textContent).toBe(document.title);
    for (const section of document.sections) {
      expect(container.querySelector(`#${section.id}`)).not.toBeNull();
    }
  });

  it('exports metadata with a canonical URL', () => {
    const meta = privacyMeta();
    expect(meta.title).toContain('Privacy Policy');
    expect(meta.description).toMatch(/does not use cookies/i);
    expect(meta.alternates?.canonical).toBe('/privacy');
  });
});
