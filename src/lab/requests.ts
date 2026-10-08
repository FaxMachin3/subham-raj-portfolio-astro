import { atom } from 'nanostores';
import { chunkPattern, resourceEntries } from './resources';

/** Timestamps of requests made by the demos. The health bar derives requests/minute from this. */
export const $requestLog = atom<readonly number[]>([]);

const WINDOW_MS = 60_000;
let scopedRequests: { at: number; scope: string }[] = [];

export function recordRequest(at = performance.now(), scope = 'demo'): void {
  const recent = $requestLog.get().filter((t) => at - t < WINDOW_MS);
  $requestLog.set([...recent, at]);
  scopedRequests = scopedRequests.filter((entry) => at - entry.at < WINDOW_MS);
  scopedRequests.push({ at, scope });
}

export function clearRequestLog(): void {
  $requestLog.set([]);
  scopedRequests = [];
}

/** `fetch` that counts towards the demo request log. */
export function trackedFetch(input: string, init?: RequestInit, scope = 'demo'): Promise<Response> {
  recordRequest(performance.now(), scope);
  return fetch(input, init);
}

export function requestsInLast(ms: number, now = performance.now()): number {
  return $requestLog.get().filter((t) => now - t < ms).length;
}

/** Counts demo requests made during the next `ms`. */
export function countRequestsDuring(ms: number, signal?: AbortSignal, scope?: string): Promise<number> {
  const start = performance.now();
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(0);
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve(
        scope
          ? scopedRequests.filter((entry) => entry.at >= start && entry.scope === scope).length
          : $requestLog.get().filter((t) => t >= start).length,
      );
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Runs a dynamic import and records a request only if the browser actually fetched the chunk. A module
 * already in memory (a repeat visit to a route, or a cleared demo cache) costs no request.
 */
export async function importCounted<T>(
  name: string,
  load: () => Promise<T>,
): Promise<{ result: T; fetched: boolean }> {
  const pattern = chunkPattern(name);
  const count = () => resourceEntries().filter((e) => pattern.test(e.name)).length;
  const before = count();
  const result = await load();
  const fetched = count() > before;
  if (fetched) recordRequest();
  return { result, fetched };
}
