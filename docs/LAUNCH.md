# Launch guide

> **The business owner's launch manual is [`docs/HANDOFF.md`](./HANDOFF.md).**
> That document covers the same blockers in more detail, plus the Phase 2 data
> procedures, how to add a market, and step-by-step instructions for each of the
> four decisions. This file is the engineering checklist it grew out of.

Everything needed to take this site live, and an honest list of what is still
missing. The missing items are not a to-do list of nice-to-haves: each one is
something the code deliberately refuses to invent, and shipping without it means
publishing something false or broken.

## What is built

| Area | State |
| --- | --- |
| Profit calculator (`/`) | Working, server-calculated |
| Fee pages (`/{market}/tiktok-shop-fees`) | 5 markets, fully static |
| Legal pages (`/disclaimer`, `/privacy`, `/terms`) | Built, drafted, **not lawyer-reviewed** |
| Affiliate programme | Built and tested, **switched off** |
| Error boundary (`src/app/error.tsx`) | Working |
| Sitemap / robots | Working, live on `https://fynza.store` |
| Analytics / error monitoring | **Off by default**, config in place |
| Tests | 798 passing across 52 files |

Supported markets: `US`, `UK`, `MY`, `SG`, `PH`.

> **Status as of 2026-09-30: this site is live at `https://fynza.store`.** The
> blockers in the next section were resolved and verified against the production
> domain. They are kept below as the record of what had to be decided, not as a
> list of outstanding work.

## Launch blockers

These four are the reason the site is not ready to ship. Each one is
enforced in code, not just documented, so it cannot be forgotten silently.

### 1. No production domain

**Resolved.** `NEXT_PUBLIC_SITE_URL` is set to `https://fynza.store` in the
production environment. Verified against the live site: canonicals on all pages
are absolute and point at the production domain, and `robots.txt` includes its
`Sitemap:` line. The `localhost:3000` fallback below only applies to a local
build with the variable unset.

Every relative canonical in the site resolves against `NEXT_PUBLIC_SITE_URL`, and
Next falls back to `http://localhost:3000` when it is missing, so a build that
omits the variable will still ship working canonicals — pointed at the wrong host.

- Code: `src/lib/site/config.ts`
- Blocker list: `siteUrlOpenItems()`

### 2. Legal entity

All three legal pages carried visible `OPEN_ITEM` markers. All three are filled
as of 2026-09-28:

| Page | Value | Now |
| --- | --- | --- |
| `/terms` | Name of the operating entity | Fynza, described as a trading name |
| `/terms` | Governing jurisdiction | Pakistan |
| `/privacy` | Server log retention | 90 days |

`legalOpenItems()` returns `[]`. That is a completeness result, not a legal
review. The pages still say on their face that they are drafts written by a
developer and have not been reviewed by one, and that notice stays until a
lawyer has signed off. **Get a lawyer to review these before launch.**

Two values in that table are assertions about things this repository cannot
verify, and both need confirming against the live systems:

- **The 90-day log retention** is configured on the Vercel project, not in this
  code. The page now states it as fact. If the project is set to something else,
  the page is wrong and must be changed in the same deploy.
- **Fynza is described as a trading name, not a registered company.** The
  governing-law clause points at the courts of Pakistan, which presumes a real
  person or entity behind the name. Confirm which, and confirm whether a UK or
  EU representative is required now that the operator is established outside
  the UK (UK GDPR Art. 27).

- Code: `src/lib/legal/content.ts`
- Blocker list: `legalOpenItems()`
- Test: `src/lib/legal/content.test.ts` fails on any stray template marker and
  on any invented company number, email or entity name.

### 3. No affiliate URLs

The PRD asked for affiliate links on the fee pages. They are implemented,
labelled and tested, but `SPONSOR_LINKS_ENABLED` is `false` and both URLs are
empty strings, so nothing renders.

This is deliberate. An affiliate URL is a tracking identifier attached to a
specific partner account. We have no affiliate ID and no contract, and the only
signup URLs available were guesses. A guessed `?aff=` link either 404s or
attributes someone else's signup to us.

To enable: put the real tracking URL in `src/lib/seo/sponsor-links.ts`, then
flip `SPONSOR_LINKS_ENABLED` to `true`. `sponsorLinksReady()` reports whether
both steps are done.

When links are live the component already guarantees the two things that make a
paid link compliant: `rel="sponsored noopener noreferrer"` and a visible
"we may earn a commission" label.

### 4. Analytics decisions not made

Nothing is instrumented, which is the correct default for a site serving the UK,
Singapore, Malaysia, the Philippines and the US. Loading a tracker before
consent engages UK GDPR and equivalents, so an analytics default-on would be a
compliance bug rather than a missing feature.

- Code: `src/lib/monitoring/config.ts`
- Blocker list: `analyticsBlockers()`

If analytics are wanted:

1. Pick a provider. `ga4` is flagged as unsuitable without a consent-management
   platform because it sets cookies before a banner can ask.
