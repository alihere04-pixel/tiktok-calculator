#!/usr/bin/env node
/**
 * Generate runtime config JSON from Vercel environment variables.
 * Runs at build time via `prebuild` script.
 * Ensures client bundle has correct values regardless of Next.js inlining.
 */

const fs = require('fs');
const path = require('path');

const config = {
  provider: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'none',
  domain: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? '',
  consentGate: process.env.NEXT_PUBLIC_CONSENT_GATE ?? 'false',
  errorDsn: process.env.NEXT_PUBLIC_ERROR_DSN ?? '',
};

const outputPath = path.resolve(__dirname, '../src/lib/monitoring/runtime-config.json');

fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

console.log('Generated runtime-config.json:', config);