import { describe, it, expect, afterEach, vi } from 'vitest';
import { absoluteUrl, siteUrl, siteUrlOpenItems, SITE_URL_OPEN_ITEM } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('siteUrl', () => {
  it('falls back to localhost in development when nothing is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(siteUrl()).toBe('http://localhost:3000');
  });

  it('falls back to production domain in production when nothing is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(siteUrl()).toBe('https://fynza.store');
  });

  it('uses the configured origin regardless of environment', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    vi.stubEnv('NODE_ENV', 'development');
    expect(siteUrl()).toBe('https://fees.example.com');
  });

  it('strips a trailing slash, so canonicals never double up', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com/');
    expect(siteUrl()).toBe('https://fees.example.com');
    expect(absoluteUrl('/disclaimer')).toBe('https://fees.example.com/tiktok/disclaimer');
  });

  it('handles several trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com///');
    expect(siteUrl()).toBe('https://fees.example.com');
  });

  it('trims surrounding whitespace from a copy-pasted value', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '  https://fees.example.com  ');
    expect(siteUrl()).toBe('https://fees.example.com');
  });
});

describe('absoluteUrl', () => {
  it('adds the leading slash when it is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    expect(absoluteUrl('privacy')).toBe('https://fees.example.com/tiktok/privacy');
  });

  it('does not double the slash when it is already there', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    expect(absoluteUrl('/privacy')).toBe('https://fees.example.com/tiktok/privacy');
  });
});

describe('open item reporting', () => {
  it('flags the missing domain as a launch blocker in development', () => {
    // Without this, canonical tags and the sitemap point at localhost and the
    // mistake is invisible in review.
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(SITE_URL_OPEN_ITEM()).toBe(true);
    expect(siteUrlOpenItems()).toHaveLength(1);
    expect(siteUrlOpenItems()[0]).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it('flags the missing domain as a launch blocker in production', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(SITE_URL_OPEN_ITEM()).toBe(true);
    expect(siteUrlOpenItems()).toHaveLength(1);
    expect(siteUrlOpenItems()[0]).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it('clears the blocker once a real domain is set in development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    vi.stubEnv('NODE_ENV', 'development');
    expect(SITE_URL_OPEN_ITEM()).toBe(false);
    expect(siteUrlOpenItems()).toEqual([]);
  });

  it('clears the blocker once a real domain is set in production', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    vi.stubEnv('NODE_ENV', 'production');
    expect(SITE_URL_OPEN_ITEM()).toBe(false);
    expect(siteUrlOpenItems()).toEqual([]);
  });
});
