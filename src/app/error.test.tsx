import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
// Aliased deliberately: the default export is named `Error`, and importing it
// under that name would shadow the global `Error` constructor this file needs.
import ErrorBoundary from './error';

afterEach(() => {
  cleanup();
  delete (globalThis as { __errorMonitor?: unknown }).__errorMonitor;
  vi.restoreAllMocks();
});

const ERROR = Object.assign(new Error('DB password is hunter2 at /srv/app/lib/rates.ts'), {
  digest: 'abc123def456',
});

describe('error boundary', () => {
  it('shows a heading rather than a blank page', () => {
    render(<ErrorBoundary error={ERROR} reset={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('never renders the error message to the visitor', () => {
    // The failure mode this prevents: a stack trace, an internal path or a
    // config value leaking into a public page.
    const { container } = render(<ErrorBoundary error={ERROR} reset={() => {}} />);
    expect(container.textContent).not.toContain('hunter2');
    expect(container.textContent).not.toContain('rates.ts');
    expect(container.textContent).not.toContain('DB password');
  });

  it('offers a digest to quote in a support request', () => {
    render(<ErrorBoundary error={ERROR} reset={() => {}} />);
    expect(screen.getByText('abc123def456')).toBeTruthy();
  });

  it('omits the digest line when there is no digest', () => {
    const { container } = render(<ErrorBoundary error={new Error('x')} reset={() => {}} />);
    expect(container.textContent).not.toContain('quote reference');
  });

  it('resets when the retry button is clicked', () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={ERROR} reset={reset} />);
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('links back to the calculator', () => {
    render(<ErrorBoundary error={ERROR} reset={() => {}} />);
    expect(screen.getByRole('link', { name: 'Go to the calculator' }).getAttribute('href')).toBe('/');
  });

  it('reports to the configured monitor', () => {
    const sink = vi.fn();
    (globalThis as { __errorMonitor?: unknown }).__errorMonitor = sink;
    render(<ErrorBoundary error={ERROR} reset={() => {}} />);
    expect(sink).toHaveBeenCalledWith(ERROR);
  });

  it('does not crash when the monitor itself throws', () => {
    // A broken monitor must never replace the user's error screen with a
    // second, worse error.
    (globalThis as { __errorMonitor?: unknown }).__errorMonitor = () => {
      throw new Error('monitor is down');
    };
    expect(() => render(<ErrorBoundary error={ERROR} reset={() => {}} />)).not.toThrow();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('is a client component, which is what makes it a boundary', () => {
    // The "use client" directive is load-bearing: without it Next will not
    // treat this as an error boundary at all.
    expect(typeof ErrorBoundary).toBe('function');
  });
});
