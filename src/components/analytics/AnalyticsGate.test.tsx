import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AnalyticsGate } from './AnalyticsGate';

/**
 * Where the tracker script actually ends up, and why the selector is two parts.
 *
 * `Analytics` from `@vercel/analytics/next` renders `null`. It injects its
 * script imperatively into `document.head` from a `useEffect`, so the assertion
 * has to look at the document rather than the render container, or it is
 * checking an element that was never there.
 *
 * The URL also depends on mode. Production resolves to
 * `/_vercel/insights/script.js`, but `getScriptSrc()` returns its debug build
 * at `va.vercel-scripts.com` whenever `NODE_ENV` is `development` or `test`,
 * which is always true under Vitest. A selector pinned to the production URL
 * would therefore be permanently null in this file and could never fail, which
 * is the same string-versus-fact trap this gate was written to close.
 */
const TRACKER_SCRIPT = 'script[src*="_vercel/insights"], script[src*="vercel-scripts"]';

function trackerScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>(TRACKER_SCRIPT));
}

type MutableWindow = Window & Record<string, unknown>;

/**
 * The SDK is not idempotent across tests in the way a React tree is: `inject()`
 * early-returns when a matching script is already in `document.head`, and
 * `cleanup()` does not remove nodes the SDK appended itself. Without this the
 * first injecting test leaves state behind and the rest pass or fail depending
 * on ordering.
 */
function resetSdk() {
  for (const script of trackerScripts()) script.remove();
  // The SDK writes its queue and mode onto the global object, which the DOM
  // types do not describe. Cast through unknown rather than adding an index
  // signature to `Window`.
  const globals = window as unknown as MutableWindow;
  for (const key of ['va', 'vaq', 'vai', 'vam']) {
    delete globals[key];
  }
  localStorage.clear();
}

beforeEach(resetSdk);
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  resetSdk();
});

function clearEnv() {
  for (const key of [
    'NEXT_PUBLIC_ANALYTICS_PROVIDER',
    'NEXT_PUBLIC_ANALYTICS_DOMAIN',
    'NEXT_PUBLIC_CONSENT_GATE',
    'NEXT_PUBLIC_ERROR_DSN',
  ]) {
    vi.stubEnv(key, '');
  }
}

function configure(provider: string, domain = 'analytics.example.com', consent = 'true') {
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', provider);
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', domain);
  vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', consent);
}

describe('AnalyticsGate', () => {
  it('injects no tracker script when nothing is configured', () => {
    // The default that ships. This is the assertion the privacy page's "no
    // analytics" claim depends on, and it is now a fact about the document
    // rather than a sentence in a content file.
    clearEnv();
    render(<AnalyticsGate />);
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when a provider is set but consent gating is off', () => {
    // The trap the gate exists to prevent: choosing a provider and a domain and
    // assuming analytics is live. Without a real consent banner it must not load.
    clearEnv();
    configure('vercel', 'analytics.example.com', 'false');
    render(<AnalyticsGate />);
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when the provider is set but the domain is missing', () => {
    // Events would have nowhere to go, so there is no reason to load the tracker.
    clearEnv();
    configure('vercel', '', 'true');
    render(<AnalyticsGate />);
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects the tracker exactly once when provider, domain and consent gate are all set', () => {
    // The positive case, and the reason the three above are meaningful. Against a
    // gate that simply never rendered anything they would all pass too, so this
    // is what proves the gate is a decision rather than a permanent off switch.
    clearEnv();
    configure('vercel');
    render(<AnalyticsGate />);
    expect(trackerScripts()).toHaveLength(1);
  });

  it('fails closed for a provider that has no tracker wired up', () => {
    // `plausible` and `umami` are representable in the config but have no
    // component. A configured-but-unbuilt provider must render nothing rather
    // than falling through to some other tracker.
    clearEnv();
    configure('plausible');
    render(<AnalyticsGate />);
    expect(trackerScripts()).toHaveLength(0);
  });

  it('does not persist an attribution identifier while the gate is closed', () => {
    // What the withheld script actually does: it writes `__va_attribution` to
    // localStorage. Asserting the storage key is a second, independent check
    // that does not depend on the selector above matching the right URL.
    clearEnv();
    render(<AnalyticsGate />);
    expect(localStorage.getItem('__va_attribution')).toBeNull();
  });

  it('renders the Vercel tracker when provider, domain and consent‑gate are set and the user has accepted analytics', () => {
    // 1️⃣ set the env vars that the config needs
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'vercel');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'analytics.example.com');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');

    // 2️⃣ also store user consent so the layout’s useAnalyticsConsent returns true
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_consent', 'accepted');
    }

    render(<AnalyticsGate />);
    // the gate’s internal Tracker will mount the Vercel script
    expect(trackerScripts()).toHaveLength(1);
  });
});