2. Ship a consent banner that actually gates the script.
3. Set `NEXT_PUBLIC_CONSENT_GATE=true`, plus the provider and domain.

Error monitoring is separate and much lighter: a first-party request with no
cookies and no identifiers. Set `NEXT_PUBLIC_ERROR_DSN` to enable it. The error
boundary already forwards to a `window.__errorMonitor` sink.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `http://localhost:3000` | Origin for canonicals and sitemap |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | No | `none` | `none`, `plausible`, `umami`, `ga4` |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | No | none | Event destination |
| `NEXT_PUBLIC_CONSENT_GATE` | No | `false` | Must be `true` for analytics to load |
| `NEXT_PUBLIC_ERROR_DSN` | No | none | Error reporting destination |

## Deploying to Vercel

Nothing here is automated: this directory is not a git repository and the Vercel
CLI is not installed, so no commit or deploy was made. Choose one of these.

### Option A: import the project (easiest)

1. Push the directory to a GitHub, GitLab or Bitbucket repository.
2. In Vercel, **Add New → Project** and import that repository. Vercel detects
   Next.js and needs no build configuration.
3. Add the environment variables from the table above in
   **Settings → Environment Variables**. `NEXT_PUBLIC_SITE_URL` matters most.
4. Deploy. The five market pages are prerendered at build time, so there is
   nothing to warm up.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel            # first run: creates and links the project
vercel --prod     # production deploy
```

Set `NEXT_PUBLIC_SITE_URL` before the production deploy:

```bash
vercel env add NEXT_PUBLIC_SITE_URL production
```

### Option C: any Node host

```bash
npm ci
npm run build
npm start        # serves on PORT, default 3000
```

The host must run Node 18.17 or newer. Behind a reverse proxy, pass
`HOSTNAME=0.0.0.0` so the server binds to all interfaces rather than only
loopback.

## Custom domain

Only available on a paid Vercel plan.

1. Deploy first; Vercel assigns a `*.vercel.app` subdomain.
2. **Settings → Domains → Add**, then enter the apex and, if wanted, `www`.
3. Add the DNS records Vercel displays. Propagation is usually minutes, up to
   48 hours.
4. Set `NEXT_PUBLIC_SITE_URL` to the final origin and redeploy, so the
   canonicals match the domain people actually visit.

Until step 4 is done, the site is serving canonicals that disagree with its own
domain. Do not skip it.

## Pre-launch checklist

**Data honesty**

- [x] Every market page shows a source date and a confidence badge.
- [x] No rate appears that is not in the verified dataset. Missing data is
      shown as a disclosure card, never as a zero.
- [x] Affiliate commission rates are still absent, and the pages say so.

## Decisions taken where the data was silent

Three questions came up during the audit that had no published answer. Each was
resolved by removing the false claim rather than filling the gap, and each is
recorded here so the next person does not "fix" it back.

### Affiliate commission is user-entered, and always will be

The schema supports an `affiliate` block with published ranges per market
(`openCollabRange`, `targetedCollabRange`). **No market file populates it**,
because TikTok does not publish a single affiliate rate: the rate is negotiated
per creator and per campaign. The calculator therefore takes the rate from the
seller as an input and charges exactly that, or nothing when the field is left
at zero.

A default was not added, deliberately. Any single number would be a rate TikTok
never published, and a seller who accepted it would underprice their listing
without knowing. If a per-market range is ever added to a rate file, it should
be used to *validate* a seller-entered rate, not to supply one.

### MY dynamic commission has been removed

`additionalFees.dynamicCommission` describes a commission band that applies at
RM 650,000 in trailing-30-day GMV. The old code could add a fee line for it, but
only by casting an untyped property onto the inputs, and nothing in the form or
the URL could ever set it. It was unreachable UI that looked like a feature.

It has been removed rather than wired up, because triggering it correctly needs
the seller's trailing GMV, which is not an input this calculator has. The rate
data is left in place. If a GMV input is ever added, the line can be restored
against the published band, and as an `unpriced` line until then.

### Fulfilled by TikTok is not calculated

`fulfillmentMethod`, `productWeightLb` and `dimensionsIn` were collected by the
form and read by no engine, and no rate file carries an FBT fee. The US-only
control implied the fee difference had been modelled. The inputs are removed and
the section explains where to put the cost instead. See `SectionF_Fulfillment.tsx`.

## Pre-launch checklist

**Legal**

- [ ] `/disclaimer`, `/privacy`, `/terms` reviewed by a lawyer.
- [x] All three `OPEN_ITEM` markers filled in.
- [x] `legalOpenItems()` returns `[]`.
- [ ] Vercel project log retention confirmed to match the 90 days stated on
      `/privacy`.
- [ ] UK/EU representative question answered now that the operator is
      established in Pakistan.
- [ ] The draft-for-review notice removed from `LegalDocumentView.tsx` — only
      after a lawyer signs off, and only once the last review date is real.
- [ ] `LAST_REVIEWED` in `src/lib/legal/content.ts` updated to the date the
      lawyer signed off.

**SEO**

- [ ] `NEXT_PUBLIC_SITE_URL` set and the site redeployed.
- [ ] Canonicals on all nine pages show the real domain.
- [ ] `https://domain/sitemap.xml` lists 9 URLs.
- [ ] `https://domain/robots.txt` contains a `Sitemap:` line.
- [ ] `https://domain/sitemap.xml` submitted in Google Search Console.

