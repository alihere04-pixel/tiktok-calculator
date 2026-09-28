/**
 * Content for the three legal pages.
 *
 * Two rules govern this file, both of which matter more than the prose:
 *
 *   1. Nothing here asserts a legal fact that was not supplied. The operator
 *      trading name (Fynza), the jurisdiction it operates from (Pakistan), the
 *      hosting log retention period and a privacy contact address have all been
 *      given by the operator, so they appear as real values. Anything a real
 *      document still needs and this repository does not have is a
 *      clearly-marked `OPEN_ITEM` and `legalOpenItems()` exposes it, so it shows
 *      up in the launch checklist and in the test suite rather than shipping as
 *      a plausible-looking blank. There is still no company number and no
 *      registered postal address here, and neither has been invented.
 *
 *   2. The pages describe what this tool actually does. It reads public
 *      rate documentation, estimates fees, and stores nothing about the
 *      visitor. The privacy page is written against that real behaviour, not
 *      against a generic template, because a template that claims to collect
 *      data we do not collect is its own kind of lie.
 *
 * These are drafts written by a developer, not by a lawyer. Every value a real
 * document needs is now filled in, so `legalOpenItems()` returns an empty list,
 * but an empty list is not a legal review. The wording is unreviewed and the
 * launch checklist still blocks on one.
 */

export type LegalSlug = 'disclaimer' | 'privacy' | 'terms';

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  metaDescription: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

/** Marker for a value that must be supplied before launch. */
const OPEN = 'OPEN_ITEM';

/**
 * Exported so the shared legal page shell can say whether the page a reader is
 * actually looking at still contains a placeholder, instead of asserting the
 * same thing on all three pages regardless.
 *
 * All three documents are currently complete, so `legalOpenItems()` returns
 * `[]` and the shell reports zero placeholders on every page. The marker and
 * the detector both stay in place deliberately: they are what catches a
 * placeholder being reintroduced later, and the test suite exercises both the
 * empty and the detecting path against the real function.
 */
export const OPEN_ITEM_MARKER = OPEN;

export const LAST_REVIEWED = '2026-09-28';

/**
 * The privacy contact address. This is the one real contact value the operator
 * has supplied, so it is a constant rather than an `OPEN_ITEM` and the privacy
 * page can actually name a way to reach us.
 *
 * It is a personal mailbox, not a role address on a domain. That is acceptable
 * for a site this size, but it is a single point of failure: if access to it is
 * lost, the page is advertising a dead contact. Move to an address on a domain
 * you control before relying on it commercially.
 *
 * PLANNED: switch to `contact@fynza.store` once that domain is live. The value
 * below is deliberately unchanged until then. Two things must change in the
 * same commit, or the suite goes red:
 *
 *   1. this constant, and
 *   2. the exact-set email assertion in `content.test.ts` ("does not invent an
 *      operator name, company number or address"), which currently matches
 *      `{alihere04@gmail.com}` and fails on any second address.
 *
 * Do not publish `contact@fynza.store` until the zone is controlled and mail
 * routes to a monitored inbox. A published address nobody reads is worse than a
 * personal one that at least somebody owns.
 */
const PRIVACY_CONTACT_EMAIL = 'alihere04@gmail.com';

