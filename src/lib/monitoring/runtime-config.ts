import config from './runtime-config.json' with { type: 'json' };

export const RUNTIME_ANALYTICS_PROVIDER = config.provider;
export const RUNTIME_ANALYTICS_DOMAIN = config.domain;
export const RUNTIME_CONSENT_GATE = config.consentGate;
export const RUNTIME_ERROR_DSN = config.errorDsn;