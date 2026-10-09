// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import PlotFix from '@/components/islands/fixes/PlotFix';
import BundleFix from '@/components/islands/fixes/BundleFix';
import I18nFix from '@/components/islands/fixes/I18nFix';
import JankFix from '@/components/islands/fixes/JankFix';
import * as idle from '@/lab/idle';
import * as plot from '@/lab/plot';
import * as requests from '@/lab/requests';
import { $results, $statuses, $targets, requestTarget } from '@/stores/fixes';
import { $xray, finishXray } from '@/xray/store';
import { FIX_IDS } from '@/fixes/types';

let resize: (() => void) | undefined;
let stopAutoFinish = () => {};

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Holds dynamic imports until the test settles them, for the chunk names it is told to hold. */
function gateImports(held: (name: string) => boolean) {
  const calls: { name: string; resolve: () => Promise<void>; reject: () => void }[] = [];
  const real = requests.importCounted;
  vi.spyOn(requests, 'importCounted').mockImplementation((name, load) => {
    if (!held(name)) return real(name, load);
    return new Promise((resolve, reject) => {
      calls.push({
        name,
        resolve: async () => resolve({ result: await load(), fetched: false }),
        reject: () => reject(new TypeError('offline')),
      });
    });
  });
  return calls;
}

beforeEach(() => {
  mockReducedMotion(false);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  for (const id of FIX_IDS) {
    $targets.setKey(id, null);
    $statuses.setKey(id, 'healthy');
    $results.setKey(id, {});
  }
  stopAutoFinish = $xray.listen((xray) => {
    for (const id of FIX_IDS) if (xray[id]) queueMicrotask(() => finishXray(id, xray[id]!.nonce));
  });
});

afterEach(() => {
  cleanup();
  stopAutoFinish();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('PlotFix under reduced motion and aborts', () => {
  it('uses the bounded count when reduced motion is enabled after an earlier calibration', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const calibrate = vi.spyOn(plot, 'calibrateCount').mockReturnValue(8000);
    vi.spyOn(plot, 'plotQuadratic').mockImplementation((nodes) => [...nodes]);
    render(<PlotFix productionNote="note" />);
    act(() => requestTarget('plot', 'broken'));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('broken'));
    mockReducedMotion(true);
    act(() => requestTarget('plot', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('fixed'));
    expect(calibrate).toHaveBeenCalledTimes(1);
    expect($results.get().plot.after?.detail).toContain('1,600 records');
  });
  it('fixes with a bounded count under reduced motion, never calibrating (freezing) the page', async () => {
    mockReducedMotion(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const calibrate = vi.spyOn(plot, 'calibrateCount');
    render(<PlotFix productionNote="note" />);
    act(() => requestTarget('plot', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('fixed'), { timeout: 10_000 });
    expect(calibrate).not.toHaveBeenCalled();
    expect($results.get().plot.after?.detail).toContain('1,600 records');
  });

  it('stops a break that is superseded before the freeze starts, and drops its overlay', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(plot, 'calibrateCount').mockReturnValue(1600);
    const quadratic = vi.spyOn(plot, 'plotQuadratic');
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { container } = render(<PlotFix productionNote="note" />);
    act(() => requestTarget('plot', 'broken'));
    await vi.waitFor(() => expect(container.querySelector('.freeze-overlay')).not.toBeNull());
    act(() => requestTarget('plot', 'fixed'));
    await vi.waitFor(() => expect(container.querySelector('.freeze-overlay')).toBeNull());
    for (let i = 0; i < 20 && $statuses.get().plot !== 'fixed'; i++) {
      await act(async () => frames.shift()?.(0));
    }
    await vi.waitFor(() => expect($statuses.get().plot).toBe('fixed'));
    expect(quadratic).not.toHaveBeenCalled();
  });

  it('abandons a fix when unmounted mid-run, and ignores a resize that lands after unmount', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(plot, 'calibrateCount').mockReturnValue(1600);
    const linear = vi.spyOn(plot, 'plotLinear');
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { unmount } = render(<PlotFix productionNote="note" />);
    const initialDraws = linear.mock.calls.length;
    act(() => requestTarget('plot', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().plot).toBe('fixing'));
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    unmount();
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(linear.mock.calls.length).toBe(initialDraws);
    const contexts = getContext.mock.calls.length;
    resize?.();
    expect(getContext.mock.calls.length).toBe(contexts);
  });
});

describe('manual sidebar cancellation', () => {
  it('can replace a manual toggle without an unhandled abort rejection', async () => {
    vi.useFakeTimers();
    vi.spyOn(idle, 'runWhenIdle').mockResolvedValue(undefined);
    render(<JankFix productionNote="note" />);
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    act(() => toggle.click());
    act(() => toggle.click());
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText(/Last run:/)).toBeTruthy();
    expect(screen.queryByText(/measurement failed/)).toBeNull();
  });
});

