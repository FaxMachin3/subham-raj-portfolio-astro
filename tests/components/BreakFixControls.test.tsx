// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import BreakFixControls from '@/components/islands/BreakFixControls';
import { $ready, $statuses, $targets } from '@/stores/fixes';
import { FIX_IDS, type FixId, type FixStatus } from '@/fixes/types';

let stopCards = () => {};

/** Stands in for the six cards: each answers its target with `outcome(id)` (or never, for "hang"). */
function cards(outcome: (id: FixId, target: 'broken' | 'fixed') => FixStatus | 'hang') {
  stopCards = $targets.listen((targets) => {
    for (const id of FIX_IDS) {
      const request = targets[id];
      if (!request) continue;
      const result = outcome(id, request.target);
      if (result !== 'hang') queueMicrotask(() => $statuses.setKey(id, result));
    }
  });
}

beforeEach(() => {
  FIX_IDS.forEach((id) => {
    $ready.setKey(id, true);
    $statuses.setKey(id, 'healthy');
    $targets.setKey(id, null);
  });
});

afterEach(() => {
  stopCards();
  cleanup();
  vi.useRealTimers();
});

const breakButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /Break this site|Breaking/ });
const fixButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /Let Subham fix it|Fixing/ });

describe('BreakFixControls', () => {
  it('says the demos are loading until every one is ready', async () => {
    $ready.setKey('plot', false);
    render(<BreakFixControls />);
    await waitFor(() => expect(screen.getByTestId('controls-next').textContent).toBe('Loading the demos…'));
    expect(breakButton().disabled).toBe(true);
  });

  it('points to the damage after a successful break, and to the results after a merged fix', async () => {
    vi.useFakeTimers();
    cards((_, target) => target);
    render(<BreakFixControls />);
    await act(async () => vi.advanceTimersByTimeAsync(10));
    act(() => breakButton().click());
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole('link', { name: 'See what broke ↓' }).getAttribute('href')).toBe('#fixes');
    act(() => fixButton().click());
    await act(async () => vi.advanceTimersByTimeAsync(12_000));
    expect(screen.getByRole('link', { name: 'See your results ↓' }).getAttribute('href')).toBe('#results');
  });

  it('ends a break run when a demo fails, says which one, and gives the controls back', async () => {
    cards((id, target) => (id === 'i18n' ? 'failed' : target));
    render(<BreakFixControls />);
    await waitFor(() => expect(breakButton().disabled).toBe(false));
    act(() => breakButton().click());
    await waitFor(
      () => expect(screen.getByRole('status').textContent).toContain('Some demos didn’t break.'),
      {
        timeout: 5000,
      },
    );
    expect(screen.getByRole('status').textContent).toContain('Translations');
    expect(breakButton().disabled).toBe(false);
    expect(fixButton().disabled).toBe(false);
    await waitFor(() => expect(document.documentElement.dataset.site).toBe('broken'));
  });

  it('stops a fix run at the failed commit and offers a retry', async () => {
    FIX_IDS.forEach((id) => $statuses.setKey(id, 'broken'));
    cards((id, target) => (id === 'jank' ? 'failed' : target));
    render(<BreakFixControls />);
    await waitFor(() => expect(fixButton().disabled).toBe(false));
    act(() => fixButton().click());
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('A fix didn’t complete.'), {
      timeout: 10_000,
    });
    expect(screen.getByRole('status').textContent).toContain('Sidebar animation');
    expect(screen.getByRole('status').textContent).toContain('Let Subham fix it');
    expect(fixButton().disabled).toBe(false);
    // Fixes after the failed one were never requested.
    expect($statuses.get().plot).toBe('broken');
  }, 15_000);

  // Leaving at each await point of a run: during the stagger, the pause before the plot, while waiting for
  // the cards, and between commits. Each time the run stops and the controls come back.
  for (const [label, advance] of [
    ['during the stagger', 100],
    ['in the pause before the plot', 260 * 5 + 100],
    ['while waiting for the cards', 260 * 5 + 400 + 50],
  ] as const) {
    it(`stops a break run when the visitor leaves ${label}`, async () => {
      vi.useFakeTimers();
      cards(() => 'hang');
      render(<BreakFixControls />);
      await act(async () => vi.advanceTimersByTimeAsync(10));
      act(() => breakButton().click());
      await act(async () => vi.advanceTimersByTimeAsync(advance));
      act(() => {
        dispatchEvent(new Event('pagehide'));
      });
      await act(async () => vi.advanceTimersByTimeAsync(2000));
      expect(breakButton().disabled).toBe(false);
      expect(screen.getByRole('status').textContent).not.toContain('Site broken');
    });
  }

  it('stops a fix run when the visitor leaves between commits', async () => {
    vi.useFakeTimers();
    FIX_IDS.forEach((id) => $statuses.setKey(id, 'broken'));
    cards((_, target) => target);
    render(<BreakFixControls />);
    await act(async () => vi.advanceTimersByTimeAsync(10));
    act(() => fixButton().click());
    await act(async () => vi.advanceTimersByTimeAsync(100)); // commit 1 done, now in the pause
    act(() => {
      dispatchEvent(new Event('pagehide'));
    });
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect($statuses.get().i18n).toBe('broken'); // commit 2 was never requested
    expect(screen.getByRole('status').textContent).not.toContain('merged');
  });

  it('cancels a run in progress when the visitor leaves the page', async () => {
    FIX_IDS.forEach((id) => $statuses.setKey(id, 'broken'));
    cards(() => 'hang');
    render(<BreakFixControls />);
    await waitFor(() => expect(fixButton().disabled).toBe(false));
    act(() => fixButton().click());
    await waitFor(() => expect($statuses.get().a11y).toBe('fixing'));
    act(() => {
      dispatchEvent(new Event('pagehide'));
    });
    expect($statuses.get().a11y).toBe('cancelled');
    expect($targets.get().a11y).toBeNull();
    await waitFor(() => expect(fixButton().disabled).toBe(false));
  });
});
