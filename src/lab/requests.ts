import { atom } from 'nanostores';

/** Timestamps of requests made by the demos. The health bar derives requests/minute from this. */
export const $requestLog = atom<readonly number[]>([]);

const WINDOW_MS = 60_000;

export function recordRequest(at = performance.now()): void {
  const recent = $requestLog.get().filter((t) => at - t < WINDOW_MS);
  $requestLog.set([...recent, at]);
}

export function clearRequestLog(): void {
  $requestLog.set([]);
}

/** `fetch` that counts towards the demo request log. */
export function trackedFetch(input: string, init?: RequestInit): Promise<Response> {
  recordRequest();
  return fetch(input, init);
}

export function requestsInLast(ms: number, now = performance.now()): number {
  return $requestLog.get().filter((t) => now - t < ms).length;
}

/** Counts demo requests made during the next `ms`. */
export function countRequestsDuring(ms: number, signal?: AbortSignal): Promise<number> {
  const start = performance.now();
  return new Promise((resolve) => {
    const done = () => resolve($requestLog.get().filter((t) => t >= start).length);
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      done();
    });
  });
}
