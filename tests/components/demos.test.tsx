// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import PlotFix from '@/components/islands/fixes/PlotFix';
import NetworkFix from '@/components/islands/fixes/NetworkFix';
import JankFix from '@/components/islands/fixes/JankFix';
import * as idle from '@/lab/idle';
import * as frames from '@/lab/frames';
import { $results, $statuses, $targets, cancelInProgress, requestTarget } from '@/stores/fixes';
import { $xray, finishXray } from '@/xray/store';
import { FIX_IDS } from '@/fixes/types';

let resize: (() => void) | undefined;
const disconnect = vi.fn();
let stopAutoFinish = () => {};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
  stopAutoFinish = $xray.listen((xray) => {
    for (const id of FIX_IDS) if (xray[id]) queueMicrotask(() => finishXray(id, xray[id]!.nonce));
  });
});

afterEach(() => {
  cleanup();
  stopAutoFinish();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PlotFix', () => {
  it('stays blank but working where canvas is unsupported, and disconnects on unmount', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { unmount } = render(<PlotFix productionNote="note" />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('streams the fixed plot in, and a resize mid-stream redraws at once instead', async () => {
    const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    render(<PlotFix productionNote="note" />);
    act(() => requestTarget('plot', 'fixed'));
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0), { timeout: 10_000 });
    // The fixed run's first animation frames are the two in afterNextPaint, then the stream begins.
    for (let i = 0; i < 4 && $statuses.get().plot !== 'fixed'; i++)
      await act(async () => frames.shift()?.(0));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('fixed'));
    const painted = ctx.fillRect.mock.calls.length;
    act(() => resize?.());
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(painted);
    const afterResize = ctx.fillRect.mock.calls.length;
    while (frames.length) await act(async () => frames.shift()?.(0));
    expect(ctx.fillRect.mock.calls.length).toBe(afterResize);
  }, 20_000);
});

describe('PlotFix break', () => {
  it('freezes on purpose behind its overlay, then reports the measured time', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<PlotFix productionNote="note" />);
    act(() => requestTarget('plot', 'broken'));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('broken'), { timeout: 20_000 });
    expect(document.querySelector('.freeze-overlay')).toBeNull();
    expect($results.get().plot.before?.detail).toContain('main thread blocked');
  }, 30_000);
});

