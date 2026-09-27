import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SourceAttributionPanel } from './SourceAttributionPanel';
import { makeFee } from '@/test/snapshot-fixture';

afterEach(cleanup);

const FEES = [
  makeFee({ name: 'High confidence fee', confidence: 'high' }),
  makeFee({ name: 'Medium confidence fee', confidence: 'medium' }),
  makeFee({ name: 'Low confidence fee', confidence: 'low' }),
  makeFee({ name: 'Unverified fee', confidence: 'needs-verification' }),
];

describe('SourceAttributionPanel', () => {
  it('lists the PRD attribution fields for each fee', () => {
    const { container } = render(<SourceAttributionPanel fees={FEES} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Rate');
    expect(text).toContain('Effective from');
    expect(text).toContain('Last verified');
    expect(text).toContain('Source');
  });

  it('sorts the least trustworthy sources to the top', () => {
    const { container } = render(<SourceAttributionPanel fees={FEES} />);
    const order = Array.from(container.querySelectorAll('li p.font-medium')).map(
      (node) => node.textContent
    );
    expect(order).toEqual([
      'Unverified fee',
      'Low confidence fee',
      'Medium confidence fee',
      'High confidence fee',
    ]);
  });

  it('counts the fees that need verification', () => {
    render(<SourceAttributionPanel fees={FEES} />);
    expect(screen.getByText(/2 of them need verification/)).toBeDefined();
  });

  it('drops the warning when every source is verified', () => {
    render(<SourceAttributionPanel fees={[makeFee({ confidence: 'high' })]} />);
    expect(screen.queryByText(/need verification/)).toBeNull();
    expect(screen.getByText(/All sources are verified/)).toBeDefined();
  });

  it('shows a confidence badge per fee', () => {
    render(<SourceAttributionPanel fees={FEES} />);
    expect(screen.getByText('Needs verification')).toBeDefined();
    expect(screen.getByText('Low confidence')).toBeDefined();
    expect(screen.getByText('Medium confidence')).toBeDefined();
    expect(screen.getByText('High confidence')).toBeDefined();
  });

  it('links to the official page and names the fee for screen readers', () => {
    render(<SourceAttributionPanel fees={[makeFee({ name: 'Referral Fee' })]} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toContain('seller-us.tiktok.com');
    expect(link.textContent).toContain('seller-us.tiktok.com');
    expect(link.textContent).toContain('official source for Referral Fee');
  });

  it('renders nothing when there are no fees', () => {
    const { container } = render(<SourceAttributionPanel fees={[]} />);
    expect(container.textContent).toBe('');
  });
});
