import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// mock localStorage for every test
beforeEach(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  }
});

describe('Consent banner', () => {
  it('appears when no consent is stored', () => {
    ;(window.localStorage.getItem as any).mockReturnValue(null);
    render(<> <ConsentBanner /> </>);
    expect(screen.getByText('Accept analytics')).toBeInTheDocument();
  });

  it('accept stores consent and hides the banner', () => {
    ;(window.localStorage.getItem as any).mockReturnValue(null);
    render(<> <ConsentBanner /> </>);
    fireEvent.click(screen.getByText('Accept analytics'));
    expect(window.localStorage.getItem('analytics_consent')).toBe('accepted');
    // banner should no longer be in the document
    expect(screen.queryByText('Accept analytics')).toBeNull();
  });

  it('decline stores opt‑out and hides the banner', () => {
    ;(window.localStorage.getItem as any).mockReturnValue(null);
    render(<> <ConsentBanner /> </>);
    fireEvent.click(screen.getByText('Decline'));
    expect(window.localStorage.getItem('analytics_consent')).toBe('declined');
    expect(screen.queryByText('Accept analytics')).toBeNull();
  });

  it('does not re‑appear after a saved choice', () => {
    // first acceptance
    ;(window.localStorage.getItem as any).mockReturnValue(null);
    render(<> <ConsentBanner /> </>);
    fireEvent.click(screen.getByText('Accept analytics'));
    // second render – banner must be gone
    render(<> <ConsentBanner /> </>);
    expect(screen.queryByText('Accept analytics')).toBeNull();
  });
});