describe('BundleFix route loading', () => {
  const routeButton = (name: RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });

  it('loads a route once at a time, offers a retry after a failure, then shows it loaded', async () => {
    let hold = false;
    const calls = gateImports((name) => hold && name !== 'core');
    render(<BundleFix productionNote="note" />);
    act(() => requestTarget('bundle', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().bundle).toBe('fixed'));
    hold = true;

    fireEvent.click(routeButton(/^Open graph$/));
    const opening = routeButton(/^Opening graph…$/);
    expect(opening.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(opening);
    expect(calls).toHaveLength(1);

    await act(async () => calls[0]!.reject());
    fireEvent.click(routeButton(/^Retry graph · failed$/));
    expect(calls).toHaveLength(2);
    await act(async () => calls[1]!.resolve());
    expect(routeButton(/^graph · /).disabled).toBe(true);
  });

  it('ignores manual loads that finish or fail after a newer run started', async () => {
    let hold = false;
    const calls = gateImports((name) => hold && name !== 'core');
    const { container } = render(<BundleFix productionNote="note" />);
    act(() => requestTarget('bundle', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().bundle).toBe('fixed'));
    hold = true;
    fireEvent.click(routeButton(/^Open reports$/));
    fireEvent.click(routeButton(/^Open search$/));
    hold = false;
    act(() => requestTarget('bundle', 'broken'));
    await vi.waitFor(() => expect($statuses.get().bundle).toBe('broken'));
    await act(async () => {
      await calls.find((c) => c.name === 'reports')!.resolve();
      calls.find((c) => c.name === 'search')!.reject();
    });
    const row = (name: string) =>
      [...container.querySelectorAll('.waterfall__row')].find((r) => r.textContent?.startsWith(`${name}.js`));
    expect(row('reports')?.getAttribute('data-state')).toBe('eager');
    expect(screen.queryByRole('button', { name: /reports|search/ })).toBeNull();
  });
});

describe('I18nFix stale loads', () => {
  const select = () => screen.getByLabelText('Language') as HTMLSelectElement;
  const note = () => screen.getByTestId('i18n-note').textContent;

  it('does not update the panel after a pending fix is cancelled', async () => {
    const calls = gateImports((name) => name === 'hi');
    render(<I18nFix />);
    act(() => requestTarget('i18n', 'fixed'));
    await vi.waitFor(() => expect(calls.length).toBe(1));
    act(() => $targets.setKey('i18n', null));
    await act(async () => calls[0]!.resolve());
    expect(note()).toBe('en · bundled with the page');
  });

  it('ignores a pending language pick after leaving the page', async () => {
    const calls = gateImports((name) => name === 'ja');
    render(<I18nFix />);
    fireEvent.change(select(), { target: { value: 'ja' } });
    act(() => dispatchEvent(new Event('pagehide')));
    await act(async () => calls[0]!.resolve());
    expect(note()).toBe('en · bundled with the page');
  });

  it('does not translate the panel when a load started before a switch to broken mode arrives', async () => {
    const calls = gateImports((name) => name === 'ja');
    const { container } = render(<I18nFix />);
    fireEvent.change(select(), { target: { value: 'ja' } });
    act(() => requestTarget('i18n', 'broken'));
    await vi.waitFor(() => expect($statuses.get().i18n).toBe('broken'));
    await act(async () => calls[0]!.resolve());
    expect(note()).toBe('no i18n system · keys rendered raw');
    expect(container.querySelectorAll('.raw-key').length).toBeGreaterThan(0);
  });

  it('keeps only the latest pick, and puts the menu back when that pick fails', async () => {
    const calls = gateImports((name) => ['pt', 'es', 'hi'].includes(name));
    render(<I18nFix />);
    fireEvent.change(select(), { target: { value: 'pt' } });
    fireEvent.change(select(), { target: { value: 'es' } });
    await act(async () => calls[0]!.reject());
    expect(note()).not.toContain('pt.json');
    await act(async () => calls[1]!.resolve());
    expect(note()).toContain('es.json');
    fireEvent.change(select(), { target: { value: 'hi' } });
    await act(async () => calls[2]!.reject());
    expect(note()).toBe('couldn’t load hi.json · try again');
    expect(select().value).toBe('es');
  });
});
