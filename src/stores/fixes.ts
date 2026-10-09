import { atom, map } from 'nanostores';
import {
  FIX_IDS,
  type FixId,
  type FixResult,
  type FixStatus,
  type FixTarget,
  type Measurement,
} from '@/fixes/types';

const byFix = <T>(value: T) => Object.fromEntries(FIX_IDS.map((id) => [id, value])) as Record<FixId, T>;

/** A request for a fix to reach a state. The nonce lets the same target be requested again. */
export interface TargetRequest {
  target: FixTarget;
  nonce: number;
  /** Part of a whole-site run: the x-ray plays its short version. */
  quick: boolean;
}

export const $targets = map<Record<FixId, TargetRequest | null>>(byFix(null));
export const $statuses = map<Record<FixId, FixStatus>>(byFix<FixStatus>('healthy'));
export const $results = map<Record<FixId, FixResult>>(byFix<FixResult>({}));
export const $ready = map<Record<FixId, boolean>>(byFix(false));

/** Bytes of demo JavaScript executed since the current session started. */
export const $jsBytes = atom(0);
/** Bumped whenever a full break or fix run starts, so live meters reset. */
export const $session = atom(0);
export const $prState = atom<'none' | 'open' | 'merged'>('none');
/** True while a whole-site break or fix run owns the cards; their own Break/Fix buttons are locked. */
export const $runActive = atom(false);

let nonce = 0;

export function requestTarget(id: FixId, target: FixTarget, { quick = false } = {}): void {
  // Set the in-progress status synchronously so waitForStatus() can never resolve on a stale state.
  $statuses.setKey(id, target === 'broken' ? 'breaking' : 'fixing');
  $targets.setKey(id, { target, nonce: ++nonce, quick });
}

export function recordMeasurement(id: FixId, phase: keyof FixResult, measurement: Measurement): void {
  $results.setKey(id, { ...$results.get()[id], [phase]: measurement });
}

export function addJsBytes(bytes: number): void {
  $jsBytes.set($jsBytes.get() + bytes);
}

export function startSession(): void {
  $jsBytes.set(0);
  $session.set($session.get() + 1);
}

export function allReady(ready = $ready.get()): boolean {
  return FIX_IDS.every((id) => ready[id]);
}

/** Abandons every run in progress: each card aborts its work and shows Cancelled. */
export function cancelInProgress(): void {
  const statuses = $statuses.get();
  for (const id of FIX_IDS) {
    if (statuses[id] !== 'breaking' && statuses[id] !== 'fixing') continue;
    $targets.setKey(id, null);
    $statuses.setKey(id, 'cancelled');
  }
}

/**
 * Settles with the status a fix ends on: `status` when it gets there, or `failed`/`cancelled` when its run
 * ends another way, or `cancelled` when `signal` aborts. It always settles and always unsubscribes.
 */
export function waitForStatus(id: FixId, status: FixStatus, signal?: AbortSignal): Promise<FixStatus> {
  const settled = (s: FixStatus) => s === status || s === 'failed' || s === 'cancelled';
  return new Promise((resolve) => {
    const current = $statuses.get()[id];
    if (signal?.aborted) return resolve('cancelled');
    if (settled(current)) return resolve(current);
    const finish = (result: FixStatus) => {
      unlisten();
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => finish('cancelled');
    const unlisten = $statuses.listen((statuses) => {
      if (settled(statuses[id])) finish(statuses[id]);
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
