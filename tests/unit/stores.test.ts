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

  it('resets per-session counters', () => {
    addJsBytes(1000);
    const session = $session.get();
    startSession();
    expect($jsBytes.get()).toBe(0);
    expect($session.get()).toBe(session + 1);
  });
});
