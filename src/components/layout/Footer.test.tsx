import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('renders the site disclaimer', () => {
    render(<Footer />);
    expect(screen.getByText('An independent tool. Not affiliated with TikTok.')).toBeTruthy();
  });

  it('links to the profit calculator', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Profit Calculator' });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('links to the privacy policy', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  it('links to the terms of use', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Terms of Use' });
    expect(link.getAttribute('href')).toBe('/terms');
  });

  it('links to the disclaimer', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Disclaimer' });
    expect(link.getAttribute('href')).toBe('/disclaimer');
  });

  it('uses next/link for client-side navigation', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });

  it('has accessible navigation landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('navigation', { name: 'Site navigation' })).toBeTruthy();
  });

  it('applies dark mode styles', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer?.classList.contains('dark:border-zinc-800')).toBe(true);
    expect(footer?.classList.contains('dark:bg-zinc-900')).toBe(true);
  });

  it('applies responsive container constraints', () => {
    const { container } = render(<Footer />);
    const inner = container.querySelector('footer > div');
    expect(inner?.classList.contains('mx-auto')).toBe(true);
    expect(inner?.classList.contains('max-w-3xl')).toBe(true);
    expect(inner?.classList.contains('px-4')).toBe(true);
    expect(inner?.classList.contains('sm:px-6')).toBe(true);
  });

  describe('contact address', () => {
    it('shows the public contact email as visible text', () => {
      render(<Footer />);
      expect(screen.getByText('contact@fynza.store')).toBeTruthy();
    });

    it('links the address so a visitor can click it to email us', () => {
      render(<Footer />);
      const link = screen.getByRole('link', { name: 'contact@fynza.store' });
      expect(link.getAttribute('href')).toBe('mailto:contact@fynza.store');
    });

    it('opens the visitor mail client rather than navigating away', () => {
      // A mailto: href must not be routed through next/link, which would try an
      // internal navigation to a non-existent path.
      render(<Footer />);
      const link = screen.getByRole('link', { name: 'contact@fynza.store' });
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')?.startsWith('mailto:')).toBe(true);
      expect(link.getAttribute('target')).toBeNull();
    });

    it('does not expose the forwarding destination address', () => {
      // contact@fynza.store forwards to a personal mailbox. Publishing the
      // destination would put the operator's personal inbox on a public page.
      const { container } = render(<Footer />);
      expect(container.textContent).not.toContain('alhere04');
      expect(container.textContent).not.toContain('gmail.com');
    });

    it('adds no third-party email service or tracker', () => {
      const { container } = render(<Footer />);
      const html = container.innerHTML;
      for (const needle of ['formaction', 'mailto:?', 'smtp', 'sendgrid', 'mailchimp', 'hubspot', 'formspree']) {
        expect(html.toLowerCase()).not.toContain(needle);
      }
    });

    it('keeps the contact link visually consistent with the existing links', () => {
      render(<Footer />);
      const link = screen.getByRole('link', { name: 'contact@fynza.store' });
      expect(link.className).toContain('underline');
      expect(link.className).toContain('underline-offset-2');
      expect(link.className).toContain('dark:text-zinc-200');
    });
  });
});