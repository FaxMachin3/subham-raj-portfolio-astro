import { map } from 'nanostores';
import { FIX_IDS, type FixId } from '@/fixes/types';

export type XrayPhase = 'broken' | 'fixed';

export interface XrayRequest {
  phase: XrayPhase;
  /** Shortened version, used when the whole site breaks or is fixed at once. */
  quick: boolean;
  nonce: number;
}

/** Longest an x-ray may hold a fix up, even if its view never loads or never reports back. */
const MAX_MS = 12_000;

export const $xray = map<Record<FixId, XrayRequest | null>>(
  Object.fromEntries(FIX_IDS.map((id) => [id, null])) as Record<FixId, XrayRequest | null>,
);

const resolvers = new Map<number, () => void>();
let nonce = 0;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Shows the x-ray for a fix and resolves when it ends (played out, skipped, aborted or timed out). The
 * fix's real, measured run starts after this, so the animation never overlaps the measurement.
 */
export function playXray(
  id: FixId,
  phase: XrayPhase,
  { quick, signal }: { quick: boolean; signal: AbortSignal },
): Promise<void> {
  // Quick runs are part of a whole-site sequence; under reduced motion they are skipped entirely.
  if (signal.aborted || (quick && prefersReducedMotion())) return Promise.resolve();
  const current = ++nonce;
  $xray.setKey(id, { phase, quick, nonce: current });
  return new Promise((resolve) => {
    const timeout = setTimeout(() => finishXray(id, current), MAX_MS);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        finishXray(id, current);
      },
      { once: true },
    );
    resolvers.set(current, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export function finishXray(id: FixId, which: number): void {
  resolvers.get(which)?.();
  resolvers.delete(which);
  if ($xray.get()[id]?.nonce === which) $xray.setKey(id, null);
}
