import { beforeEach, describe, expect, it } from 'vitest';
import { FIX_IDS } from '@/fixes/types';
import {
  $jsBytes,
  $ready,
  $results,
  $session,
  $statuses,
  $targets,
  addJsBytes,
  allReady,
  cancelInProgress,
  recordMeasurement,
  requestTarget,
  startSession,
  waitForStatus,
} from '@/stores/fixes';

const measurement = { value: 1, unit: 'ms', display: '1 ms', detail: '', supported: true } as const;

beforeEach(() => {
  FIX_IDS.forEach((id) => {
    $statuses.setKey(id, 'healthy');
    $targets.setKey(id, null);
    $ready.setKey(id, false);
    $results.setKey(id, {});
  });
});

describe('fix store', () => {
  it('marks a fix as in progress synchronously when a target is requested', () => {
    requestTarget('plot', 'broken');
    expect($statuses.get().plot).toBe('breaking');
    requestTarget('plot', 'fixed');
    expect($statuses.get().plot).toBe('fixing');
  });

  it('issues a fresh request object each time, so the same target can be requested again', () => {
    requestTarget('jank', 'broken');
    const first = $targets.get().jank;
    requestTarget('jank', 'broken');
    expect($targets.get().jank).not.toBe(first);
    expect($targets.get().jank?.nonce).toBeGreaterThan(first!.nonce);
  });

  it('never resolves waitForStatus on the stale state of a re-requested target', async () => {
    $statuses.setKey('a11y', 'broken');
    requestTarget('a11y', 'broken');
    let resolved = false;
    void waitForStatus('a11y', 'broken').then(() => (resolved = true));
    await Promise.resolve();
    expect(resolved).toBe(false);
    $statuses.setKey('a11y', 'broken');
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('records before and after measurements independently', () => {
    recordMeasurement('bundle', 'before', measurement);
    recordMeasurement('bundle', 'after', { ...measurement, value: 2 });
    expect($results.get().bundle.before?.value).toBe(1);
    expect($results.get().bundle.after?.value).toBe(2);
  });

  it('reports readiness only when every card has registered', () => {
    expect(allReady()).toBe(false);
    FIX_IDS.forEach((id) => $ready.setKey(id, true));
    expect(allReady()).toBe(true);
  });

  it('cancels only the runs in progress, clearing their targets', () => {
    requestTarget('plot', 'broken');
    $statuses.setKey('jank', 'fixed');
    cancelInProgress();
    expect($statuses.get().plot).toBe('cancelled');
    expect($targets.get().plot).toBeNull();
    expect($statuses.get().jank).toBe('fixed');
  });

  it('resets per-session counters', () => {
    addJsBytes(1000);
    const session = $session.get();
    startSession();
    expect($jsBytes.get()).toBe(0);
    expect($session.get()).toBe(session + 1);
  });
});

describe('waitForStatus', () => {
  it('resolves at once when the fix is already there', async () => {
    $statuses.setKey('bundle', 'fixed');
    await expect(waitForStatus('bundle', 'fixed')).resolves.toBe('fixed');
  });

  it('settles with "failed" when the run fails, instead of waiting forever', async () => {
    const waiting = waitForStatus('network', 'broken');
    $statuses.setKey('network', 'breaking');
    $statuses.setKey('network', 'failed');
    await expect(waiting).resolves.toBe('failed');
  });

  it('settles with "cancelled" when the run is cancelled or the caller aborts, and stops listening', async () => {
    requestTarget('i18n', 'fixed');
    const cancelled = waitForStatus('i18n', 'fixed');
    cancelInProgress();
    await expect(cancelled).resolves.toBe('cancelled');

    const controller = new AbortController();
    const aborted = waitForStatus('plot', 'fixed', controller.signal);
    controller.abort();
    await expect(aborted).resolves.toBe('cancelled');
    $statuses.setKey('plot', 'fixed'); // a later change must not reach the settled waiter
    await expect(waitForStatus('plot', 'fixed', controller.signal)).resolves.toBe('cancelled');
    expect($statuses.lc).toBe(0);
  });

  it('waits through unrelated changes until the fix reaches the status', async () => {
    let resolved = false;
    const waiting = waitForStatus('plot', 'broken').then(() => (resolved = true));
    $statuses.setKey('jank', 'breaking');
    await Promise.resolve();
    expect(resolved).toBe(false);
    $statuses.setKey('plot', 'broken');
    await waiting;
    expect(resolved).toBe(true);
  });
});
