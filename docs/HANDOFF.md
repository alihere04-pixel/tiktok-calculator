# Launch handoff

Your launch manual. Everything here was verified against this repository at the
end of Step 11. Nothing in this document is a plan or a guess; where something
could not be verified, it says so.

**The code is launch-ready. Four decisions are yours, not the code's.** Each is
listed in section B with exactly what you need to do and what to check
afterwards. None of them needs a developer.

---

## Contents

- [A. What is built and working](#a-what-is-built-and-working)
- [B. The four launch blockers](#b-the-four-launch-blockers)
- [C. Deploying the site](#c-deploying-the-site)
- [D. Setting `NEXT_PUBLIC_SITE_URL`](#d-setting-next_public_site_url)
- [E. Adding affiliate URLs](#e-adding-affiliate-urls)
- [F. Enabling monitoring](#f-enabling-monitoring)
- [G. Fixing the UK and US data gaps](#g-fixing-the-uk-and-us-data-gaps)
- [H. Adding a new market](#h-adding-a-new-market)
- [I. Running tests, build and lint locally](#i-running-tests-build-and-lint-locally)

---

## A. What is built and working

### Routes

| Route | Type | Status |
| --- | --- | --- |
| `/` | Static | Profit calculator, server-calculated |
| `/us/tiktok-shop-fees` | SSG | US seller fees |
| `/uk/tiktok-shop-fees` | SSG | UK seller fees |
| `/my/tiktok-shop-fees` | SSG | Malaysia seller fees |
| `/sg/tiktok-shop-fees` | SSG | Singapore seller fees |
| `/ph/tiktok-shop-fees` | SSG | Philippines seller fees |
| `/disclaimer` | Static | Draft, needs a lawyer |
| `/privacy` | Static | Draft, needs a lawyer |
| `/terms` | Static | Draft, needs a lawyer |
| `/robots.txt` | Static | Working |
| `/sitemap.xml` | Static | Working, 9 URLs |

9 user-facing pages, 14 prerendered documents including framework routes. The
market segment uses `dynamicParams = false`, so an unknown market returns a 404
instead of attempting a render. Verified: `/de/tiktok-shop-fees`,
`/xx/tiktok-shop-fees` and `/nope` all return 404.

### Features

**Calculator.** Server-side calculation through a single code path. There is no
duplicate maths in the browser, so the fee pages and the main calculator can
never disagree with each other.

**Fee pages.** Five markets, fully static, no server cost per view. Each page
carries: the category commission table, fixed and transaction fees, a fee
breakdown, data disclosures with confidence badges and source dates, a small
estimator, and an FAQ. Every number on a page comes from the rate files, or the
page says it does not have it. There is no place where a missing value becomes
a zero.

**Data honesty.** Missing data renders as a "Not in our verified dataset" card
with a reason and a link to the official source, never as a plausible number.
Rate schema bounds such as "0 to 1" validate input; they are never presented as
a published rate range.

**Affiliate programme.** Built, labelled and tested. Switched off, because no
real tracking URL exists. See section E.

**Error handling.** A route-level error boundary shows a recovery screen and an
error digest instead of a blank page. It never renders the error message, so
stack traces and internal paths cannot leak.

**Monitoring.** Config in place, everything off by default. See section F.

**SEO.** Per-market metadata, canonicals, Open Graph, Twitter cards, `WebPage`
and `FAQPage` structured data, a generated sitemap, and `robots.txt`.

### Quality

| Check | Result |
| --- | --- |
| Tests | **659 passing, 45 files** |
| `npx tsc --noEmit` | Clean |
| `npx eslint src` | 0 errors, 1 pre-existing warning |
| `npm run build` | Succeeds, 14 static documents |
| Lighthouse 13.5, home page | 96 performance, 100 accessibility, 100 best practices, 100 SEO |
| Lighthouse 13.5, fee page | 95 / 100 / 100 / 100 |
| Lighthouse 13.5, legal page | 97 / 100 / 100 / 100 |
| Chrome 153 | Renders correctly, no console errors |
| Firefox 156 | Renders correctly, layout agrees with Chrome |
| Safari | **Not tested.** Cannot run on Windows. |
| Cumulative layout shift | 0 on all three pages tested |

The one remaining performance opportunity is 59 KiB of unused JavaScript out of
191 KiB, worth about 300 ms. Most of the JavaScript on the home page is the
calculator doing real work, so this was left alone deliberately. At launch the
right trade is a correct calculator, not a smaller bundle with a bug in it.

**Known harmless warning.** Every local build prints `not a valid Win32
application` for `@next/swc-win32-x64-msvc`. That is a broken native binary on
this machine; Next falls back to the pure JavaScript compiler and the build
succeeds. It does not affect Vercel, which uses its own toolchain. To silence it
locally: `npm i @next/swc-win32-x64-msvc@<next-version>`.

---

## B. The four launch blockers

These are business decisions. The code is built to accept each one and is
currently shipping the safe default in all four cases.

### 1. `NEXT_PUBLIC_SITE_URL` — decided: `https://fynza.store`

**Current state.** Set. The site is live at `https://fynza.store` and the
variable resolves every relative canonical to that domain.

**Verified on production:** canonical tags on all pages name `https://fynza.store`,
and `robots.txt` carries its `Sitemap:` line.

**Why it matters.** Canonical tags tell search engines which URL is the real one.
Wrong canonicals can cost rankings for months before anyone noticed.

**How to confirm it worked.**
`curl https://fynza.store/privacy | grep canonical` shows the production domain,
and `curl https://fynza.store/robots.txt` contains a `Sitemap:` line.

### 2. Legal review — yours and your lawyer's

**Current state.** Three pages are written as drafts. Each says on its face that
it was written by a developer and has not been reviewed by a lawyer, and says
how many of *its own* values are still placeholders. As of 2026-09-28 all three
values the repository previously lacked are supplied, so `legalOpenItems()`
returns `[]` and every page reports zero placeholders:

| Page | Value | Now |
| --- | --- | --- |
| `/terms` | Name of the operating entity | Fynza, described as a trading name |
| `/terms` | Governing jurisdiction | Pakistan |
| `/privacy` | Server log retention | 90 days |

Fynza is named as a **trading name**, not a registered company. The terms page
was written to avoid claiming otherwise: it says the site is "operated from
Pakistan" rather than asserting an operating entity "established" in a
jurisdiction. Whether a real person or company sits behind the name, and
whether a UK or EU representative is now required (UK GDPR Art. 27), is a
question for the lawyer.

The privacy contact address is filled in as of 2026-09-28. It is a personal
mailbox, `alihere04@gmail.com`, not a role address on a domain. That works, but
it is a single point of failure: if access is lost, the page advertises a dead
contact, and a privacy notice nobody can reach is unenforceable in practice.
Move it to an address on a domain you control before relying on it commercially.
The intended replacement is `contact@fynza.store`, deliberately not yet
published. When you switch it, two things must change in the same commit or the
suite goes red: the `PRIVACY_CONTACT_EMAIL` constant and the exact-set email
assertion in `content.test.ts`, which currently matches
`{alihere04@gmail.com}` and fails on any second address.

The privacy page was restructured on 2026-09-28 into the standard ICO sequence —
contact details, what is collected, lawful bases, the seven data subject rights,
how to make a request, where data comes from, retention, how to complain. Two
corrections came out of that rewrite, and both matter more than the restructure:

- The page used to say "we collect nothing about you" while a later section
  admitted the host records your IP address. It now names the log data
  explicitly and gives it a lawful basis (legitimate interests) rather than
  denying it exists.
- The old page had no rights section and no complaints route at all, so a reader
  who wanted to act had nothing to act on. The ICO's published address is given
  so a complaint is actually actionable.

**A third false claim was live, and it is the one to understand.** The root
layout mounted Vercel Web Analytics unconditionally, so the site's own privacy
page — which said "No analytics or tracking scripts run by default" — was wrong
while the whole suite stayed green. The test that appeared to cover this only
asserted the sentence was present in the content file; it never checked whether
a tracker was mounted. A string check cannot catch the thing it was standing in
for. The tracker is now behind `AnalyticsGate`, which reads the consent gate in
`lib/monitoring/config.ts` and withholds the script unless a provider, a
destination domain and `NEXT_PUBLIC_CONSENT_GATE=true` are all present. None of
those are set, so analytics is off.

Do not set `NEXT_PUBLIC_CONSENT_GATE=true` until a real consent banner exists.
That flag asserts a banner is implemented; it does not implement one. Until
then it stays unset, which is what keeps the "no analytics" claim true.

**What to do.**

1. Send the three pages to your lawyer.
2. When they return corrections, apply them in `src/lib/legal/content.ts`.
3. Confirm the Vercel project's log retention really is 90 days. The page states
   it as fact and the code cannot check it; if the project says 30, fix the
   page rather than the project.
4. Update `LAST_REVIEWED` to the date the lawyer signed off.
5. Only then delete the draft notice block in
   `src/components/legal/LegalDocumentView.tsx` (the paragraph starting
   "Draft for review"). It counts placeholders per page, so it reads "One value
   on this page is still a placeholder" until the last one is gone, then "No
   values on this page are placeholders". Deleting it before a lawyer has seen
   the page is how a draft gets mistaken for a final document.
6. Run the tests.

**Two guards worth knowing about, because both used to be false reassurance.**

- `legalOpenItems()` takes an optional `docs` argument precisely so the detector
  can be tested against a document that *does* carry a marker. It used to have
  no argument, and the only test compared the marker count against the open-item
  count — self-consistency, which passes whether or not a placeholder exists.
  `HANDOFF.md` previously claimed the suite "fails if any `OPEN_ITEM` survives".
  That was false and is now true.
- `AnalyticsGate.test.tsx` asserts on `document.head`, because
  `@vercel/analytics/next` renders `null` and injects its script imperatively.
  It also matches the SDK's debug URL as well as `/_vercel/insights/script.js`,
  because Vitest sets `NODE_ENV=test` and the SDK serves a different script in
  that mode. A selector pinned to the production URL would have been null in
  every test and could never have failed.

**How to confirm it worked.** `legalOpenItems()` returns an empty list,
`document.head` contains no analytics script, and the word "Draft" still
appears on all three pages until a lawyer signs off.

**Two cautions.** The privacy page states the site sets no cookies and runs no
analytics. The first is true today. The second is true only because the gate is
closed — if you enable analytics later, update the page in the same change. And
if you add a CDN, a rate limiter or anything else that logs more than a request,
`/privacy` needs updating in the same commit.

**A second caution, and it cuts the other way.** The privacy page now describes
server log data, because the host really does record an IP address on every
request. If you add logging, a CDN, a security service or a rate limiter that
captures more than a request log, this page becomes wrong in the same way the
old one was. The honesty of this document depends on it being updated whenever
the deployment changes, not only when the data files do.

### 3. Affiliate URLs — yours, when you have a contract

**Current state.** The feature is complete and tested, but
`SPONSOR_LINKS_ENABLED` is `false` and both URLs are empty strings, so the
affiliate section renders nothing.

**Why it is off.** An affiliate URL is a tracking identifier tied to a specific
partner account. There is no affiliate ID and no contract in this repository, and
the only signup URLs available were guesses. A guessed `?aff=` link either 404s
or attributes someone else's signup to this site.

**What to do.** Section E has the exact steps.

**How to confirm it worked.** The fee pages show a "Next steps" block with a
visible "Affiliate link" label, and the rendered HTML contains
`rel="sponsored noopener noreferrer"`.

### 4. Analytics and monitoring — your decision

**Current state.** Off. No analytics, no trackers, no cookies.

**Why.** The site serves the UK, Singapore, Malaysia, the Philippines and the
United States. Loading an analytics or advertising tracker before consent engages
UK GDPR and the equivalent regimes. A tracker that ships on by default is a
compliance bug, not a missing feature.

**What to do.** Section F has the exact steps, including which provider to
avoid without a consent-management platform.

---

## C. Deploying the site

This directory is **not** a git repository and the Vercel CLI is **not**
installed, so nothing was committed and nothing was deployed. Choose one option.

### Option A: import the project (recommended)

1. Create a repository on GitHub, GitLab or Bitbucket and push this directory.
2. In Vercel, **Add New → Project**, then import that repository. Vercel detects
   Next.js and needs no build configuration.
3. **Settings → Environment Variables** — add the variables from section D and
   F. `NEXT_PUBLIC_SITE_URL` matters most.
4. Click **Deploy**.

The five market pages are prerendered at build time, so there is nothing to warm
up and the site will not be slow on first traffic.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel                 # first run: creates and links the project
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod          # production deploy
```

### Option C: any Node host

```bash
npm ci
npm run build
npm start               # serves on PORT, default 3000
```

Requires Node 18.17 or newer. Behind a reverse proxy, set `HOSTNAME=0.0.0.0` so
the server binds to all interfaces instead of only loopback.

### Custom domain

Available on a paid Vercel plan.

1. Deploy first. Vercel assigns a `*.vercel.app` subdomain.
2. **Settings → Domains → Add**, then enter the apex domain and, if you want
   it, `www`.
3. Add the DNS records Vercel shows. Propagation is usually minutes, sometimes up
   to 48 hours.
4. Set `NEXT_PUBLIC_SITE_URL` to the final origin and **redeploy**.

Step 4 is not optional. Until you do it, the site serves canonical tags that
disagree with the domain people actually visit.

### After deploying

1. Submit `https://yourdomain/sitemap.xml` in Google Search Console.
2. Check all 11 routes load: see section I.
3. Confirm the canonical tags show your domain, not localhost.

---

## D. Setting `NEXT_PUBLIC_SITE_URL`

This is the value that makes the site correct to search engines. Do it before or
immediately after the first deploy.

### Step 1: decide the exact origin

Include the scheme. **No trailing slash.**

```
https://yourdomain.com
https://www.yourdomain.com
```

Use whichever is the address you intend visitors to type. If you support both
`yourdomain.com` and `www.yourdomain.com`, pick one and redirect the other at
the DNS or host level, otherwise the two compete in search results.

### Step 2a: on Vercel

1. **Project → Settings → Environment Variables**
2. **Key**: `NEXT_PUBLIC_SITE_URL`
3. **Value**: `https://yourdomain.com` (no trailing slash)
4. **Environments**: tick **Production**. Tick **Preview** too if you want
   preview deployments to carry correct canonicals.
5. Save.
6. **Redeploy.** Environment variables are read at build time, so an existing
   deployment does not pick up a new value. Go to **Deployments**, open the top
   one, then **Redeploy**.

### Step 2b: on any other host

Set it in the host's environment configuration, then rebuild. For a local
check:

Create `.env.local` in the project root (already git-ignored, so it will never
be committed by accident):

```bash
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Copy `.env.example` as the starting point. It documents all five variables.

### Step 3: verify before you trust it

```bash
npm run build
npm start
```

Then, in another terminal:

```bash
curl http://localhost:3000/privacy | grep -o 'rel="canonical" href="[^"]*"'
curl http://localhost:3000/us/tiktok-shop-fees | grep -o 'rel="canonical" href="[^"]*"'
curl http://localhost:3000/sitemap.xml | head -8
cat .next/server/app/robots.txt.body
```

**Correct output:**

```
rel="canonical" href="https://yourdomain.com/privacy"
rel="canonical" href="https://yourdomain.com/us/tiktok-shop-fees"
```

```
<loc>https://yourdomain.com/</loc>
```

```
User-Agent: *
Allow: /
Disallow: /_next/static/

Sitemap: https://yourdomain.com/sitemap.xml
```

**Wrong output, still showing localhost** means the variable was not picked up.
Check for a trailing slash, a typo in the key name, or that you forgot to
rebuild. The build caches the value, so a rebuild is required every time.

This was verified working during Step 11: building with
`NEXT_PUBLIC_SITE_URL=https://fees.example.com` produced absolute canonicals on
all pages and added the `Sitemap:` line to `robots.txt`.

### Step 4: confirm in production

```bash
curl https://yourdomain.com/privacy | grep -o 'rel="canonical" href="[^"]*"'
curl https://yourdomain.com/robots.txt
```

Both should show your live domain.

### If you ever change the domain

Change the variable and redeploy. Otherwise the site tells search engines its
canonical home is an address it no longer serves.

---

## E. Adding affiliate URLs

Do this when you have a real tracking URL from a genuine affiliate or sponsor
agreement. Do not guess a URL; a guessed one either 404s or steals someone
else's attribution.

### Step 1: fill in the URL

Edit `src/lib/seo/sponsor-links.ts`. Set `url` on the entries you are enabling:

```ts
export const SPONSOR_LINKS: SponsorLink[] = [
  {
    id: 'tiktok-shop-seller-signup',
    label: 'Open a TikTok Shop seller account',
    url: 'https://the-real-tracking-url.example/...',   // <- was ''
    description: 'Official seller registration. ...',
    affiliate: true,
  },
  {
    id: 'seller-center',
    label: 'Open TikTok Seller Center',
    url: 'https://seller.tiktok.com/',                // <- was ''
    description: 'Where your real fees, promotions and commission actually live.',
    affiliate: false,
  },
];
```

Two rules:

- `affiliate: true` means **we earn money if they sign up**. That triggers a
  visible "we may earn a commission" label and `rel="sponsored"`. Both are
  required, and both are already implemented and tested.
- `affiliate: false` is for official TikTok pages where no money changes hands.
  Do not label those as affiliate links. It reads as a false disclosure, and it
  makes the genuine affiliate links on the same page look unreliable.

Leave a `url` as `''` for any link you are not enabling. The component filters
those out, so a blank URL can never render as a broken link.

### Step 2: switch it on

In the same file:

```ts
export const SPONSOR_LINKS_ENABLED = true;
```

### Step 3: verify

```bash
npm test -- --run
npm run build
npm start
```

**Seven tests will now fail, and that is correct.** They exist to ask "did
someone make a deliberate decision?" The exact list, verified by running it:

In `src/lib/seo/sponsor-links.test.ts` (5):

| Test | What to do |
| --- | --- |
| `ships with the programme switched off` | Change to assert `true` |
| `renders nothing while disabled` | Change to assert the enabled list is populated |
| `is not ready to launch, and says so` | Change to assert `sponsorLinksReady()` is `true` |
| `holds no URL until a real one is supplied` | Delete. It asserts the shipped state. |
| `lists one open item per unconfigured link for the launch checklist` | Delete, or change to assert the list is empty. |

In `src/components/seo/SponsorLinks.test.tsx` (2):

| Test | What to do |
| --- | --- |
| `renders nothing while the programme is disabled` | Delete |
| `shows no link at all, so no visitor can click an unconfigured URL` | Delete |

The two `describe` blocks these live in are named "in its shipped state", which
is a hint that they describe how the repository is meant to be found. Once the
programme is live, both blocks can go.

Leave these alone, because they describe the enabled state and are what proves
the programme is correct:

- `expects a real affiliate URL to carry a tracking parameter`. An affiliate
  link *is* a tracking identifier, so a configured link with no `aff`/`via`/
  `ref` parameter is not an affiliate link and pays nobody.
- `holds only absolute https URLs`
- everything in the `once real URLs are supplied` block: the `rel` attribute,
  the new-tab target, the visible commission label, and the blank-URL filter.

Then confirm in the browser:

```bash
curl http://localhost:3000/us/tiktok-shop-fees | grep -o 'rel="sponsored[^"]*"'
```

```
rel="sponsored noopener noreferrer"
```

And visually: the "Next steps" block appears at the bottom of each fee page with
a visible "Affiliate link" label. Labels in a tooltip or an `aria-label` do not
count as disclosure; this is why the visible label is tested.

### Step 4: update the privacy page

The privacy page already has an "Affiliate links" section describing this
programme, so no change is needed. It says links are marked before you click and
that following one does not change what you pay. Keep that true.

### Step 5: add the URLs to the checklist

Tick the affiliate block in `docs/LAUNCH.md` so the next person knows the
programme is live.

---

## F. Enabling monitoring

Nothing is instrumented. Both analytics and error monitoring are off, and
enabling either is a deliberate decision.

### Error monitoring (recommended first)

Simpler, lower risk, and no consent question: it is a first-party request
carrying an error digest and a stack, with no cookies and no identifiers.

1. Sign up with a provider that supports a first-party DSN.
2. In **Vercel → Settings → Environment Variables**, add:
   - **Key**: `NEXT_PUBLIC_ERROR_DSN`
   - **Value**: the DSN they gave you
   - Tick **Production**
3. Redeploy.
4. Confirm `monitoringSummary()` reports `Error monitoring: on`, or just trigger
   an error locally and watch it arrive.

The error boundary in `src/app/error.tsx` forwards to a `window.__errorMonitor`
sink. If your provider's script does not install that function, add one line to
your monitoring script:

```js
window.__errorMonitor = (error) => provider.captureException(error);
```

### Analytics (needs a consent banner first)

The order matters. Doing these out of order is the mistake this config exists to
prevent.

**Step 1: choose a provider.**

| Provider | Suitable here? |
| --- | --- |
| `plausible` | Yes. Cookieless, no personal data. |
| `umami` | Yes. Self-hosted, cookieless. |
| `ga4` | **No**, unless you first add a consent-management platform. |

Google Analytics sets its cookies before any banner can ask permission, which is
precisely what UK GDPR prohibits. `analyticsBlockers()` flags this automatically.

**Step 2: ship a real consent banner** that genuinely blocks the script until
the visitor opts in. A banner that appears after the script has already fired is
not consent.

**Step 3: set the variables.**

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | `plausible` or `umami` |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | your analytics domain |
| `NEXT_PUBLIC_CONSENT_GATE` | `true` |

**Step 4: confirm analytics is still off before consent.**

```bash
npm run build && npm start
curl http://localhost:3000/ | grep -ci "analytics\|plausible\|umami\|gtag"
```

Must be `0` for a fresh visitor with no consent stored. If it is not, the
provider script is loading before the banner and the setup is wrong.

**Step 5: confirm it turns on only when it should.**

`analyticsBlockers()` must return an empty list. If it does not, the reason is
named in the list.

### Order of work

Error monitoring first, analytics later if at all. On a static calculator with no
accounts and no stored data, analytics buys very little, and the consent
machinery it requires is a real compliance surface. Error monitoring is where the
value is.

---

## G. Fixing the UK and US data gaps

UK is done: its Excel was downloaded and fully extracted on 2026-09-28, and
`UK-categories.json` now carries all 343 published rows. See G1.

US is done too, and was closed on 2026-09-28: `US-categories.json` went from 78
to 202 categories and is marked `extractionStatus: "complete"`. See G2, which
also records why the section's original "pagination gap" premise was wrong.

### Read this first: where rate files live

**`data/rates/` is the single canonical location for rate data:**

```
data/rates/{US,UK,MY,SG,PH}-categories.json
```

**`src/lib/rates/loader.ts` imports those files with static `import`
statements** pointing at `../../../data/rates/`. It does not touch the
filesystem at runtime, and there is no fallback directory.

There used to be a second copy under `src/data/rates/` behind an
`fs`-based fallback. Both were removed when the loader moved to static
imports. **`src/data/rates/` no longer exists and must not be recreated.**
Nothing reads it, so a copy placed there is a trap: it looks authoritative, it
is never read, and no test fails when it silently drifts out of step with the
file that is actually used. Git already holds the full history, so a second
on-disk copy protects nothing.

**Always edit `data/rates/` directly, then run the tests and rebuild.**

### After editing a rate file

The rates are read at build time, so verify with:

```bash
npm test -- --run
npm run build
```

### When to change what

Three fields control how a gap is presented. Set them honestly, and the pages
will present themselves correctly without further work.

| Field | Meaning |
| --- | --- |
| `extractionStatus` | `partial`, `complete`, or `failed` |
| `coverage` | Human-readable summary shown on the page |
| `missingData` | Why data is missing, shown to the visitor |
| `missingCategories` | US only: which categories pagination hid |
| `defaultRate` | UK only: the headline default alongside cluster entries |
| `category.confidence` | `high`, `medium`, `low`, `needs-verification` |

**Do not set `extractionStatus` to `complete` until the gap is genuinely closed.**
A page that claims completeness while missing 20 categories is worse than one
that admits the gap, because a seller will make a decision on it.

### G1. UK — the Excel download

**Status: done.** The Excel was downloaded and fully extracted on 2026-09-28.
G1 is kept below as the re-verification procedure.

**Current state.**

```
categories: 347  (4 policy-level records + 343 rows from the Excel)
coverage:   complete
missingData: "none"
excelFile:  "TikTok Shop UK - Commission Rates by Product Category V2.xlsx"
             needsManualDownload: false
```

The 4 policy-level records were kept, because the page uses `defaultRate` for the
headline comparison and deleting them removes the reference the rest of the page
is built against:

```json
{
  "id": "uk-standard",
  "name": "Standard Rate (most categories)",
  "parentCategory": "All Other Categories",
  "rate": 0.09,
  "confidence": "high",
  "notes": "Default 9% commission rate inclusive of VAT"
}
```

The 343 Excel rows break down as 28 categories: 24 that publish a single `All`
row, and 4 that publish their own sub-categories (Beauty & Personal Care 116,
Computers & Office Equipment 73, Phones & Electronics 71, Pre-Owned 59). No
category publishes both, so `uk-<category>-all` never collides with a real
sub-category. Every row is `uk-<category-slug>-<sub-category-slug>` at
`confidence: high`, carrying `notes: "From official UK Excel (V2)"`.

**Watch the exception list.** 127 categories sit at 5% against a 9% default.
A card per off-default row produced 130 exception cards that restated the
category table, so `buildExceptions` in `src/lib/seo/market-pages.ts` collapses a
shared off-default rate into one summary row once more than 4 categories share
it. Raise `DEVIATION_COLLAPSE_THRESHOLD` only with a reason; below it, genuine
one-off exceptions stay individually named.

**The 347-row table.** That is too long to scan, so the UK page wraps the table in
`CategoryTableFilter`, which adds a "Search categories..." box. Two properties
must hold if you touch it:

- All 347 rows stay in the prerendered HTML. Filtering only sets the `hidden`
  attribute at runtime, so search engines and readers without JavaScript see the
  full table. Never move the filtering into `buildMarketPageModel`.
- The box is UK only. It is rendered by a `meta.market === 'UK'` branch in the fee
  page, because the other four markets top out at 63 rows and do not need it.
  US is now the obvious next candidate at 202 rows; if the branch is widened,
  re-measure the prerendered page size, because the filter itself works fine
  that large.

`CategoryRateTable` also takes `showParentLabel`, which prints the parent
category above each sub-category name. UK needs it, since it lists 116
sub-categories under Beauty & Personal Care and a bare "Accessories" does not
identify a category. It defaults to off so the other four tables are unchanged.
Matching uses the `data-search` attribute, which holds parent and name together.

**Procedure.**

1. Download the Excel file. The download URL is in
   `data/rates/UK-categories.json` under `excelFile.downloadUrl`. It needs a
   logged-in Seller Center session, which is why it cannot be extracted
   automatically.
2. Open it. Map each spreadsheet row to one `categories[]` entry.
3. Append the entries. Keep the existing 4 policy-level records: the page uses
   `defaultRate` for the headline comparison, and deleting them removes the
   reference the rest of the page is built against.
4. Give every new row a real `confidence`. A row read straight from an official
   spreadsheet is `high`. One inferred from a similar category is `low`, and it
   should carry a `notes` saying what it was inferred from.
5. Update the metadata:

```json
"extractionStatus": "complete",
"coverage": "complete",
"missingData": "none"
```

6. Set `excelFile.needsManualDownload` to `false` only when the extraction is
   genuinely finished and the file is no longer the source of truth.
7. Run the tests and rebuild.

There is one copy of the file, in `data/rates/`, and that is the copy the loader
imports at build time.

**Rate format.** `rate` is a decimal fraction, not a percentage. `9%` is `0.09`,
`12.5%` is `0.125`. The schema rejects anything outside 0 to 1, and it is not a
published range, it is a validation bound. Writing `9` for a 9% rate would be
read as 900%.

**VAT.** UK commission is quoted inclusive of VAT. Put that in `notes` on each
row, as the existing record does, so nobody compares it against a net figure.

**Watch the promo interaction.** The UK new-seller promo reduces commission
below the default. If the Excel shows promo rates, add them as `specialRules`
entries of type `promo` with `discountedRate`, rather than overwriting `rate`.
The fee pages already handle the promo separately, and overwriting `rate` would
double-count it. The published Excel contains no promo rows: it carries only
0.05 and 0.09.

### G2. US — the pagination gap

**Status: done.** The source page was fetched and fully extracted on 2026-09-28.

```
categories:   202  (78 before, +124 added)
parents:      27   (15 before, +12 added)
rates:        0.06 on 185 rows, 0.05 on 17 rows
coverage:     complete
```

**The premise in this section was wrong, and that is why it took a full read of
the page to close it.** There is no pagination. TikTok renders the entire
commission table into the server-side HTML of the single page at `sourceUrl`,
206 data rows in one `<table>`, delivered in the initial payload. The earlier
"~20-30 hidden sub-categories" note was a guess written without opening the
page, and the real gap was 126 rows across 12 entire parent categories that had
never been extracted at all: Food & Beverages, Furniture, Health, Home
Improvement, Home Supplies, Kids' Fashion, Kitchenware, Luggage & Bags,
Menswear & Underwear, Pet Supplies, Sports & Outdoor, and Toys & Hobbies.

Lesson worth keeping: a disclosure that names a specific shortfall should be
verified against the source before it is written down, not estimated. The
estimate was wrong by 4x and it pointed at the wrong parent categories.

**Two judgement calls, both taken with the owner:**

- The 4 rows under `PPE Auto Test Category L1` and `PPE Manual Test Category L1`
  ("Auto Test Category L2 001", "Manual Test Category L2 Leaf 003" and
  siblings) are TikTok's own QA stubs, published in the same table. They were
  dropped. They are not categories a seller can list under, and surfacing
  "Auto Test Category L2 001" as a real commission rate would be worse than
  omitting it. The page is a transcript minus internal fixtures, not a
  byte-for-byte mirror.
- Two existing rows no longer appear on the page: `us-books-schooling`
  ("Schooling") and `us-jewelry-crystal` ("Crystal"). Their current published
  equivalents were already in the table ("Education & Schooling", "Natural
  Crystal", both 6%), so the pairs are renames, not deletions. The two stale
  rows were renamed in place, keeping their ids. Nothing was deleted, and
  because the ids are unchanged, no calculation path or saved calculator link
  can break.

Ids for the 124 new rows use the file's existing convention: a short parent
prefix, then the slug, e.g. `us-pet-dog-cat-food`. The 15 pre-existing parents
keep their hand-shortened prefixes (`auto`, `preowned`, `household-appliances`,
and so on) rather than a mechanical slug of the parent name, because those ids
are already referenced and a mechanical slug would have rewritten them.

The 16 rows carrying the "$10,000, 3%" note kept the same `tieredThreshold`
`specialRules` shape the file already used for Collectibles and Pre-Owned. The
note text is carried verbatim as the description. Every other row has
`specialRules: []`.

**Verify the result in the browser** after rebuilding:

- The coverage note on the US page should no longer say the table is partial.
- The count of commission rows should equal the number of categories in the
  file, 202.
- The US new-seller promo is still unverified. That is a separate, known gap and
  it should stay flagged. The US rate file contains no `promo` rules at all, and
  the form labels the US promo rate unverified. It is not part of this fix.

### G3. MY and SG (also partial, lower priority)

| Market | Categories | Coverage | Gap |
| --- | --- | --- | --- |
| MY | 6 | `ranges-and-examples-only` | Full sub-category table |
| SG | 10 | `cluster-level-only` | Sub-categories in 3 PDFs (Oct 2025, Apr 2026, Jul 2026) |
| PH | 63 | `complete` | None |

Same procedure. For MY, the Dynamic Commission rates publish a range and a
per-item cap rather than a single rate, because sub-category rates are not
disclosed. Use `rateRange` and `capPerItem` on the fee record, and do not invent
a single rate to fill the gap. For SG, `clusterStructure` already holds the
cluster membership, so sub-categories attach to an existing cluster key.

### After any data change

```bash
npm test -- --run     # 659 tests, 45 files
npm run build
npm start
```

Then look at the affected market page and confirm:

- the coverage note matches reality
- the new rows carry the confidence you intended
- the source date and last-verified date are current
- nothing that was previously a disclosure card has silently become a number
  without a rate to back it up

---

## H. Adding a new market

Five markets are supported today: `US`, `UK`, `MY`, `SG`, `PH`. Adding a sixth is
a contained change. There are six places that need to know about it.

**Touching any of these touches a fee page, so treat it as a data change: never
invent a rate to make a new market look complete.**

### 1. Add the market to the type

`src/lib/calculation/types.ts`:

```ts
export type Market = 'US' | 'UK' | 'MY' | 'SG' | 'PH';
```

Add the new code, for example `ID`.

### 2. Allow it in the schema

`src/lib/rates/schema.ts`, in `MarketRateDataSchema`:

```ts
market: z.enum(['US', 'UK', 'SG', 'MY', 'PH']),
```

Zod will reject the new file until this is updated, which is the intended
behaviour.

### 3. Register the file in the loader

`src/lib/rates/loader.ts`:

```ts
const MARKET_MODULES: Record<MarketCode, unknown> = {
  US: usRaw,
  PH: phRaw,
  SG: sgRaw,
  MY: myRaw,
  UK: ukRaw,
};
```

Each entry is a static `import` of the matching `data/rates/<CODE>-categories.json`
at the top of the file. Add the import alongside the existing ones. A market
missing from this map is simply not loaded.

### 4. Create the rate file

Write `data/rates/ID-categories.json`. That is the only copy; see the warning in
section G.

Validate against `MarketRateDataSchema`. Required at the top level: `market`,
`currency`, `sourceUrl`, `sourceDate`, `lastVerified`, `coverage`,
`extractionStatus`, `categories`. Every category needs `id`, `name`,
`parentCategory`, `rate` and `confidence`; the rest inherit from the file
provenance.

Set `extractionStatus: "partial"` and fill in `missingData` unless you have the
complete table on day one.

### 5. Add the market to the SEO pages

`src/lib/seo/market-pages.ts`. This is the largest piece. `SEO_MARKETS` is the
single source of truth for the route slug, the page title, the description, the
H1, the structured data, and the source link, and it is where you add the
market-specific explanatory copy, the coverage and confidence notes, the fee
sections, the disclosures, and the FAQs.

Add the entry to `SEO_MARKETS` with a unique `slug` (the URL segment, lowercase).
The sitemap picks it up automatically from that array, so no change is needed
there.

### 6. Check the calculation layer

`src/lib/calculation/markets/` holds one module per market. A market with
bespoke rules needs its own module plus a test file, following the pattern in
`US.ts` and `UK.test.ts`. A market whose fees are entirely in the rate file may
not need one at all; check whether the existing engines can express its fees
before writing a new one.

If the new market uses a different currency, add it to the formatting path. The
calculator formats with `Intl.NumberFormat` and a narrow symbol, with a safe
fallback for currencies it does not recognise.

### 7. Verify

```bash
npm test -- --run
npm run build
```

The build output should show the new market as an SSG path under
`/[market]/tiktok-shop-fees`. Then:

```bash
npm start
curl http://localhost:3000/id/tiktok-shop-fees
```

Confirm the page renders, the H1 and title are right, the coverage note is
honest, every category row shows a confidence badge, the sitemap now lists the
new URL, and an unknown market still 404s.

---

## I. Running tests, build and lint locally

Requires Node 18.17 or newer. In this project, Node 22.

### The three commands

```bash
npm test -- --run      # full suite, 659 tests across 45 files, about 65 seconds
npx tsc --noEmit       # type check, no output means clean
npm run build          # production build, about 15 seconds
npx eslint src         # lint
```

**`npm test` needs `-- --run`.** Without it the test runner starts in watch mode
and appears to hang. This is the single most common stumble.

### Expected results

| Command | Expected |
| --- | --- |
| `npm test -- --run` | `Test Files 45 passed (45)`, `Tests 659 passed (659)` |
| `npx tsc --noEmit` | No output |
| `npx eslint src` | `1 problem (0 errors, 1 warning)` |
| `npm run build` | `✓ Compiled successfully`, `Generating static pages (14/14)` |

**That one lint warning is expected.** It is a pre-existing unused variable
called `p` in `src/lib/calculation/engine.test.ts:76`. It is not new and is not
caused by anything you will do. If you see a *different* warning or any error,
something you changed is the cause.

**The SWC warning is expected.** See section A.

### Single file or single test

```bash
npx vitest run src/lib/legal/content.test.ts
npx vitest run -t "sponsor"
npx vitest run src/lib/calculation/markets/UK.test.ts
```

### Development server

```bash
npm run dev          # hot reload, http://localhost:3000
```

Use the dev server for writing copy or styling. Use `npm run build` plus
`npm start` before trusting anything, because rates are read from disk at build
time and a dev server can serve stale data.

### Smoke test after any build

```bash
npm run build
npm start
```

In a second terminal, all eleven should return 200:

```bash
for p in / /us/tiktok-shop-fees /uk/tiktok-shop-fees /my/tiktok-shop-fees \
         /sg/tiktok-shop-fees /ph/tiktok-shop-fees /disclaimer /privacy \
         /terms /robots.txt /sitemap.xml; do
  printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done
```

PowerShell equivalent:

```powershell
foreach ($p in @('/','/us/tiktok-shop-fees','/uk/tiktok-shop-fees','/my/tiktok-shop-fees',
                 '/sg/tiktok-shop-fees','/ph/tiktok-shop-fees','/disclaimer','/privacy',
                 '/terms','/robots.txt','/sitemap.xml')) {
  "{0,-24} {1}" -f $p, (Invoke-WebRequest "http://localhost:3000$p" -UseBasicParsing).StatusCode
}
```

All should show `200`. Then confirm these should show `404`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/de/tiktok-shop-fees   # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/nope                  # 404
```

A `200` on an unknown market means `dynamicParams = false` was removed, which
would let the app attempt a render for a market with no data.

### Where things are

```
data/rates/                        rate files (the only copy)
src/lib/rates/schema.ts            Zod schemas
src/lib/rates/loader.ts            loads and validates rate files
src/lib/calculation/               calculation engines (do not change casually)
src/lib/legal/content.ts           the three legal documents
src/lib/seo/sponsor-links.ts       affiliate links
src/lib/seo/market-pages.ts        per-market SEO content
src/lib/monitoring/config.ts       analytics and error monitoring
src/lib/site/config.ts             NEXT_PUBLIC_SITE_URL
src/app/[market]/tiktok-shop-fees/ the five fee pages
src/app/{disclaimer,privacy,terms}/ the three legal pages
docs/LAUNCH.md                     launch checklist
docs/HANDOFF.md                    this file
```

### If something fails

| Symptom | Cause |
| --- | --- |
| `npm test` appears to hang | Missing `--run`. Use `npm test -- --run`. |
| Edit to a rate file has no effect | Edited outside `data/rates/`, or the file is not in the `MARKET_MODULES` map. See section G. |
| Data change not visible on the page | Dev server running, or no rebuild. Use `npm run build && npm start`. |
| Canonical shows `localhost` | `NEXT_PUBLIC_SITE_URL` unset or not rebuilt. Section D. |
| Affiliate links not appearing | `SPONSOR_LINKS_ENABLED` still `false`, or the URL is `''`. Section E. |
| 7 sponsor tests failing after enabling | Expected. Section E step 3 lists them by name. |
| New market 404s | Not added to `MARKET_MODULES`. Section H. |
| `Invalid Win32 application` during build | Expected. See section A. |

---

## Summary

| | Status |
| --- | --- |
| Code | Launch-ready |
| Tests | 683 passing, 46 files |
| Lighthouse | 96 / 95 / 97 performance, 100 across the other three |
| Browsers | Chrome and Firefox verified. Safari not tested; cannot run on Windows. |
| Blockers | Four, all business decisions. Sections B, D, E, F. |
| Data | UK complete (347 categories), US complete (202 categories). |
