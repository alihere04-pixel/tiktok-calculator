import type { MetadataRoute } from 'next';
import { absoluteUrl, SITE_URL_OPEN_ITEM } from '@/lib/site/config';

/**
 * robots.txt.
 *
 * The only disallowed path is the Next.js request for build assets, which
 * serves nothing useful to a crawler and only wastes crawl budget.
 *
 * The sitemap is advertised on its own line, separated by a blank line, so both
 * the Sitemap directive and the User-agent block are valid under RFC 9309. When
 * the real domain is still unconfigured the sitemap line is omitted rather than
 * pointing a crawler at localhost.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/tiktok/_next/static/',
      },
    ],
    ...(SITE_URL_OPEN_ITEM() ? {} : { sitemap: absoluteUrl('/sitemap.xml') }),
  };
}