describe('NetworkFix', () => {
  it('ignores a panel response that arrives after a newer run started', async () => {
    const pending: ((r: Response) => void)[] = [];
    // jsdom has no Element.scrollTo.
    Element.prototype.scrollTo = () => {};
    const entityRequests: ((r: Response) => void)[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      const response = new Promise<Response>((resolve) => pending.push(resolve));
      if (url.includes('/entities/')) entityRequests.push(pending.at(-1)!);
      return response;
    });
    const { container } = render(<NetworkFix productionNote="note" />);
    act(() => requestTarget('network', 'broken'));
    await vi.waitFor(() => expect(entityRequests).toHaveLength(24));
    act(() => requestTarget('network', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().network).toBe('fixing'));
    await act(async () => {
      for (const resolve of pending)
        resolve(new Response(JSON.stringify({ id: 1, name: 'Stale', risk: 'High' })));
    });
    expect(container.textContent).not.toContain('Stale');
  });

  it('disconnects its observers and timers on unmount', () => {
    const { unmount } = render(<NetworkFix productionNote="note" />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('cancels panel requests and status polling without unmounting the page', async () => {
    Element.prototype.scrollTo = () => {};
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/entities/')) signals.push(init!.signal! as AbortSignal);
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal('fetch', fetch);
    $targets.setKey('network', null);
    $statuses.setKey('network', 'healthy');
    render(<NetworkFix productionNote="note" />);
    act(() => requestTarget('network', 'broken'));
    await vi.waitFor(() => expect(signals).toHaveLength(24));
    act(() => cancelInProgress());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    const count = fetch.mock.calls.length;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(fetch).toHaveBeenCalledTimes(count);
    expect($statuses.get().network).toBe('cancelled');
  });

  it('shows a failed panel (HTTP error or bad data) with a retry, never as loaded', async () => {
    Element.prototype.scrollTo = () => {};
    let healthy = false;
    vi.stubGlobal('fetch', async (url: string) => {
      if (!url.includes('/entities/')) throw new TypeError('offline'); // status polls fail too
      if (healthy) return new Response(JSON.stringify({ id: 3, name: 'Exchange 3', risk: 'Low' }));
      return url.endsWith('/3.json') ? new Response('nope', { status: 503 }) : new Response('{"oops":1}');
    });
    const { container } = render(<NetworkFix productionNote="note" />);
    act(() => requestTarget('network', 'broken'));
    await vi.waitFor(() => expect(container.textContent).toContain('Couldn’t load panel 3'));
    expect(container.textContent).toContain('Couldn’t load panel 7');
    expect(container.textContent).toContain('panels fetched: 0/24');
    healthy = true;
    await act(async () => screen.getAllByRole('button', { name: 'Retry' })[2]!.click());
    await vi.waitFor(() => expect(container.textContent).toContain('Exchange 3'));
  });

  it('treats requests aborted by a newer run as superseded, not failed', async () => {
    Element.prototype.scrollTo = () => {};
    vi.stubGlobal(
      'fetch',
      (url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          if (url.includes('/entities/'))
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { container } = render(<NetworkFix productionNote="note" />);
    act(() => requestTarget('network', 'broken'));
    await vi.waitFor(() => expect($statuses.get().network).toBe('breaking'));
    await new Promise((r) => setTimeout(r, 50));
    act(() => requestTarget('network', 'fixed'));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(container.textContent).not.toContain('Couldn’t load');
  });

  it('leaves no timer running after a run is abandoned mid-way', async () => {
    Element.prototype.scrollTo = () => {};
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const realSet = globalThis.setTimeout;
    const realClear = globalThis.clearTimeout;
    vi.stubGlobal('setTimeout', ((fn: () => void, ms?: number) => {
      const id = realSet(() => {
        timeouts.delete(id);
        fn();
      }, ms);
      timeouts.add(id);
      return id;
    }) as typeof setTimeout);
    vi.stubGlobal('clearTimeout', ((id: ReturnType<typeof setTimeout>) => {
      timeouts.delete(id);
      realClear(id);
    }) as typeof clearTimeout);
    const { unmount } = render(<NetworkFix productionNote="note" />);
    act(() => requestTarget('network', 'broken'));
    await vi.waitFor(() => expect($statuses.get().network).toBe('breaking'));
    await new Promise((r) => realSet(r, 600)); // the banner keeps waiting for the card to be on screen
    unmount();
    expect([...timeouts]).toEqual([]);
  });
});

describe('JankFix', () => {
  it('cancels a manual toggle before its deferred workload runs on unmount', async () => {
    vi.useFakeTimers();
    vi.spyOn(frames, 'recordFrames').mockResolvedValue([0, 16]);
    const run = vi.spyOn(idle, 'runWhenIdle').mockResolvedValue();
    $targets.setKey('jank', null);
    $statuses.setKey('jank', 'healthy');
    const { unmount } = render(<JankFix productionNote="note" />);
    await act(async () => screen.getByRole('button', { name: 'Toggle sidebar' }).click());
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(run).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not schedule heavy work when cancelled while closing an already-open sidebar', async () => {
    vi.useFakeTimers();
    const record = vi.spyOn(frames, 'recordFrames').mockResolvedValue([0, 16]);
    const busy = vi.spyOn(idle, 'busyWait').mockImplementation(() => {});
    vi.spyOn(idle, 'runWhenIdle').mockResolvedValue();
    $targets.setKey('jank', null);
    $statuses.setKey('jank', 'healthy');
    render(<JankFix productionNote="note" />);
    await act(async () => screen.getByRole('button', { name: 'Toggle sidebar' }).click());
    act(() => requestTarget('jank', 'broken'));
    await act(async () => vi.advanceTimersByTimeAsync(20));
    act(() => cancelInProgress());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(record).toHaveBeenCalledTimes(1);
    expect(busy).not.toHaveBeenCalled();
    expect($statuses.get().jank).toBe('cancelled');
    vi.useRealTimers();
  });

  it('runs the deferred work exactly once when transitionend never fires, and not again if it fires late', async () => {
    const run = vi.spyOn(idle, 'runWhenIdle').mockResolvedValue();
    const { container } = render(<JankFix productionNote="note" />);
    act(() => requestTarget('jank', 'fixed'));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(run).toHaveBeenCalledWith(350, 4, expect.any(AbortSignal));
    act(() => {
      container.querySelector('.jank-app__side')!.dispatchEvent(new Event('transitionend'));
    });
    await vi.waitFor(() => expect($statuses.get().jank).toBe('fixed'), { timeout: 5000 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports "not enough frames" instead of a perfect run when too few frames were sampled', async () => {
    vi.spyOn(frames, 'recordFrames').mockResolvedValue([0, 16]);
    $targets.setKey('jank', null);
    $statuses.setKey('jank', 'healthy');
    const { container } = render(<JankFix productionNote="note" />);
    act(() => requestTarget('jank', 'broken'));
    await vi.waitFor(() => expect($statuses.get().jank).toBe('broken'), { timeout: 5000 });
    expect($results.get().jank.before).toMatchObject({
      supported: false,
      detail: 'not enough frames sampled',
    });
    expect(container.textContent).toContain('Last run: not enough frames sampled');
  });

  it('disables "Toggle sidebar" while a measurement runs', async () => {
    $targets.setKey('jank', null);
    $statuses.setKey('jank', 'healthy');
    render(<JankFix productionNote="note" />);
    const toggle = screen.getByRole<HTMLButtonElement>('button', { name: 'Toggle sidebar' });
    expect(toggle.disabled).toBe(false);
    act(() => requestTarget('jank', 'broken'));
    expect(toggle.disabled).toBe(true);
    await vi.waitFor(() => expect($statuses.get().jank).toBe('broken'), { timeout: 5000 });
    expect(toggle.disabled).toBe(false);
  });
});
