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

/** Drives requestAnimationFrame by hand: each call to `frames` delivers timestamps `step` ms apart. */
function stubFrames() {
  let pending: FrameRequestCallback[] = [];
  let now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => pending.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => (pending = []));
  return (count: number, step: number) =>
    act(() => {
      for (let i = 0; i < count; i++) {
        const run = pending;
        pending = [];
        now += step;
        run.forEach((cb) => cb(now));
      }
    });
}

const fpsValue = () => cell(/FPS/).querySelector('strong')!.textContent;

describe('HealthBar', () => {
  it('shows no FPS until a real sample exists, then the uncapped rate (120 Hz reads 120)', () => {
    stubObservers([]);
    const frames = stubFrames();
    render(<HealthBar />);
    expect(fpsValue()).toBe('–');
    expect(cell(/FPS/).getAttribute('data-level')).toBe('na');
    frames(80, 1000 / 120);
    expect(fpsValue()).toBe('120');
  });

  it('stops sampling while the tab is hidden and restarts cleanly when it returns', () => {
    stubObservers([]);
    const frames = stubFrames();
    render(<HealthBar />);
    frames(40, 1000 / 60);
    expect(fpsValue()).toBe('60');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(fpsValue()).toBe('–');
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    frames(40, 1000 / 60);
    expect(fpsValue()).toBe('60');
  });

  it('collapses so it covers nothing, and remembers the choice', () => {
    stubObservers([]);
    render(<HealthBar />);
    const toggle = screen.getByRole('button', { name: 'Hide page health' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => toggle.click());
    expect(document.documentElement.dataset.hud).toBe('collapsed');
    expect(localStorage.getItem('hud')).toBe('collapsed');
    const show = screen.getByRole('button', { name: 'Show page health' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    act(() => show.click());
    expect(document.documentElement.dataset.hud).toBeUndefined();
    expect(localStorage.getItem('hud')).toBe('expanded');
  });

  it('reads a collapsed preference applied before hydration, and survives blocked storage', () => {
    stubObservers([]);
    document.documentElement.dataset.hud = 'collapsed';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<HealthBar />);
    act(() => screen.getByRole('button', { name: 'Show page health' }).click());
    expect(document.documentElement.dataset.hud).toBeUndefined();
  });

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
    expect(cell(/Req/).querySelector('strong')!.textContent).toBe('3');
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
