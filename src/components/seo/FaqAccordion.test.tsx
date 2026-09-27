import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FaqAccordion } from './FaqAccordion';
import type { FaqItem } from '@/lib/seo/market-pages';

afterEach(cleanup);

const ITEMS: FaqItem[] = [
  { question: 'What commission rate is charged?', answer: 'Between 5% and 6%.' },
  { question: 'Are rates tax inclusive?', answer: 'Each row says so.' },
];

describe('FaqAccordion', () => {
  it('renders every question and answer into the HTML', () => {
    // Answers stay in the DOM so they are indexable and readable without JS.
    const { container } = render(<FaqAccordion items={ITEMS} />);
    for (const item of ITEMS) {
      expect(container.textContent).toContain(item.question);
      expect(container.textContent).toContain(item.answer);
    }
  });

  it('uses native details and summary rather than JS state', () => {
    const { container } = render(<FaqAccordion items={ITEMS} />);
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(2);
    expect(container.querySelectorAll('details > summary')).toHaveLength(2);
  });

  it('hides the decorative plus from assistive technology', () => {
    const { container } = render(<FaqAccordion items={ITEMS} />);
    const marks = container.querySelectorAll('[aria-hidden="true"]');
    expect(marks).toHaveLength(2);
  });

  it('lets a reader open more than one answer, for comparing', () => {
    // A single-open accordion would close the answer being read.
    const { container } = render(<FaqAccordion items={ITEMS} />);
    expect(container.querySelectorAll('details[name]')).toHaveLength(0);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<FaqAccordion items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