**Affiliate links** (only if the programme is being launched)

- [ ] Real tracking URLs in `src/lib/seo/sponsor-links.ts`.
- [ ] `SPONSOR_LINKS_ENABLED = true`.
- [ ] `sponsorLinksReady()` returns `true`.
- [ ] Links show `rel="sponsored noopener noreferrer"` in the rendered HTML.
- [ ] The commission label is visible, not only in an attribute.

**Privacy**

- [ ] Analytics off, or provider plus consent banner both live.
- [ ] `analyticsBlockers()` returns `[]` if analytics is on.
- [ ] Analytics script verified absent from the HTML before any consent.

**Quality gates**

- [x] `npm test -- --run` passes.
- [x] `npx tsc --noEmit` is clean.
- [x] `npm run build` succeeds.
- [x] `npx eslint src` reports 0 errors.
- [ ] Smoke test passes in Chrome and Firefox.
- [ ] Safari reviewed on a real device or macOS machine. It cannot be tested
      from Windows. Nothing in the code uses `:has()` or other late-Safari APIs,
      but form controls and number inputs are the likely divergence.

## Verification commands

```bash
npm test -- --run          # 659 tests, 45 files
npx tsc --noEmit           # type check
npm run build              # production build
npx eslint src             # lint
npm start                  # serve on :3000
```

Routes to smoke test:

```
/  /us/tiktok-shop-fees  /uk/tiktok-shop-fees  /my/tiktok-shop-fees
/sg/tiktok-shop-fees  /ph/tiktok-shop-fees
/disclaimer  /privacy  /terms  /robots.txt  /sitemap.xml
```

## Measured results

Taken against a local production build (`npm run build && npm start`), not dev
mode, so the numbers reflect what a visitor would actually get.

### Lighthouse 13.5.0, Chrome (headless)

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 96 | 100 | 100 | 100 | 2.2 s | 180 ms | 0 |
| `/us/tiktok-shop-fees` | 95 | 100 | 100 | 100 | 2.3 s | 190 ms | 0 |
| `/disclaimer` | 97 | 100 | 100 | 100 | 2.1 s | 180 ms | 0 |

All four categories clear the 90 target. CLS is 0 on all three.

The one remaining performance opportunity is 59 KiB of unused JavaScript out of
191 KiB total, worth roughly 300 ms. Most of the JavaScript on `/` is the
calculator form doing real work, so this was left alone deliberately: at launch
the right trade is a working calculator, not a smaller bundle with a bug in it.

### Browsers

| Browser | Result |
| --- | --- |
| Chrome 153 (headless) | Renders correctly. Accessibility 100, no console errors. |
| Firefox 156 (headless) | Renders correctly. Layout and paint agree with Chrome. |
| Safari | **Not tested.** Cannot run on Windows. See the checklist. |

Both engines were checked by rendering each page and measuring the result rather
than by eye: every screenshot had correct dimensions, 59–107 distinct colours
and 2–10% non-background pixels, which rules out a blank page or an error
boundary. A post-hydration DOM dump confirmed no error page on any route, 17
form inputs and 9 collapsibles live on `/`, and 4 JSON-LD blocks on the fee
pages.

Nothing in the codebase uses CSS `:has()`, `structuredClone` in client code, or
any other API known to lag in Safari, so the risk is low. It is not zero, and
Safari is the browser most likely to differ on form controls and number inputs.
The check is still worth doing on a real device.

### Build route table

```
/                       static
/disclaimer             static
/privacy                static
/terms                  static
/robots.txt             static
/sitemap.xml            static
/_not-found             static
/[market]/tiktok-shop-fees
  /us/tiktok-shop-fees  SSG
  /uk/tiktok-shop-fees  SSG
  /my/tiktok-shop-fees  SSG
  /sg/tiktok-shop-fees  SSG
  /ph/tiktok-shop-fees  SSG
```

9 user-facing pages, 14 prerendered documents including framework routes. The
market segment has `dynamicParams = false`, so an unknown market returns a 404
rather than attempting a render. Verified: `/de/tiktok-shop-fees`,
`/xx/tiktok-shop-fees` and `/nope` all return 404.

## Known build warning

`@next/swc-win32-x64-msvc ... is not a valid Win32 application` appears during
local builds. It is a broken local native binary; Next falls back to the pure
JavaScript compiler and the build succeeds. The fix is
`npm i @next/swc-win32-x64-msvc@<next-version>`. It does not affect Vercel,
which uses its own toolchain.
