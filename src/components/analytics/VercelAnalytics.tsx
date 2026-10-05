'use client';

import { useEffect } from 'react';

export function VercelAnalytics() {
  useEffect(() => {
    if (document.querySelector('script[src*="va.vercel-scripts.com"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://va.vercel-scripts.com/v1/script.js';
    script.defer = true;
    script.dataset.websiteId = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ID || '';
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src*="va.vercel-scripts.com"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return null;
}