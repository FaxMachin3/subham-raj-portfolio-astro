// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useFixLifecycle, type FixHandlers } from '@/fixes/useFixLifecycle';
import { useHydrated } from '@/lib/useHydrated';
import { $ready, $results, $statuses, requestTarget } from '@/stores/fixes';
import { $xray, finishXray } from '@/xray/store';
import type { Measurement } from '@/fixes/types';

const measurement: Measurement = { value: 1, unit: 'ms', display: '1 ms', detail: '', supported: true };
let stopAutoFinish = () => {};

beforeEach(() => {
  $statuses.setKey('plot', 'healthy');
  $results.setKey('plot', {});
  // X-rays are covered on their own; here they end as soon as they start.
  stopAutoFinish = $xray.listen((xray) => {
    if (xray.plot) queueMicrotask(() => finishXray('plot', xray.plot!.nonce));
  });
});

afterEach(() => {
  cleanup();
  stopAutoFinish();
});

function Card({ handlers }: { handlers: FixHandlers }) {
  useFixLifecycle('plot', handlers);
  return <span>{useHydrated() ? 'hydrated' : 'server'}</span>;
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));

describe('useFixLifecycle', () => {
  it('registers as ready, runs the requested handler after its x-ray, and records the result', async () => {
    const handlers = {
      break: vi.fn().mockResolvedValue(measurement),
      fix: vi.fn().mockResolvedValue(measurement),
    };
    const { unmount } = render(<Card handlers={handlers} />);
    expect($ready.get().plot).toBe(true);
    expect(screen.getByText('hydrated')).toBeTruthy();
    act(() => requestTarget('plot', 'broken'));
    await settle();
    expect(handlers.break).toHaveBeenCalled();
    expect($statuses.get().plot).toBe('broken');
    expect($results.get().plot.before).toEqual(measurement);
    act(() => requestTarget('plot', 'fixed'));
    await settle();
    expect($results.get().plot.after).toEqual(measurement);
    unmount();
    expect($ready.get().plot).toBe(false);
  });

  it('reports a failed run as failed (never healthy) and logs it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Card handlers={{ break: vi.fn().mockRejectedValue(new Error('boom')), fix: vi.fn() }} />);
    act(() => requestTarget('plot', 'broken'));
    await settle();
    expect($statuses.get().plot).toBe('failed');
    expect(error).toHaveBeenCalledWith('[fix:plot]', expect.any(Error));
  });

  it('ignores the outcome of a run that a newer request superseded', async () => {
    let resolveSlow!: (m: Measurement) => void;
    const slow = new Promise<Measurement>((r) => (resolveSlow = r));
    const handlers = { break: vi.fn(() => slow), fix: vi.fn().mockResolvedValue(measurement) };
    render(<Card handlers={handlers} />);
    act(() => requestTarget('plot', 'broken'));
    await settle();
    act(() => requestTarget('plot', 'fixed'));
    await settle();
    resolveSlow({ ...measurement, display: 'stale' });
    await settle();
    expect($results.get().plot.before).toBeUndefined();
    expect($statuses.get().plot).toBe('fixed');
  });

  it('never starts the handler if superseded while its x-ray plays', async () => {
    stopAutoFinish();
    const handlers = {
      break: vi.fn().mockResolvedValue(measurement),
      fix: vi.fn().mockResolvedValue(measurement),
    };
    render(<Card handlers={handlers} />);
    act(() => requestTarget('plot', 'broken'));
    act(() => requestTarget('plot', 'fixed'));
    await settle();
    expect(handlers.break).not.toHaveBeenCalled();
    act(() => finishXray('plot', $xray.get().plot!.nonce));
    await settle();
    expect(handlers.fix).toHaveBeenCalled();
  });
});
