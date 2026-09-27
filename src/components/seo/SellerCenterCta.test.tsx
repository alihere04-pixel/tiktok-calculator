import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SellerCenterCta } from './SellerCenterCta';

afterEach(cleanup);

const URL = 'https://seller-us.tiktok.com/university/essay?knowledge_id=123';

describe('SellerCenterCta', () => {
  it('renders the default label', () => {
    render(<SellerCenterCta url={URL} />);
    expect(screen.getByRole('link', { name: /Verify in TikTok Seller Center/ })).toBeTruthy();
  });

  it('accepts a custom label', () => {
    render(<SellerCenterCta url={URL} label="Check your account's real fees" />);
    expect(screen.getByRole('link', { name: /Check your account's real fees/ })).toBeTruthy();
  });

  it('opens in a new tab with a safe rel', () => {
    render(<SellerCenterCta url={URL} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('tells screen-reader users the link leaves the site', () => {
    render(<SellerCenterCta url={URL} />);
    // The visible label alone is ambiguous about the new tab, so the hostname
    // is exposed to assistive technology only.
    expect(screen.getByRole('link').textContent).toContain('seller-us.tiktok.com');
    expect(screen.getByText(/opens seller-us\.tiktok\.com in a new tab/)).toBeTruthy();
  });

  it('hides the decorative arrow from assistive technology', () => {
    const { container } = render(<SellerCenterCta url={URL} />);
    const arrow = container.querySelector('[aria-hidden="true"]');
    expect(arrow).not.toBeNull();
  });

  it('applies a different style for the secondary variant', () => {
    const { container: primary } = render(<SellerCenterCta url={URL} />);
    const { container: secondary } = render(<SellerCenterCta url={URL} variant="secondary" />);
    expect(primary.querySelector('a')?.className).not.toBe(secondary.querySelector('a')?.className);
  });
});
