import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ResultsPanel } from './ResultsPanel';
import { runCalculation } from '@/app/actions';
import { makeInputs, makeSnapshot } from '@/test/snapshot-fixture';

vi.mock('@/app/actions', () => ({ runCalculation: vi.fn() }));

const mockRun = vi.mocked(runCalculation);

const INPUTS = makeInputs({ sellingPrice: 100, cogs: 30, outboundShipping: 5, cpa: 10 });
const SNAPSHOT = makeSnapshot({ totalPlatformFees: 6, netProfit: 49, breakEvenPrice: 41 });

function renderPanel(props: { isStale?: boolean; snapshot?: ReturnType<typeof makeSnapshot> } = {}) {
  return render(
    <ResultsPanel
      inputs={INPUTS}
      initialSnapshot={props.snapshot ?? SNAPSHOT}
      isStale={props.isStale ?? false}
    />
  );
}

beforeEach(() => {
  mockRun.mockReset();
});

afterEach(cleanup);

describe('ResultsPanel', () => {
  it('renders all six PRD result areas', () => {
    renderPanel();
    expect(screen.getByText('Your result')).toBeDefined();
    expect(screen.getByText('Profit waterfall')).toBeDefined();
    expect(screen.getByText('Fee breakdown')).toBeDefined();
    expect(screen.getByText('Reverse calculator')).toBeDefined();
    expect(screen.getByText('Monthly projection')).toBeDefined();
    expect(screen.getByText('Source attribution')).toBeDefined();
  });

  it('does not call the server on mount - the snapshot already covers the defaults', () => {
    renderPanel();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('re-runs the calculation when the target profit changes', async () => {
    const updated = makeSnapshot({
      totalPlatformFees: 6,
      netProfit: 49,
      reverse: {
        targetProfitInput: 20,
        targetProfitPrice: 80,
        targetProfitAchievable: true,
        targetROAS: 4,
        maxCPA: 25,
      },
    });
    mockRun.mockResolvedValue({ ok: true, snapshot: updated });

    renderPanel();
    fireEvent.change(screen.getByLabelText('Target profit price'), { target: { value: '20' } });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun).toHaveBeenCalledWith({
      inputs: INPUTS,
      targetProfit: 20,
      targetROAS: 4,
      monthlyUnits: 500,
    });

    await waitFor(() => expect(screen.getByText('$80.00')).toBeDefined());
  });

  it('debounces so typing does not fire one request per keystroke', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    renderPanel();

    const field = screen.getByLabelText('Target profit price');
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.change(field, { target: { value: '10' } });
    fireEvent.change(field, { target: { value: '100' } });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ targetProfit: 100 }));
  });

  it('re-runs when the monthly units change', async () => {
    mockRun.mockResolvedValue({
      ok: true,
      snapshot: makeSnapshot({
        projection: { monthlyUnits: 1000, units: 1000, gmv: 100_000, totalFees: 6_000, totalProfit: 49_000, avgProfitPerUnit: 49 },
      }),
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText('Monthly units'), { target: { value: '1000' } });

    await waitFor(() => expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ monthlyUnits: 1000 })));
    await waitFor(() => expect(screen.getByText('$100,000.00')).toBeDefined());
  });

  it('keeps the last good numbers and warns when a refresh fails', async () => {
    mockRun.mockResolvedValue({ ok: false, errors: ['sellingPrice must be greater than 0'] });

    renderPanel();
    fireEvent.change(screen.getByLabelText('Max CPA'), { target: { value: '3' } });

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain('sellingPrice must be greater than 0');
    expect(alert.textContent).toContain('last successful calculation');
    // The original figure is still on screen rather than blanked out.
    expect(screen.getByText('$49.00')).toBeDefined();
  });

  it('survives a network failure during refresh', async () => {
    mockRun.mockRejectedValue(new Error('offline'));

    renderPanel();
    fireEvent.change(screen.getByLabelText('Max CPA'), { target: { value: '3' } });

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain('Could not reach the calculation service');
  });

  it('warns that the result is out of date when the form inputs changed', () => {
    renderPanel({ isStale: true });
    expect(screen.getByText(/these figures are out of date/)).toBeDefined();
  });

  it('shows no staleness warning when the inputs still match', () => {
    renderPanel({ isStale: false });
    expect(screen.queryByText(/out of date/)).toBeNull();
  });

  it('always calculates against the inputs that produced the snapshot, not live ones', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });

    // A different `inputs` object identity must not leak into a refresh: the
    // panel froze the calculation inputs on mount for exactly this reason.
    const { rerender } = render(
      <ResultsPanel
        inputs={INPUTS}
        initialSnapshot={SNAPSHOT}
        isStale={false}
      />
    );
    rerender(
      <ResultsPanel
        inputs={makeInputs({ sellingPrice: 999, cogs: 1 })}
        initialSnapshot={SNAPSHOT}
        isStale
      />
    );

    fireEvent.change(screen.getByLabelText('Max CPA'), { target: { value: '6' } });
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ inputs: INPUTS }));
  });

  it('announces itself politely to assistive technology', () => {
    const { container } = renderPanel();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows the rate version it was calculated from', () => {
    renderPanel();
    expect(screen.getByText(/US-2026-09-26/)).toBeDefined();
  });
});
