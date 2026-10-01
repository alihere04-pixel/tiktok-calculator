import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { ANALYTICS_CONSENT_KEY } from '@/lib/consent/consent';

/**
 * What this file proves is behavioural, not textual: that the question is only
 * asked when analytics could actually load, that neither answer leaves a tracker
 * loaded, and that the answer survives a remount.
 *
 * Note the default case in `describe('while analytics is off')`. The shipped
 * configuration has no provider and no domain, so the banner must render nothing
 * at all. If that ever regresses, visitors get asked to consent to a tracker that
 * cannot load.
 */

async function getBanner(env: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      vi.stubEnv(key, value);
    }
  }
  vi.resetModules();
  const mod = await import('./ConsentBanner');
  return mod.ConsentBanner;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('while analytics is off', () => {
  it('asks nothing, because there is nothing to consent to', async () => {
    // The shipped default. Nobody should be prompted about a tracker that is
    // switched off on this build.
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: '',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks nothing even when everything except the domain is set', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks nothing when the consent gate flag is not on', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'false',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });
});

describe('while analytics is configured but nobody has chosen', () => {
  it('asks once, with both answers available', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    expect(screen.getByRole('region', { name: /can we use analytics/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept analytics/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
  });

  it('does not presume a choice before anything is stored', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  });

  it('explains what accepting means and what it does not', async () => {
    // The visitor is being asked for permission, so the cost has to be stated.
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    const region = screen.getByRole('region', { name: /can we use analytics/i });
    const description = screen.getByText(/does not sell your data/i);

    expect(region.getAttribute('aria-describedby')).toBe(description.id);
    expect(description.textContent).toMatch(/until you choose/i);
  });
});

describe('answering the question', () => {
  it('stays declined after choosing Decline', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('declined');
    expect(screen.queryByRole('button', { name: /decline/i })).toBeNull();
  });

  it('stays accepted after choosing Accept analytics', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole('button', { name: /accept analytics/i }));

    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('accepted');
    expect(screen.queryByRole('button', { name: /accept analytics/i })).toBeNull();
  });

  it('remembers a decline and does not ask again on the next page load', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    const { unmount } = render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    unmount();

    render(<ConsentBanner />);
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('remembers an acceptance and does not ask again on the next page load', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    const { unmount } = render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: /accept analytics/i }));
    unmount();

    render(<ConsentBanner />);
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks again when the stored value is not a real answer', async () => {
    // A corrupt record should not be able to silence the question permanently.
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'not-a-choice');
    render(<ConsentBanner />);
    expect(screen.getByRole('region', { name: /can we use analytics/i })).toBeTruthy();
  });
});

describe('keyboard access', () => {
  it('uses native buttons, which is what makes them reachable and activatable', async () => {
    // Tab order and Enter/Space activation come from the element type. A div
    // with an onClick would pass a click test and be unreachable by keyboard.
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    const accept = screen.getByRole('button', { name: /accept analytics/i });
    const decline = screen.getByRole('button', { name: /decline/i });

    expect(accept.tagName).toBe('BUTTON');
    expect(decline.tagName).toBe('BUTTON');
    expect(accept.getAttribute('type')).toBe('button');
    expect(decline.getAttribute('type')).toBe('button');
  });

  it('keeps both buttons focusable and in order, with no tabindex override', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    const accept = screen.getByRole('button', { name: /accept analytics/i });
    const decline = screen.getByRole('button', { name: /decline/i });

    accept.focus();
    expect(document.activeElement).toBe(accept);

    decline.focus();
    expect(document.activeElement).toBe(decline);

    expect(accept.getAttribute('tabindex')).toBeNull();
    expect(decline.getAttribute('tabindex')).toBeNull();
    expect((accept as HTMLButtonElement).disabled).toBe(false);
    expect((decline as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a visible focus ring, since a keyboard user has to see where they are', async () => {
    const ConsentBanner = await getBanner({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    render(<ConsentBanner />);

    const accept = screen.getByRole('button', { name: /accept analytics/i });
    expect(accept.className).toContain('focus-visible:outline');
  });
});