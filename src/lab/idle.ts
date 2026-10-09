export interface IdleDeadlineLike {
  timeRemaining(): number;
}

const FALLBACK_BUDGET_MS = 8;

/**
 * requestIdleCallback with a real time budget everywhere. Safari has no requestIdleCallback; a bare
 * setTimeout fallback hands the callback no deadline, so "chunked" work would run all at once.
 */
export function requestIdle(callback: (deadline: IdleDeadlineLike) => void): () => void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(() => {
    const start = performance.now();
    callback({ timeRemaining: () => Math.max(0, FALLBACK_BUDGET_MS - (performance.now() - start)) });
  }, 16);
  return () => clearTimeout(handle);
}

/** Blocks the main thread for `ms`. Used only to re-create expensive work inside demos. */
export function busyWait(ms: number): void {
  const end = performance.now() + ms;
  let x = 0;
  while (performance.now() < end) x += Math.sqrt(x + 1);
}

/** Runs `totalMs` of work in small slices whenever the browser is idle. */
export function runWhenIdle(totalMs: number, sliceMs = 4, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let remaining = totalMs;
    let cancel!: () => void;
    const finish = () => {
      cancel();
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const step = (deadline: IdleDeadlineLike) => {
      while (remaining > 0 && deadline.timeRemaining() > sliceMs) {
        busyWait(sliceMs);
        remaining -= sliceMs;
      }
      if (remaining > 0) cancel = requestIdle(step);
      else finish();
    };
    signal?.addEventListener('abort', finish, { once: true });
    cancel = requestIdle(step);
  });
}
