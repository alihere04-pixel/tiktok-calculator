# Phase 2 work queue

Written 2026-09-28, at the end of the data phase. Nothing in this document has
been started. It exists so that Phase 2 can be picked up without re-reading all
1071 lines of `HANDOFF.md`.

**State at the time of writing.** UK and US are complete. PH is complete. SG and
MY are still partial, and those two are the whole of Phase 2 section 1. Section
2 is the standing procedure for a sixth market, not a queued task.

**The rule that governs everything below.** Never invent a rate. A missing number
is rendered as a "Not in our verified dataset" card, which is a working product.
An invented number is a defect that ships. Every step here is written so that the
honest fallback is always available.

| Market | Categories | Parents | extractionStatus | coverage | missingData |
| --- | --- | --- | --- | --- | --- |
| US | 202 | 27 | `complete` | `complete` | `none` |
| UK | 347 | 31 | `complete` | `complete` | `none` |
| PH | 63 | 20 | `complete` | `complete` | field absent |
| SG | 10 | 5 | `partial` | `cluster-level-only` | set |
| MY | 6 | 2 | `partial` | `ranges-and-examples-only` | set |

---

## 1. MY — the missing sub-category table

**Source.** `https://seller-my.tiktok.com/university/essay?knowledge_id=6907739532281602`
(`sourceDate: 2025-09-13`, `lastVerified: 2026-09-26`, currency MYR)

**What exists today.** 6 categories across 2 parents. They are BXP/Non-BXP ×
Marketplace/Mall rows for Electronics and Toys, each a *point* rate:

| id | Parent | Rate |
| --- | --- | --- |
| `my-electronics-bxp-mp` | Electronics | 0.0702 |
| `my-electronics-bxp-mall` | Electronics | 0.1026 |
| `my-electronics-nonbxp-mp` | Electronics | 0.1134 |
| `my-electronics-nonbxp-mall` | Electronics | 0.1459 |
| `my-toys-nonbxp-mp` | Toys | 0.1458 |
| `my-toys-nonbxp-mall` | Toys | 0.1782 |

The file also carries a `knownRanges` block with the published bands
(`bxpMarketplace` 4.86%–9.18%, `nonBxpMarketplace` 11.34%–17.82%,
`bxpMall` 8.91%–12.42%, `nonBxpMall` 14.58%–18.90%), and an
`additionalFees.dynamicCommission` record holding `rateRange: "4.00% - 6.00%"`
with `capPerItem: 650000` and `confidence: "medium"`.

**The trap, stated plainly.** The Dynamic Commission fee is published as a range
plus a per-item cap, not a single rate, because MY does not disclose
sub-category rates. Do **not** average 4.00% and 6.00% into 5.00% to make the
table look tidy. Use `rateRange` and `capPerItem` on the fee record. A midpoint
is a number TikTok never published and a seller could act on.

### Steps

1. Open the source page and find the published sub-category table. Expect it to
   be a PDF download rather than an inline table; record the real filename and
   size, because `missingData` currently says only `full sub-category table`.
2. Extract every published row. Match the existing record shape exactly:

   ```json
   {
     "id": "my-electronics-bxp-mp",
     "name": "...",
     "parentCategory": "Electronics",
     "rate": 0.0702,
     "confidence": "high"
   }
   ```

3. Keep the `my-` prefix and every id unique. The schema does not enforce
   uniqueness, so a duplicate id silently makes one row unreachable and can make
   two categories resolve to the same fee. Do not introduce a `my-standard` id;
   UK and MY both already have a policy-level "standard" record, and reusing the
   name for a different thing in another market is how the two get confused.
4. Reuse `parentCategory` values that already exist rather than inventing near
   duplicates. The source groups by parent and a new spelling splits one group
   into two.
5. Carry BXP / Non-BXP and Marketplace / Mall as separate `parentCategory`
   values or as distinct rows, matching whatever the source table's own column
   headers do. Do not collapse the four combinations into one row.
6. Where a sub-category genuinely has no published point rate, leave it out and
   widen `missingData` to name it. Do not fill it from the `knownRanges`
   midpoint.
7. Only then promote the metadata:

   ```json
   "extractionStatus": "complete",
   "coverage": "complete",
   "missingData": "none"
   ```

   Do not promote while any published row is still missing. A disclosure that
   admits a gap is a working page; a wrong number is a liability.
8. The file lives at `data/rates/MY-categories.json` and that is the only copy —
   see `HANDOFF.md` section G.
9. Re-check the `dynamicCommission` record. If the sub-category table turns out
   to publish real rates, `rateRange` may be superseded, but only if the source
   says so. Otherwise leave the range and the `RM 650,000` cap alone.
