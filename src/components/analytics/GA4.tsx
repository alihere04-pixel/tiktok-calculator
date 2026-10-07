'use client';

// gtag.js only treats a real `arguments` object inside `window.dataLayer` as a
// command: a rest-parameter array is dropped silently and the hit is lost. The
// queue below therefore pushes `arguments` on purpose, so `prefer-rest-params`
// is switched off for this file. A per-line directive would be reported as
// unused in the configs that do not enable that rule at all.
/* eslint prefer-rest-params: "off" */

import { useEffect } from 'react';

import { useAnalyticsConsent } from './useAnalyticsConsent';

function gaMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA4_ID ?? '';
}

/**
 * Google Analytics 4, gated behind the same per-visitor consent as every
 * other tracker in this directory. Two independent checks decide whether
 * anything loads:
 *
 *   1. `NEXT_PUBLIC_GA4_ID` must be set at build time. Without it this
 *      component stays inert and no request is ever made, so an
 *      unconfigured deployment ships no Google Analytics at all.
 *   2. The visitor must have accepted analytics in the banner. `AnalyticsGate`
 *      already refuses to render any tracker before acceptance, but the
 *      check is repeated here so the component is safe wherever it is
 *      placed — the same defence-in-depth `AdSense` uses.
 *
 * The tag is injected imperatively from `useEffect`, following
 * `VercelAnalytics` exactly, because consent is unknown during SSR: the
 * server must not emit a Google tag for a visitor who has not decided, so
 * this code can only ever run on the client after a stored "accepted".
 *
 * The queue (`window.dataLayer` plus the `gtag()` shim) is installed before
 * the async gtag.js tag so hits queued while it downloads are not lost, and
 * the `window.gtag` guard keeps React StrictMode's double effect from
 * configuring the property twice.
 */
export function GA4() {
  const { consent } = useAnalyticsConsent();
  const enabled = gaMeasurementId() !== '' && consent.status === 'accepted';

  useEffect(() => {
    if (!enabled) return;

    const id = gaMeasurementId();
    const w = window as Window & {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };

    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) {
      w.gtag = function gtag() {
        w.dataLayer?.push(arguments);
      };
      w.gtag('js', new Date());
      w.gtag('config', id);
    }

    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector(
        'script[src*="googletagmanager.com/gtag/js"]'
      );
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [enabled]);

  return null;
}
