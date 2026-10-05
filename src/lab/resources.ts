import { formatKB } from './format';
import type { Measurement } from '@/fixes/types';

type ResourceEntry = Pick<PerformanceResourceTiming, 'name' | 'decodedBodySize' | 'encodedBodySize'>;

/**
 * Bytes the browser decoded for a chunk, from Resource Timing. Matches the hashed production file
 * (`graph.Ab12.js`) and the dev-server module (`/demos/routes/graph.ts`). Null when the browser exposes no
 * size (cross-origin without Timing-Allow-Origin, or a full timing buffer).
 */
export function chunkBytes(name: string, entries: readonly ResourceEntry[]): number | null {
  const pattern = new RegExp(`/${name}(\\.[\\w-]+)?\\.(js|ts)(\\?|$)`);
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