10. Update the MY assertions in `src/lib/seo/market-pages.test.ts` if any status
    changes, and add the row-count assertion to
    `src/lib/rates/loader.test.ts` following the pattern of the existing
    `carries the full US category table` test.

### Verify

- `npm test -- --run`
- `npm run build`
- `npm start`, then load `/my/tiktok-shop-fees` and confirm the coverage note no
  longer says the table is truncated, the commission row count equals the
  category count, and the Dynamic Commission line still reads
  `4.00% - 6.00%` with the `RM 650,000.00 per item` cap.

---

## 2. SG — sub-categories from three PDFs

**Source.** `https://seller-sg.tiktok.com/university/essay?knowledge_id=2161524467910401`
(`sourceDate: 2026-04-01`, `lastVerified: 2026-09-26`, currency SGD)

**What exists today.** 10 categories, all cluster-level. Rates carry four
decimal places because they are averages of a cluster, not a single product
category: `0.0545`, `0.07085`, `0.08175`, `0.0436`, `0.05995`. The `coverage`
field says `cluster-level-only` for exactly this reason.

**The trap, stated plainly.** Cluster rates are blended averages. Splitting a
cluster into sub-categories does not mean dividing its rate by the number of
children. Each sub-category has its own published rate, and it may well be
above or below the cluster average.

### Steps

1. Download all three PDFs. The file already records their names, sizes and
   contents in `pdfReferences`:

   | File | Size | Contains |
   | --- | --- | --- |
   | `Commission Fee Rate from 1st October 2025.pdf` | 258.5 KB | Category tree update: massage devices, hair dryers, curlers & straighteners moved from Fashion to the Electronics cluster |
   | `Platform Commission Fee Rate from 1st April 2026.pdf` | 364.4 KB | Full rate table effective 1 Apr 2026 |
   | `Platform Commission Rates from 27 July 2026.pdf` | 1.6 MB | Latest rate table effective 27 Jul 2026 |

2. **Resolve the date order before extracting anything.** The July 2026 table is
   the newest, so it supersedes the April 2026 table, which supersedes October
   2025. Extract all three for provenance, but mark the applicable rate per
   sub-category from the newest table that lists it, and note the `effectiveFrom`
   date on each row. A sub-category present in April but absent in July is a
   real finding: either it was renamed or delisted, and both files are needed to
   tell which.
3. The October 2025 tree change is a membership change, not a rate change. When
   a sub-category moves cluster, update its `parentCategory` and check whether
   the cluster key in `clusterStructure` needs a new entry.
4. `clusterStructure` already holds the cluster membership, so attach each
   sub-category to an existing cluster key. Keep the four existing keys
   (`electronicsCluster`, `fashionCluster`, `fmcgCluster`, `lifestyleCluster`)
   unless a genuine new cluster appears.
5. Record shape, matching the existing rows:

   ```json
   {
     "id": "sg-electronics-bxp",
     "name": "...",
     "parentCategory": "Electronics / Selected Lifestyle",
     "rate": 0.0545,
     "confidence": "high"
   }
   ```

   Keep the `sg-` prefix, keep ids unique, and keep the `BXP` acronym uppercase
   in `name` so the fee labels stay correct — a test asserts the label
   `BXP Service Fee`.
6. Keep the two `All Unlisted Categories` fallback rows (`sg-standard-default`,
   `sg-bxp-default`). They are the catch-all for anything not in the table and
   must survive the split.
7. The `bxpRestricted`, `bxpMixed` and `bxpSuspendedRate` records describe
   order-level rules, not product categories. They stay in
   `additionalFees` and must not become category rows.
8. Set `extractionStatus`, `coverage` and `missingData` only once every
   published sub-category is present:

   ```json
   "extractionStatus": "complete",
   "coverage": "complete",
   "missingData": "none"
   ```

9. The file lives at `data/rates/SG-categories.json` and that is the only copy.
10. Add row-count and uniqueness assertions to `src/lib/rates/loader.test.ts`
    and update the coverage expectations in
    `src/lib/seo/market-pages.test.ts`. Note that `sg` currently sits in the
    `partial` loop of `still discloses the real gaps on the partial markets`; it
    moves out once complete.

### Verify

Same three commands. On `/sg/tiktok-shop-fees` confirm the coverage note, that
`BXP Service Fee` still renders uppercase, and that the two
`All Unlisted Categories` rows are still present at the bottom of the table.

---

## 3. Adding a sixth market

Not a queued task. This is the standing procedure, and it is short enough to
follow from `HANDOFF.md` section H. Six touch points:

1. **`src/lib/calculation/types.ts`** — add the code to the union:
   `export type Market = 'US' | 'UK' | 'SG' | 'MY' | 'PH';`
2. **`src/lib/rates/schema.ts`** — add it to the Zod enum. Zod will reject the
   new file until this is done, which is the intended behaviour, not a bug.
