import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DataDisclosureCard } from './DataDisclosureCard';

afterEach(cleanup);

const URL = 'https://seller-uk.tiktok.com/university/essay?knowledge_id=1';

describe('DataDisclosureCard', () => {
  it('uses the fixed title the PRD specifies', () => {
    render(<DataDisclosureCard reason="We have no verified rate." sourceUrl={URL} />);
    expect(screen.getByText('Not in our verified dataset')).toBeTruthy();
  });

  it('shows the reason as real body text, not a tooltip or image', () => {
    const { container } = render(
      <DataDisclosureCard reason="We have no verified rate." sourceUrl={URL} />
    );
    expect(screen.getByText('We have no verified rate.')).toBeTruthy();
    // Must survive without CSS and be readable by assistive technology.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('shows the guidance when provided', () => {
    render(
      <DataDisclosureCard reason="Because A." guidance="Do B instead." sourceUrl={URL} />
    );
    expect(screen.getByText('Do B instead.')).toBeTruthy();
  });

  it('omits the guidance paragraph when it is not provided', () => {
    const { container } = render(
      <DataDisclosureCard reason="Because A." sourceUrl={URL} />
    );
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('links to the official source with the fixed CTA label', () => {
    render(<DataDisclosureCard reason="Because A." sourceUrl={URL} />);
    const link = screen.getByRole('link', { name: /Verify in TikTok Seller Center/ });
    expect(link.getAttribute('href')).toBe(URL);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never renders a number it was not given', () => {
    // The card is the fallback for missing data, so it must not smuggle in a
    // plausible-looking rate.
    render(
      <DataDisclosureCard
        reason="We do not have verified affiliate commission rates for this market."
        sourceUrl={URL}
      />
    );
    expect(screen.getByText(/affiliate commission rates/).textContent).not.toMatch(/\d+%/);
  });
});
