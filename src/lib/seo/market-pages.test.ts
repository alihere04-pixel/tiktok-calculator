import { describe, it, expect } from 'vitest';
import { loadMarketRatesSync } from '@/lib/rates/loader';
import {
  SEO_MARKETS,
  SEO_SLUGS,
  buildDescription,
  buildFaqJsonLd,
  buildMarketPageModel,
  buildWebPageJsonLd,
  metaForSlug,
} from './market-pages';
import { describeFeeRate } from './format';

function modelFor(slug: string) {
  const meta = metaForSlug(slug);
  if (!meta) throw new Error(`unknown slug ${slug}`);
  return buildMarketPageModel(loadMarketRatesSync(meta.market), meta);
}

const ALL = SEO_SLUGS.map((slug) => modelFor(slug));

describe('SEO_MARKETS', () => {
  it('defines exactly the five supported markets', () => {
    expect(SEO_SLUGS).toEqual(['us', 'uk', 'my', 'sg', 'ph']);
  });

  it('gives every market a unique slug, H1 and title', () => {
    expect(new Set(SEO_MARKETS.map((m) => m.slug)).size).toBe(5);
    expect(new Set(SEO_MARKETS.map((m) => m.h1)).size).toBe(5);
    expect(new Set(SEO_MARKETS.map((m) => m.title)).size).toBe(5);
  });

  it('matches the H1 format the PRD asks for', () => {
    for (const meta of SEO_MARKETS) {
      expect(meta.h1).toMatch(/TikTok Shop Seller Fees \(2026\)$/);
    }
  });

  it('resolves a slug to its market and rejects an unknown one', () => {
    expect(metaForSlug('us')?.market).toBe('US');
    expect(metaForSlug('de')).toBeUndefined();
  });
});

describe('every market page', () => {
  it('always carries all eight sections, in a resolved state', () => {
    for (const model of ALL) {
      const sections = [
        model.categoryRates,
        model.transactionFees,
        model.fixedFees,
        model.exceptions,
        model.refundAdminFee,
        model.newSellerPromo,
        model.affiliate,
        model.faq,
      ];

      for (const section of sections) {
        expect(section).toBeDefined();
      }

      // A section is either real data or an explicit unverified marker. There is
      // no third state, so a section can never silently vanish.
      for (const section of [model.transactionFees, model.fixedFees, model.refundAdminFee, model.newSellerPromo, model.affiliate]) {
        if (section.status === 'unverified') {
          expect(section.reason.length).toBeGreaterThan(0);
        } else {
          expect(section.data).toBeDefined();
        }
      }
    }
  });

  it('reports a rate range that never contradicts the categories it lists', () => {
    for (const model of ALL) {
      const promo = model.categoryRates.filter((row) => row.rateLabel === '0%');
      const nonPromo = model.categoryRates.filter((row) => row.rateLabel !== '0%');
      const pool = nonPromo.length > 0 ? nonPromo : model.categoryRates;

      const rates = pool.map((row) => Number(row.rateLabel.replace('%', '')));
      const min = Math.min(...rates);
      const max = Math.max(...rates);

      expect(model.rateRangeNote).toContain(`${min}%`);
      expect(model.rateRangeNote).toContain(`${max}%`);

      // A promotional zero rate must not drag the headline range down to 0%.
      if (promo.length > 0) {
        expect(model.rateRangeNote).toContain('excludes the promotional rate');
      }
    }
  });

  it('never shows a category rate that is not in the rate file', () => {
    for (const model of ALL) {
      const data = loadMarketRatesSync(model.meta.market);
      const byId = new Map(data.categories.map((c) => [c.id, c]));

      for (const row of model.categoryRates) {
        const source = byId.get(row.id);
        expect(source).toBeDefined();
        expect(row.rateLabel).toBe(`${Number((source!.rate * 100).toFixed(4))}%`);
      }
    }
  });

  it('quotes the market currency and the real last-verified date', () => {
    for (const model of ALL) {
      const data = loadMarketRatesSync(model.meta.market);
      expect(model.currency).toBe(data.currency);
      expect(model.lastVerified).toBe(data.lastVerified);
      expect(model.sourceUrl).toBe(data.sourceUrl);
    }
  });

  it('builds a meta description within a sane length', () => {
    for (const model of ALL) {
      const description = buildDescription(model);
      expect(description.length).toBeLessThanOrEqual(165);
      expect(description).toContain(model.meta.marketName);
    }
  });

  it('produces FAQ JSON-LD that matches the rendered FAQ exactly', () => {
    for (const model of ALL) {
      const jsonLd = buildFaqJsonLd(model);
      expect(jsonLd['@type']).toBe('FAQPage');
      expect(jsonLd.mainEntity).toHaveLength(model.faq.length);
      expect(jsonLd.mainEntity[0].name).toBe(model.faq[0].question);
      expect(jsonLd.mainEntity[0].acceptedAnswer.text).toBe(model.faq[0].answer);
    }
  });

  it('produces WebPage JSON-LD with a canonical path that matches the slug', () => {
    for (const model of ALL) {
      const jsonLd = buildWebPageJsonLd(model);
      expect(jsonLd['@type']).toBe('WebPage');
      expect(jsonLd.breadcrumb.itemListElement[1].item).toBe(
        `/${model.meta.slug}/tiktok-shop-fees`
      );
    }
  });
});