3. **`src/lib/rates/loader.ts`** — add a static `import` of the new file next
   to the existing ones and add its entry to `MARKET_MODULES`. A market missing
   from this map is simply not loaded, with no error.
4. **The rate directory** — write `data/rates/<CODE>-categories.json`. That is
   the single canonical copy. Required at the top level: `market`, `currency`,
   `sourceUrl`, `sourceDate`, `lastVerified`, `coverage`, `extractionStatus`,
   `categories`. Every category needs `id`, `name`, `parentCategory`, `rate`,
   `confidence`; the rest inherit from file provenance. Set
   `extractionStatus: "partial"` and fill in `missingData` unless the complete
   table is in hand on day one.
5. **`src/lib/seo/market-pages.ts`** — the largest piece. `SEO_MARKETS` is the
   single source of truth for the route slug, page title, description, H1,
   structured data and source link, and it is where the explanatory copy,
   coverage and confidence notes, fee sections, disclosures and FAQs live. The
   sitemap picks the new URL up automatically from that array. Give it a unique
   lowercase `slug`.
6. **The calculation layer** — `src/lib/calculation/markets/` holds one module
   per market, and each of the current five has a matching `.test.ts`. A market
   with bespoke rules needs its own module following the pattern in `US.ts` and
   `UK.test.ts`. A market whose fees are entirely in the rate file may not need
   one at all: check whether the existing engines can express its fees before
   writing a new one. A different currency goes into the formatting path, which
   uses `Intl.NumberFormat` with a narrow symbol and a safe fallback.

Then `npm test -- --run` and `npm run build`. The build should list the new
market as an SSG path under `/[market]/tiktok-shop-fees`. With `npm start`:
confirm the page renders, the H1 and title are right, the coverage note is
honest, every category row shows a confidence badge, the sitemap lists the new
URL, and an unknown market still 404s.

---

## 4. Legal pages — post-rewrite state

Closed on 2026-09-28. Recorded here because the rewrite changed what a future
reader should expect from these pages, and because one item is still open.

`/privacy` was restructured into the standard ICO sequence: contact details,
what is collected, lawful bases, the seven data subject rights, how to make a
request, where data comes from, retention, how to complain. Two corrections came
out of it, and both matter more than the restructure itself:

- The page said "we collect nothing about you" while a later section admitted the
  host logs your IP address. It now names the log data and gives it a lawful
  basis (legitimate interests) instead of denying it exists.
- It had no rights section and no complaints route, so a reader who wanted to
  act on a right had nothing to act on. The ICO's published address is now
  given, so a complaint is actually actionable.

The contact address is filled in. It is `contact@fynza.store`, a role address on
the `fynza.store` domain, published on `/privacy` and in the site footer. Mail is
delivered by Namecheap email forwarding, `contact@fynza.store` ->
`alihere04@gmail.com`, and that forwarding was **manually verified** — a test
message was sent and confirmed to arrive at the destination inbox — before the
address was published. The forwarding destination is deliberately not published
on the site, so it stays private.

This replaced a personal mailbox, `alihere04@gmail.com`, which was the contact
from 2026-09-28 until the switch. It was changed because publishing a personal
inbox is a privacy exposure, and because it was a single point of failure: losing
access would leave the page advertising a dead contact.

It is still the one email the content test permits: the check is an exact-set
match, so a second address fails the suite rather than shipping. That guard is
the reason delivery was confirmed by hand first — it exists to stop an
unverified address shipping, not to block a verified one.

**Filled on 2026-09-28** — the three values that were previously `OPEN_ITEM`:

- `/privacy` server log retention: 90 days. Asserted as fact, but configured on
  the Vercel project rather than in this code, so it is unverified from the
  repository. If the project says 30, the page is wrong.
- `/terms` operator name: Fynza, written as a **trading name** rather than a
  registered company, so the page does not assert a legal person that may not
  exist. The governing-law clause was reworded to "where this site is operated
  from" for the same reason.
- `/terms` jurisdiction: Pakistan, which also required adding Pakistan to the
  list of countries in the privacy page's ICO-reach sentence.

`legalOpenItems()` now returns `[]`, so all three pages report zero
placeholders. The draft notice is per page and still counts, so it is removed by
value rather than by code change; it stays until a lawyer signs off.

**A false claim that was live, found while verifying the above.** The root layout
mounted Vercel Web Analytics unconditionally, so the privacy page's "No
analytics or tracking scripts run by default" was untrue on the deployed site
while all 689 tests passed. The test covering it asserted the sentence existed
in the content file, which is a fact about a string and not about the running
site. The tracker now sits behind `AnalyticsGate`, which withholds the script
unless two independent things are both true: `lib/monitoring/config.ts` reports a
provider, a destination domain and `NEXT_PUBLIC_CONSENT_GATE=true`, **and** the
visitor's own stored decision in `lib/consent/consent.ts` is an acceptance.
Neither implies the other.

