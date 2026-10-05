// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import HealthBar from '@/components/islands/HealthBar';
import { addJsBytes, startSession } from '@/stores/fixes';
import { clearRequestLog, recordRequest } from '@/lab/requests';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearRequestLog();
});

/** A PerformanceObserver that reports the given entry types and lets the test push entries. */
function stubObservers(types: string[]) {
  const live = new Set<(list: { getEntries(): unknown[] }) => void>();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = types;
      constructor(private cb: (list: { getEntries(): unknown[] }) => void) {
        live.add(cb);
      }
      observe() {}
      disconnect() {
        live.delete(this.cb);
        disconnect();
      }
    },
  );
  return {
    push: (entries: unknown[]) => live.forEach((cb) => cb({ getEntries: () => entries })),
    disconnect,
  };
}

const cell = (label: RegExp) => screen.getByText(label, { selector: '.hud__long' }).closest('.hud__cell')!;

describe('HealthBar', () => {
  it('shows live long tasks, layout shift, demo JS and request rate, with levels', () => {
    vi.useFakeTimers();
    const observers = stubObservers(['longtask', 'layout-shift']);
    const { unmount } = render(<HealthBar />);
    act(() => startSession());
    act(() => {
      observers.push([{ duration: 120, value: 0.2, hadRecentInput: false }]);
      addJsBytes(400 * 1024);
      for (let i = 0; i < 3; i++) recordRequest();
      vi.advanceTimersByTime(600);
    });
    expect(cell(/Long tasks/).querySelector('strong')!.textContent).toBe('1');
    expect(cell(/Long tasks/).getAttribute('data-level')).toBe('bad');
    expect(cell(/Layout shift/).getAttribute('data-level')).toBe('bad');
    expect(cell(/Demo JS/).getAttribute('data-level')).toBe('bad');
    expect(cell(/Req\/min/).querySelector('strong')!.textContent).toBe('36');
    unmount();
    expect(observers.disconnect).toHaveBeenCalled();
  });

  it('starts a new session at zero', () => {
    const observers = stubObservers(['longtask', 'layout-shift']);
    render(<HealthBar />);
    act(() => observers.push([{ duration: 80, value: 0.01, hadRecentInput: false }]));
    act(() => startSession());
    expect(cell(/Long tasks/).querySelector('strong')!.textContent).toBe('0');
  });

  it('says n/a where the browser cannot measure long tasks or layout shift', () => {
    stubObservers([]);
    render(<HealthBar />);
    expect(cell(/Long tasks/).querySelector('strong')!.textContent).toBe('n/a');
    expect(cell(/Layout shift/).getAttribute('data-level')).toBe('na');
  });
});
