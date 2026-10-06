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
    // The description must not overclaim. "Does not use cookies" was true but
    // incomplete, because the host does log an IP address on every request. The
    // page now says what is actually collected.
    expect(meta.description).toMatch(/no cookies/i);
    expect(meta.description).toMatch(/server log/i);
    expect(meta.description).not.toMatch(/store nothing about you/i);
    expect(meta.alternates?.canonical).toBe('/tiktok/privacy');
  });
});
