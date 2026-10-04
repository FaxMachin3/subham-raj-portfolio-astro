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

let nonce = 0;

export function requestTarget(id: FixId, target: FixTarget): void {
  // Set the in-progress status synchronously so waitForStatus() can never resolve on a stale state.
  $statuses.setKey(id, target === 'broken' ? 'breaking' : 'fixing');
  $targets.setKey(id, { target, nonce: ++nonce });
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

/** Resolves when a fix reaches `status`, or immediately if it already has. */
export function waitForStatus(id: FixId, status: FixStatus): Promise<void> {
  return new Promise((resolve) => {
    if ($statuses.get()[id] === status) return resolve();
    const unsubscribe = $statuses.subscribe((statuses) => {
      if (statuses[id] === status) {
        queueMicrotask(() => unsubscribe());
        resolve();
      }
    });
  });
}
