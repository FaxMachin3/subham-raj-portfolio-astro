// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNextPaint, recordFrames } from '@/lab/frames';
import { requestIdle, runWhenIdle } from '@/lab/idle';
import { observeLayoutShifts, observeLongTasks, support } from '@/lab/observers';
import {
  $requestLog,
  clearRequestLog,
  countRequestsDuring,
  recordRequest,
  requestsInLast,
  trackedFetch,
} from '@/lab/requests';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('frames', () => {
  it('records animation-frame timestamps until the duration ends, or until aborted', async () => {
    let now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb((now += 16)), 0),
    );
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    expect(await recordFrames(50)).toEqual([16, 32, 48, 64]);

    const controller = new AbortController();
    now = 0;
    const stopped = recordFrames(10_000, controller.signal);
    controller.abort();
    expect((await stopped).length).toBe(1);
  });

  it('resolves after two frames, so changes have painted', async () => {
    const frames: number[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(frames.push(1)), 0),
    );
    await afterNextPaint();
    expect(frames).toHaveLength(2);
  });
});

describe('idle scheduling', () => {
  it('uses requestIdleCallback where it exists, and can cancel it', () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn(() => 7),
    );
    vi.stubGlobal('cancelIdleCallback', cancel);
    const stop = requestIdle(() => {});
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('falls back to a timer with a real time budget, and can cancel it', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    requestIdle(callback)();
    vi.advanceTimersByTime(50);
    expect(callback).not.toHaveBeenCalled();
    requestIdle(callback);
    vi.advanceTimersByTime(16);
    expect(callback.mock.calls[0]![0].timeRemaining()).toBeGreaterThan(0);
  });

  it('runs work in slices across idle periods and stops when aborted', async () => {
    await expect(runWhenIdle(12, 4)).resolves.toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await expect(runWhenIdle(1000, 4, controller.signal)).resolves.toBeUndefined();
  });
});

describe('performance observers', () => {
  let callback: (list: { getEntries(): unknown[] }) => void;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    class FakeObserver {
      static supportedEntryTypes = ['longtask', 'layout-shift'];
      constructor(cb: typeof callback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver);
  });

  it('reports what the browser supports', () => {
    expect(support).toMatchObject({ longTask: true, layoutShift: true });
    vi.stubGlobal('PerformanceObserver', class {});
    expect(support).toMatchObject({ longTask: false, layoutShift: false });
    vi.stubGlobal('PerformanceObserver', undefined);
    expect(support.longTask).toBe(false);
  });

  it('forwards long task durations', () => {
    const onTask = vi.fn();
    const stop = observeLongTasks(onTask);
    callback({ getEntries: () => [{ duration: 80 }] });
    expect(onTask).toHaveBeenCalledWith(80);
    stop();
    expect(disconnect).toHaveBeenCalled();
  });

  it('forwards unexpected layout shifts with the nodes that moved, skipping input-driven ones', () => {
    const onShift = vi.fn();
    const node = document.createElement('div');
    observeLayoutShifts(onShift)();
    callback({
      getEntries: () => [
        { value: 0.1, hadRecentInput: true },
        { value: 0.05, hadRecentInput: false, sources: [{ node }, { node: null }] },
        { value: 0.02, hadRecentInput: false },
      ],
    });
    expect(onShift.mock.calls).toEqual([
      [0.05, [node]],
      [0.02, []],
    ]);
  });

  it('does nothing where the entry types are unsupported', () => {
    vi.stubGlobal('PerformanceObserver', class {});
    expect(observeLongTasks(vi.fn())).toBeTypeOf('function');
    expect(observeLayoutShifts(vi.fn())).toBeTypeOf('function');
    observeLongTasks(vi.fn())();
    observeLayoutShifts(vi.fn())();
  });
});

describe('request log', () => {
  beforeEach(clearRequestLog);

  it('keeps a one-minute window of request times', () => {
    recordRequest(0);
    recordRequest(30_000);
    recordRequest(70_000);
    expect($requestLog.get()).toEqual([30_000, 70_000]);
    expect(requestsInLast(5_000, 72_000)).toBe(1);
  });

  it('counts fetches made through trackedFetch', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    await trackedFetch('/data/status.json', { cache: 'no-store' });
    expect(fetch).toHaveBeenCalledWith('/data/status.json', { cache: 'no-store' });
    expect($requestLog.get()).toHaveLength(1);
  });

  it('counts requests made during a window, or until aborted', async () => {
    vi.useFakeTimers();
    const counting = countRequestsDuring(1000);
    recordRequest();
    recordRequest();
    vi.advanceTimersByTime(1000);
    expect(await counting).toBe(2);

    const controller = new AbortController();
    const early = countRequestsDuring(60_000, controller.signal);
    controller.abort();
    expect(await early).toBeGreaterThanOrEqual(0);
  });

  it('settles an already-aborted window immediately without leaving a timer', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    await expect(countRequestsDuring(60_000, controller.signal)).resolves.toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps another demo from contaminating the network measurement', async () => {
    vi.useFakeTimers();
    const counting = countRequestsDuring(1000, undefined, 'network');
    recordRequest(performance.now(), 'network');
    recordRequest(performance.now(), 'demo');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(counting).resolves.toBe(1);
    expect(requestsInLast(60_000)).toBe(2);
  });

  it('removes the abort listener when a measurement finishes normally', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const result = countRequestsDuring(1000, controller.signal);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});
