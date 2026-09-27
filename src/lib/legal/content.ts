/**
 * Content for the three legal pages.
 *
 * Two rules govern this file, both of which matter more than the prose:
 *
 *   1. Nothing here asserts a legal fact I cannot support. There is no operator
 *      name, company number, address or jurisdiction in this repository, so
 *      none is invented. Where the real document needs one, the value is a
 *      clearly-marked `OPEN_ITEM` and `legalOpenItems()` exposes it, so it
 *      shows up in the launch checklist and in the test suite rather than
 *      shipping as a plausible-looking blank.
 *
 *   2. The pages describe what this tool actually does. It reads public
 *      rate documentation, estimates fees, and stores nothing about the
 *      visitor. The privacy page is written against that real behaviour, not
 *      against a generic template, because a template that claims to collect
 *      data we do not collect is its own kind of lie.
 *
 * These are drafts written by a developer, not by a lawyer. `legalOpenItems()`
 * says so explicitly, and the launch checklist blocks on legal review.
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

export const LAST_REVIEWED = '2026-09-27';

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
      'This fee calculator does not use cookies, does not run analytics, and does not store anything about you. Here is exactly what happens to a request.',
    summary:
      'The short version: we set no cookies, run no analytics, and store nothing about you.',
    updated: LAST_REVIEWED,
    sections: [
      {
        id: 'what-we-collect',
        heading: 'What we collect',
        paragraphs: [
          'We collect nothing about you. There is no account system, no login, no newsletter, no saved profile and no user-generated content on this site.',
        ],
        bullets: [
          'No cookies are set by this site.',
          'No analytics or tracking scripts run by default.',
          'No personal data is entered into any form on this site. The fee estimator asks for a price and a category, and both are used in a single calculation.',
        ],
      },
      {
        id: 'what-happens-to-your-input',
        heading: 'What happens to what you type',
        paragraphs: [
          'The fee estimator and the main calculator compute results on the server. A value you enter is sent to our server for that one calculation and is not written to storage.',
          'Do not enter anything confidential into these fields. They are number inputs for a calculator, not a secure form, and they are not encrypted at rest because they are never saved.',
        ],
      },
      {
        id: 'server-logs',
        heading: 'Server logs',
        paragraphs: [
          'Like any website host, our hosting provider records standard request logs, which can include your IP address, the page requested and the timestamp. These are used to keep the site running and to diagnose faults.',
          'These logs are not combined with any profile of you, and they are not used for marketing.',
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
        id: 'contact',
        heading: 'Contact',
        paragraphs: [
          `If you have a privacy question, or want something deleted, contact us at ${OPEN}: a monitored address for privacy requests.`,
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
          `By using this website you agree to these terms. If you do not agree, do not use the site. These terms apply to ${OPEN}: the legal entity that operates this site, and using the site means you are at least 18 and legally able to enter a contract.`,
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
          `These terms are governed by the laws of ${OPEN}: the jurisdiction in which the operating entity is established. Any dispute will be subject to the exclusive jurisdiction of the courts of that place, without affecting any mandatory consumer protection you have under the law of where you live.`,
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
 */
export function legalOpenItems(): { document: LegalSlug; marker: string }[] {
  return LEGAL_DOCUMENTS.flatMap((doc) =>
    doc.sections
      .filter((section) => section.paragraphs.some((p) => p.includes(OPEN)))
      .map((section) => ({ document: doc.slug, marker: section.id }))
  );
}