`NEXT_PUBLIC_CONSENT_GATE` is only a claim that a banner exists in this codebase;
it is not the visitor's decision. Reading it as consent is the bug the runtime
gate exists to close. **A real consent banner has since been built**:
`ConsentBanner` offers Accept analytics and Decline and stores the answer per
browser under `fynza.analytics-consent`, so no choice or a decline means nothing
loads. No provider or domain is configured, so analytics remains off and the
banner does not appear at all. The flag stays `false`.

**The pattern worth carrying forward:** three separate guards checked text
rather than behaviour — the analytics sentence, the `legalOpenItems()` marker
count, and a `HANDOFF.md` claim that the suite "fails if any `OPEN_ITEM`
survives". All three were satisfiable while the thing they described was wrong.
The two fixed guards now assert on rendered output (`document.head`) and on a
synthetic document, and both were verified by mutation: breaking the gate fails
two tests, breaking the detector fails one.

**Two ways this page can silently become wrong**, both recorded in
`HANDOFF.md` section B2: enabling analytics without updating the claims, and
adding logging, a CDN or a rate limiter that captures more than a request log.
The second is the more likely one and the easier to forget.

## 5. Remaining NEEDS VERIFICATION items

Each of these renders as an explicit "Not in our verified dataset" card today.
That is correct behaviour, not a bug. None should be closed without a source.

| Item | US | UK | MY | SG | PH | Note |
| --- | --- | --- | --- | --- | --- | --- |
| New-seller promotion | unverified | **0%, medium** | unverified | unverified | unverified | No rate file populates a US promo. Kept flagged deliberately: it is a separate gap from the pagination work and closing that gap did not close this one. |
| Refund administration fee | unverified | — | — | — | unverified | The US page states the reason rather than guessing. |
| Transaction fee | unverified | unverified | **available** | **available** | unverified | MY 3.78%, SG 3.27% (SG is `medium` confidence: the rate is confirmed, the Apr 2026 base change is not). |
| Fixed fees | unverified | unverified | **available** | **available** | unverified | MY platform support fee `RM 0.54` per order is an amount, not a percentage. |
| Affiliate programme | unverified | unverified | unverified | unverified | unverified | Feature is built and tested but switched off; `SPONSOR_LINKS_ENABLED` is `false` and both URLs are empty. A guessed `?aff=` link either 404s or attributes someone else's signup. |
| Commission sub-category coverage | **complete** | **complete** | partial | partial | **complete** | MY and SG; sections 1 and 2 above. |
| Legal entity name, governing jurisdiction | — | — | — | — | — | **Filled 2026-09-28.** Fynza (trading name) and Pakistan. Wording is unreviewed; a lawyer still has not seen it. |
| Server log retention period | — | — | — | — | — | **Filled 2026-09-28** as 90 days, asserted as fact. Set at the Vercel project, so it cannot be confirmed from the code. Verify before deploy. |
| `NEXT_PUBLIC_SITE_URL` | — | — | — | — | — | **Set on Vercel to `https://fynza.store`.** Verified against the live site: `robots.txt` carries the `Sitemap:` line and all pages serve absolute canonicals. Local builds still fall back to localhost, so check the env is present when building. |
| Analytics and monitoring | — | — | — | — | — | **Analytics is off.** The tracker was found mounted unconditionally in the root layout; it is now behind `AnalyticsGate`, which requires both a build-time provider/domain/`NEXT_PUBLIC_CONSENT_GATE` configuration **and** a stored per-visitor acceptance in `src/lib/consent/consent.ts`. A real `ConsentBanner` now exists and stores Accept/Decline, so the old "no consent banner" blocker is closed. No provider or domain is set, so the banner does not appear and nothing loads; `NEXT_PUBLIC_CONSENT_GATE` stays `false`. |

### Verification baseline

| Command | Expected |
| --- | --- |
| `npm test -- --run` | `Test Files 46 passed (46)`, `Tests 685 passed (685)` |
| `npx tsc --noEmit` | No output |
| `npx eslint src` | `1 problem (0 errors, 1 warning)` |
| `npm run build` | `✓ Compiled successfully`, `Generating static pages (14/14)` |

Two warnings are expected and are not yours to fix: the single ESLint warning
is a pre-existing unused variable `p` at `src/lib/calculation/engine.test.ts:76`,
and the `@next/swc-win32-x64-msvc` "not a valid Win32 application" message is a
local binary mismatch that does not affect Vercel, which uses its own toolchain.
If you see a *different* warning or any error, something you changed is the
cause.

`npm test` needs `-- --run`. Without it the runner starts in watch mode and
appears to hang. It is the single most common stumble.
