import { formatKB } from './format';
import type { Measurement } from '@/fixes/types';

type ResourceEntry = Pick<PerformanceResourceTiming, 'name' | 'decodedBodySize' | 'encodedBodySize'>;

const KEEP = 1500;
const seen: PerformanceResourceTiming[] = [];
let observer: PerformanceObserver | null = null;
const remember = (entries: PerformanceResourceTiming[]) => {
  seen.push(...entries);
  if (seen.length > KEEP) seen.splice(0, seen.length - KEEP);
};

/**
 * Every resource the page has loaded, newest last. Read through a PerformanceObserver because the
 * Resource Timing buffer stops recording after ~250 entries, and the broken network demo alone fills it in
 * seconds; after that, later chunks would silently report no size.
 */
export function resourceEntries(): readonly PerformanceResourceTiming[] {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes('resource')
  )
    return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  if (!observer) {
    // Entries arrive either through this callback or through takeRecords(), never both.
    observer = new PerformanceObserver((list) => remember(list.getEntries() as PerformanceResourceTiming[]));
    observer.observe({ type: 'resource', buffered: true });
  }
  remember(observer.takeRecords() as PerformanceResourceTiming[]);
  return seen;
}

/** Matches a chunk by name: the hashed production file (`es.Ab12.js`) or a dev-server module. */
export const chunkPattern = (name: string) => new RegExp(`/${name}(\\.[\\w-]+)?\\.(js|ts|json)(\\?|$)`);

/**
 * Bytes the browser decoded for a chunk, from Resource Timing. Matches the hashed production file
 * (`graph.Ab12.js`) and the dev-server module (`/demos/routes/graph.ts`). Null when the browser exposes no
 * size (cross-origin without Timing-Allow-Origin, or a full timing buffer).
 */
export function chunkBytes(name: string, entries: readonly ResourceEntry[]): number | null {
  const pattern = chunkPattern(name);
  const entry = entries.filter((e) => pattern.test(e.name)).pop();
  const bytes = entry ? entry.decodedBodySize || entry.encodedBodySize : 0;
  return bytes > 0 ? bytes : null;
}

/** Total of the chunks loaded; marked unsupported if any size was unavailable, so the UI says "n/a". */
export function bundleMeasurement(bytes: readonly (number | null)[], detail: string): Measurement {
  const supported = bytes.every((b) => b !== null);
  const total = bytes.reduce<number>((sum, b) => sum + (b ?? 0), 0);
  return { value: total, unit: 'bytes', display: formatKB(total), detail, supported };
}