const SHARED_DISCLAIMER_SECTION: LegalSection = {
  id: 'not-affiliated',
  heading: 'Not affiliated with TikTok',
  paragraphs: [
    'This website is an independent tool. It is not affiliated with, endorsed by, sponsored by or approved by TikTok or ByteDance Ltd.',
    'TikTok Shop is a trademark of its respective owner. We use product and market names only to describe the fees those markets publish, so that a seller can look up the same number in their own Seller Center.',
    'If you need an authoritative answer about your account, your rates or your obligations, ask TikTok directly. Seller Center is the only source that reflects your specific seller agreement.',
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    metaDescription:
      'This TikTok Shop fee calculator is an independent estimate tool. It is not affiliated with TikTok and its figures are not guaranteed.',
    summary:
      'What these numbers are, what they are not, and why you should confirm anything important in Seller Center.',
    updated: LAST_REVIEWED,
    sections: [
      {
        id: 'estimates-not-guarantees',
        heading: 'These are estimates, not guarantees',
        paragraphs: [
          'Every figure this tool produces is an estimate built from publicly documented rates. A calculator cannot know the fee that will actually be charged to your account, because that fee depends on things no public page records: your seller tier, your enrolled programs, your account history, your return rate, the specific sub-category of your product, and any promotion you personally qualify for.',
          'Treat the output as a planning aid for deciding whether a product is worth selling. Do not treat it as a quote, an invoice, or a statement of what you will be charged.',
        ],
      },
      {
        id: 'rates-change',
        heading: 'Rates change, and our data can lag',
        paragraphs: [
          'Platform fees are changed by TikTok without notice, and sometimes without a clear effective date. Our rate files carry a source date and a last-verified date for exactly this reason, and every fee page shows both.',
          'Some of our markets are only partially extracted. Where a full category table sits behind an Excel download or behind pagination, we say so on the page rather than filling the gap with a guess. A missing row means we do not know, not that the fee is zero.',
        ],
        bullets: [
          'Check the rate file date before relying on a number.',
          'Check the confidence badge on each row: some are verified against an official page, some are not.',
          'When our figure and Seller Center disagree, Seller Center is correct.',
        ],
      },
      {
        id: 'no-professional-advice',
        heading: 'Not professional advice',
        paragraphs: [
          'Nothing on this site is accounting, tax or legal advice. If you need to know what to declare, or whether a fee is deductible in your jurisdiction, talk to a qualified professional.',
          'We do not give tax advice and we do not know your tax position. Fee estimates are not tax calculations.',
        ],
      },
      {
        id: 'accuracy',
        heading: 'We try to be right, and we will tell you when we are unsure',
        paragraphs: [
          'Where a rate is not in our verified dataset, this site says so plainly instead of showing a number. That is deliberate: a confident wrong number is worse for a seller than an admitted gap.',
          'If you find an error, please report it. A correction that is verified against an official source will be fixed.',
        ],
      },
      SHARED_DISCLAIMER_SECTION,
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    metaDescription:
      'How this TikTok Shop fee calculator handles your data: no cookies, no accounts, no analytics, and the one category of server log data it does receive.',
    summary:
      'The short version: no cookies, no accounts, no analytics, and the only personal data we receive is the ordinary server log entry our host records for every request.',
    updated: LAST_REVIEWED,
    sections: [
      {
        id: 'contact-details',
        heading: 'Contact details',
        paragraphs: [
          `If you have any question about this notice, or want to exercise a data protection right, contact us at ${PRIVACY_CONTACT_EMAIL}. That address is read for privacy requests.`,
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'What information we collect, use and why',
        paragraphs: [
          'This site is a fee calculator. There is no account system, no login, no newsletter, no saved profile and no user-generated content, and we do not ask you to identify yourself anywhere.',
          'That covers everything you type into a calculator. A value you enter is sent to our server to compute one result and is not written to storage, so it is not personal data we hold on your behalf.',
          'There is one category of personal data we do receive, and it arrives before you do anything: when your browser requests a page, our hosting provider records a standard server log entry. That entry can include your IP address, the page requested, the time of the request and your browser\'s user-agent string.',
          'We use those logs only to keep the site available and to diagnose faults. We do not use them to build a profile of you, and we do not use them for marketing.',
          'We do not knowingly collect special category data. Please do not enter health, biometric or other sensitive details into any field on this site.',
        ],
        bullets: [
          'No cookies are set by this site.',
          'No analytics or tracking scripts run by default.',
          'No advertising or cross-site tracking pixels are served.',
          'No personal data is entered into any form on this site. The fee estimator asks for a price and a category, and both are used in a single calculation.',
          'We do not sell personal data, and we do not share it for anyone else\'s marketing.',
        ],
      },
      {
        id: 'lawful-bases',
        heading: 'Lawful bases',
        paragraphs: [
          'Under UK data protection law, and the equivalent rules in the EU and Singapore, we must have a lawful basis for collecting or using personal information. The lawful basis we rely on affects the rights available to you.',
          'We rely on legitimate interests for the server log data described above: the legitimate interest is operating and securing a publicly available website, and a limited request log is a necessary and proportionate way to do that. We do not rely on consent, because there is nothing you are being asked to agree to and nothing that can be switched off.',
          'Because we store no profile and no calculator input, we do not rely on contract, and we do not rely on legal obligation. We hold no special category data, so that basis does not apply.',
        ],
      },
      {
        id: 'data-protection-rights',
        heading: 'Your data protection rights',
        paragraphs: [
          'You have a set of rights over any personal data we hold about you. Some rights carry exemptions, which is why you may not receive everything you ask for. The Information Commissioner\'s Office publishes guidance on each of these.',
          'The rights that can apply to you are listed below. Given what we hold, the realistic limit on most of them is that we can only act on the server log entries, and those are held by our hosting provider rather than by us.',
        ],
        bullets: [
          'Right of access: ask us for copies of the personal information we hold about you, including where we got it from and who we share it with.',
          'Right to rectification: ask us to correct or delete personal information you think is inaccurate or incomplete.',
          'Right to erasure: ask us to delete personal information we hold about you.',
          'Right to restriction of processing: ask us to limit how we use your personal information.',
          'Right to object: object to the processing of your personal data, including where we rely on legitimate interests. Because our use of log data is necessary to run the site, we may not be able to comply, but we will explain why.',
          'Right to data portability: ask us to transfer personal information you gave us to another organisation, or to you, in a structured, machine-readable format.',
          'Right to withdraw consent: where we rely on consent, you can withdraw it at any time. We do not currently rely on consent for anything on this site.',
        ],
      },
      {
        id: 'responding-to-requests',
        heading: 'How to make a request',
        paragraphs: [
          `Send your request to ${PRIVACY_CONTACT_EMAIL}. We must respond without undue delay and in any event within one month.`,
          'There is no portal or account on this site, so a request is simply an email. Please say what you are asking for and include enough detail for us to find the relevant records, for example the date and the page you visited. We may ask you to confirm your identity before acting, so that we do not disclose anything to the wrong person.',
          'If a request is complex, or you have made several, we may take up to three months. We will tell you if that happens, and we will explain why.',
        ],
      },
      {
        id: 'where-data-comes-from',
        heading: 'Where we get personal information from',
        paragraphs: [
          'The only personal data we receive is the server log entry described above, and it comes from your browser\'s request to our hosting provider. We do not buy, rent, enrich or append data about you from any third party, and we do not receive your data from any third-party site you visit.',
        ],
      },
      {
        id: 'retention',
        heading: 'How long we keep information',
        paragraphs: [
          'We store no calculator input and no profile of you, so there is nothing to retain on that side.',
          'Server logs are retained for up to 90 days, after which they are automatically deleted. That retention period is configured on our hosting provider\'s account rather than in this site\'s code.',
        ],
      },
      {
        id: 'analytics-and-cookies',
        heading: 'Analytics and cookies',
        paragraphs: [
          'This site runs no analytics by default. If that ever changes, this page and a consent prompt will both be updated first, and no non-essential analytics will load before you opt in.',
          'Because the site also serves the United Kingdom, Singapore, Malaysia, the Philippines and the United States, it falls under UK and EU privacy rules. Loading advertising or analytics cookies without consent would breach those rules, which is why the default is off.',
        ],
      },
      {
        id: 'affiliate-links',
        heading: 'Affiliate links',
        paragraphs: [
          'Some pages may contain links to TikTok Shop or to third-party tools. Where a link earns us a commission we mark it as an affiliate or sponsored link before you click it, and following it does not change what you pay or what you are shown on our side.',
          'A third-party site you reach through one of our links has its own privacy policy. We have no control over it and we do not receive your data from it.',
        ],
      },
      {
        id: 'children',
        heading: 'Children',
        paragraphs: [
          'This tool is intended for adults running a business. It is not directed at children, and we knowingly collect no data from anyone, of any age.',
        ],
      },
      {
        id: 'how-to-complain',
        heading: 'How to complain',
        paragraphs: [
          `If you have concerns about how we use your personal information, raise them with us first at ${PRIVACY_CONTACT_EMAIL}. We would rather hear about a problem directly.`,
          'If you are not satisfied with our response, you can complain to the Information Commissioner\'s Office, the UK\'s data protection regulator.',
          'The ICO also accepts complaints about data handled in the UK by organisations outside it, which is relevant to the US, Pakistani, Singapore, Malaysian and Philippine parts of this site.',
        ],
        bullets: [
          'Information Commissioner\'s Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF',
          'Helpline: 0303 123 1113',
          'Online: ico.org.uk/make-a-complaint',
        ],
      },
      SHARED_DISCLAIMER_SECTION,
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    metaDescription:
      'The terms covering use of this independent TikTok Shop fee calculator, including the limits of what its estimates can be used for.',
    summary: 'The agreement for using this tool, and the limits on what that agreement covers.',
    updated: LAST_REVIEWED,
    sections: [
      {
        id: 'acceptance',
        heading: 'Acceptance',
        paragraphs: [
          `By using this website you agree to these terms. If you do not agree, do not use the site. These terms apply to Fynza, the trading name under which this site is operated from Pakistan, and using the site means you are at least 18 and legally able to enter a contract.`,
        ],
      },
      {
        id: 'permitted-use',
        heading: 'Acceptable use',
        paragraphs: ['You may use this site for your own commercial planning. You agree not to:'],
        bullets: [
          'Scrape, bulk-copy or republish the rate tables or page content at scale.',
          'Use automated systems to place load on the site beyond ordinary browsing.',
          'Present our figures as your own without noting that they are third-party estimates.',
          'Attempt to disrupt, probe or gain unauthorised access to the site.',
        ],
      },
      {
        id: 'estimates',
        heading: 'Estimates and accuracy',
        paragraphs: [
          'The calculator produces estimates from publicly documented rates. It is not a quote, an invoice or a representation of the fee that will be charged to your account.',
          'We may correct, change or remove any rate at any time, and we may change or discontinue the site. We do not warrant that the site will be available, uninterrupted, or free of error.',
        ],
      },
      {
        id: 'no-warranty',
        heading: 'No warranty',
        paragraphs: [
          'The site is provided "as is" and "as available", without warranties of any kind, whether express or implied, including any implied warranty of merchantability, fitness for a particular purpose or non-infringement.',
          'To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue or data, arising from your use of the site.',
          'Nothing in these terms excludes liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, or for fraud.',
        ],
      },
      {
        id: 'third-party-links',
        heading: 'Third-party links and affiliate links',
        paragraphs: [
          'The site links to official documentation and, where marked, to third-party tools. We do not control those sites and we are not responsible for their content, their availability or their practices.',
          'A link marked as an affiliate or sponsored link means we may earn a commission if you sign up. It does not change the price you pay, and we do not select a link on the basis of what we would be paid to recommend.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to these terms',
        paragraphs: [
          'We may update these terms. The date at the top of this page shows when they were last reviewed, and material changes will be reflected there. Continuing to use the site after a change means you accept it.',
        ],
      },
      {
        id: 'governing-law',
        heading: 'Governing law',
        paragraphs: [
          `These terms are governed by the laws of Pakistan, where this site is operated from. Any dispute will be subject to the exclusive jurisdiction of the courts of that place, without affecting any mandatory consumer protection you have under the law of where you live.`,
        ],
      },
      SHARED_DISCLAIMER_SECTION,
    ],
  },
];

export function documentForSlug(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}

export const LEGAL_SLUGS: LegalSlug[] = LEGAL_DOCUMENTS.map((doc) => doc.slug);

/**
 * Every value a real legal document needs and this repository does not have.
 *
 * Surfaced programmatically so the launch checklist and the test suite can
 * both read it. Shipping with these unfilled is a launch blocker, not a nit.
 *
 * The `docs` parameter exists so the detector can be tested against a document
 * that does carry a marker. Without it, emptying the real list and asserting it
 * is empty is a self-consistency check: reintroduce a marker and both sides of
 * that comparison go to one, so the suite would stay green while a placeholder
 * shipped. Passing a synthetic document makes the guard a real one.
 */
export function legalOpenItems(
  docs: LegalDocument[] = LEGAL_DOCUMENTS
): { document: LegalSlug; marker: string }[] {
  return docs.flatMap((doc) =>
    doc.sections
      .filter((section) => section.paragraphs.some((p) => p.includes(OPEN)))
      .map((section) => ({ document: doc.slug, marker: section.id }))
  );
}