describe('category exceptions', () => {
  it('flags the US $10K tiered threshold, using the description from the data', () => {
    const us = modelFor('us');
    expect(us.exceptions).toHaveLength(16);
    expect(us.exceptions[0].detail).toBe('Any portion of the sale over $10K, 3%');
  });

  it('flags UK categories that differ from its published 9% default', () => {
    const uk = modelFor('uk');
    const electronics = uk.exceptions.find((e) => e.category === 'Electronics');
    expect(electronics?.detail).toBe('5% instead of the 9% standard rate.');
  });

  it('flags the UK new seller promotion as a zero-rate exception', () => {
    const uk = modelFor('uk');
    expect(
      uk.exceptions.some((e) => /Promotional rate of 0%/.test(e.detail))
    ).toBe(true);
  });

  it('does not turn a separate Mall rate into an exception, because the table already shows it', () => {
    // PH stores a Mall rate on all 63 categories. Listing them as exceptions
    // produced 54 cards that restated the table.
    const ph = modelFor('ph');
    expect(ph.exceptions).toHaveLength(0);
    expect(ph.categoryRates.filter((r) => r.secondaryRateLabel?.startsWith('Mall ')).length).toBe(63);
  });

  it('reports no exceptions for markets that record none, without inventing any', () => {
    expect(modelFor('sg').exceptions).toHaveLength(0);
    expect(modelFor('my').exceptions).toHaveLength(0);
  });
});

describe('fee sections', () => {
  it('shows SG and MY a real transaction fee', () => {
    for (const slug of ['sg', 'my']) {
      const model = modelFor(slug);
      expect(model.transactionFees.status).toBe('available');
      if (model.transactionFees.status === 'available') {
        expect(describeFeeRate(model.transactionFees.data[0].value)).toMatch(/%$/);
      }
    }
  });

  it('discloses the transaction fee for markets that do not publish one', () => {
    for (const slug of ['us', 'uk', 'ph']) {
      expect(modelFor(slug).transactionFees.status).toBe('unverified');
    }
  });

  it('renders MY support fee as an amount, not as a percentage', () => {
    const my = modelFor('my');
    expect(my.fixedFees.status).toBe('available');
    if (my.fixedFees.status !== 'available') return;

    const support = my.fixedFees.data.lines.find((l) => /support fee/i.test(l.label));
    expect(support).toBeDefined();
    expect(describeFeeRate(support!.value)).toBe('RM 0.54 per order');
  });

  it('surfaces MY dynamic commission as its published range plus the per-item cap', () => {
    const my = modelFor('my');
    if (my.fixedFees.status !== 'available') throw new Error('expected available');

    const dynamic = my.fixedFees.data.lines.find((l) => /dynamic/i.test(l.label));
    expect(describeFeeRate(dynamic!.value)).toBe('4.00% - 6.00%');
    expect(dynamic!.details?.join(' ')).toContain('RM 650,000.00 per item');
  });

  it('keeps the BXP acronym uppercase in fee labels', () => {
    const sg = modelFor('sg');
    if (sg.fixedFees.status !== 'available') throw new Error('expected available');
    expect(sg.fixedFees.data.lines.map((l) => l.label)).toContain('BXP Service Fee');
  });

  it('discloses fixed fees for markets that publish none', () => {
    for (const slug of ['us', 'uk', 'ph']) {
      expect(modelFor(slug).fixedFees.status).toBe('unverified');
    }
  });
});

describe('refund administration fee', () => {
  it('is disclosed, not invented, on the US page', () => {
    const us = modelFor('us');
    expect(us.refundAdminFee.status).toBe('unverified');
    if (us.refundAdminFee.status !== 'unverified') return;
    expect(us.refundAdminFee.reason).toMatch(/not in our verified dataset/i);
  });
});

describe('new seller promotion', () => {
  it('shows the real 0% UK promo', () => {
    const uk = modelFor('uk');
    expect(uk.newSellerPromo.status).toBe('available');
    if (uk.newSellerPromo.status !== 'available') return;
    expect(uk.newSellerPromo.data.rateLabel).toBe('0%');
    // The only promo in the data is medium confidence, so the page must not
    // present it as verified.
    expect(uk.newSellerPromo.data.confidence).toBe('medium');
  });

  it('is disclosed for the four markets with no promo in the data', () => {
    for (const slug of ['us', 'my', 'sg', 'ph']) {
      expect(modelFor(slug).newSellerPromo.status).toBe('unverified');
    }
  });
});

describe('affiliate commission', () => {
  it('is unverified for all five markets, because no rate file populates it', () => {
    for (const model of ALL) {
      expect(model.affiliate.status).toBe('unverified');
    }
  });

  it('quotes no numeric range, since none is in the data', () => {
    for (const model of ALL) {
      if (model.affiliate.status !== 'unverified') continue;
      // A percentage in the disclosure copy would be an invented rate.
      expect(model.affiliate.reason).not.toMatch(/\d/);
    }
  });
});
