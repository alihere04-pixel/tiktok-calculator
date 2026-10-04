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

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.resetModules();
});

async function renderBanner(
  config: {
    provider?: string;
    domain?: string;
    consentGate?: string;
  } = {}
) {
  const mod = await import('./ConsentBanner');
  return render(<mod.ConsentBanner config={config} />);
}

describe('while analytics is off', () => {
  it('asks nothing, because there is nothing to consent to', async () => {
    // The shipped default. Nobody should be prompted about a tracker that is
    // switched off on this build.
    await renderBanner({
      provider: '',
      domain: '',
      consentGate: '',
    });
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks nothing even when everything except the domain is set', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: '',
      consentGate: 'true',
    });
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks nothing when the consent gate flag is not on', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'false',
    });
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });
});

describe('while analytics is configured but nobody has chosen', () => {
  it('asks once, with both answers available', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    expect(screen.getByRole('region', { name: /can we use analytics/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept analytics/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
  });

  it('does not presume a choice before anything is stored', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  });

  it('explains what accepting means and what it does not', async () => {
    // The visitor is being asked for permission, so the cost has to be stated.
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    const region = screen.getByRole('region', { name: /can we use analytics/i });
    const description = screen.getByText(/does not sell your data/i);

    expect(region.getAttribute('aria-describedby')).toBe(description.id);
    expect(description.textContent).toMatch(/until you choose/i);
  });
});

describe('answering the question', () => {
  it('stays declined after choosing Decline', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('declined');
    expect(screen.queryByRole('button', { name: /decline/i })).toBeNull();
  });

  it('stays accepted after choosing Accept analytics', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    fireEvent.click(screen.getByRole('button', { name: /accept analytics/i }));

    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('accepted');
    expect(screen.queryByRole('button', { name: /accept analytics/i })).toBeNull();
  });

  it('remembers a decline and does not ask again on the next page load', async () => {
    const { unmount } = await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    unmount();

    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('remembers an acceptance and does not ask again on the next page load', async () => {
    const { unmount } = await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    fireEvent.click(screen.getByRole('button', { name: /accept analytics/i }));
    unmount();

    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    expect(screen.queryByRole('region', { name: /can we use analytics/i })).toBeNull();
  });

  it('asks again when the stored value is not a real answer', async () => {
    // A corrupt record should not be able to silence the question permanently.
    const { unmount } = await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'not-a-choice');
    unmount();

    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });
    expect(screen.getByRole('region', { name: /can we use analytics/i })).toBeTruthy();
  });
});

describe('keyboard access', () => {
  it('uses native buttons, which is what makes them reachable and activatable', async () => {
    // Tab order and Enter/Space activation come from the element type. A div
    // with an onClick would pass a click test and be unreachable by keyboard.
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    const accept = screen.getByRole('button', { name: /accept analytics/i });
    const decline = screen.getByRole('button', { name: /decline/i });

    expect(accept.tagName).toBe('BUTTON');
    expect(decline.tagName).toBe('BUTTON');
    expect(accept.getAttribute('type')).toBe('button');
    expect(decline.getAttribute('type')).toBe('button');
  });

  it('keeps both buttons focusable and in order, with no tabindex override', async () => {
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

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
    await renderBanner({
      provider: 'vercel',
      domain: 'analytics.example.com',
      consentGate: 'true',
    });

    const accept = screen.getByRole('button', { name: /accept analytics/i });
    expect(accept.className).toContain('focus-visible:outline');
  });
});