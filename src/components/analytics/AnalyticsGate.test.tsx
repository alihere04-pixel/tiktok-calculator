import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ANALYTICS_CONSENT_KEY } from '@/lib/consent/consent';

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

async function renderGate(env: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      vi.stubEnv(key, value);
    }
  }
  vi.resetModules();
  const mod = await import('./AnalyticsGate');
  return render(<mod.AnalyticsGate />);
}

describe('AnalyticsGate', () => {
  it('injects no tracker script when nothing is configured', async () => {
    // The default that ships. This is the assertion the privacy page's "no
    // analytics" claim depends on, and it is now a fact about the document
    // rather than a sentence in a content file.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: '',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when a provider is set but consent gating is off', async () => {
    // The trap the gate exists to prevent: choosing a provider and a domain and
    // assuming analytics is live. Without a real consent banner it must not load.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'false',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when the provider is set but the domain is missing', async () => {
    // Events would have nowhere to go, so there is no reason to load the tracker.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when provider, domain and consent gate are all set but nobody has consented', async () => {
    // The whole point of the runtime gate. All three deploy-time variables can be
    // configured and this must still be empty, because configuring analytics is
    // not the same as asking the visitor. Before per-user consent existed, this
    // state loaded the tracker for every first-time visitor.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(trackerScripts()).toHaveLength(0);
  });

  it('injects no tracker script when the visitor has declined', async () => {
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'declined');
    await renderGate({});
    expect(trackerScripts()).toHaveLength(0);
  });

  it('does not persist an attribution identifier after a stored decline', async () => {
    // Independent of the script selector: proves the withheld tracker really did
    // not run, rather than the assertion matching the wrong URL.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'declined');
    await renderGate({});
    expect(localStorage.getItem('__va_attribution')).toBeNull();
  });

  it('injects the tracker exactly once when provider, domain, consent gate and an acceptance are all present', async () => {
    // The positive case, and the reason the ones above are meaningful. Against a
    // gate that simply never rendered anything they would all pass too, so this
    // is what proves the gate is a decision rather than a permanent off switch.
    //
    // The stored acceptance is what makes this reachable now: unlike the original
    // version of this test, configuration alone is no longer sufficient.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted');
    await renderGate({});
    expect(trackerScripts()).toHaveLength(1);
  });

  it('fails closed for a provider that has no tracker wired up', async () => {
    // `plausible` and `umami` are representable in the config but have no
    // component. A configured-but-unbuilt provider must render nothing rather
    // than falling through to some other tracker.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'plausible',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(trackerScripts()).toHaveLength(0);
  });

  it('does not persist an attribution identifier while the gate is closed', async () => {
    // What the withheld script actually does: it writes `__va_attribution` to
    // localStorage. Asserting the storage key is a second, independent check
    // that does not depend on the selector above matching the right URL.
    await renderGate({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(localStorage.getItem('__va_attribution')).toBeNull();
  });
});