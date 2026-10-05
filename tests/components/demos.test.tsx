// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import PlotFix from '@/components/islands/fixes/PlotFix';
import NetworkFix from '@/components/islands/fixes/NetworkFix';
import { $results, $statuses, requestTarget } from '@/stores/fixes';
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
});
