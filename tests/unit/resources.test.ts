import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundleMeasurement, chunkBytes } from '@/lab/resources';

const entry = (name: string, decodedBodySize: number, encodedBodySize = 0) => ({
  name,
  decodedBodySize,
  encodedBodySize,
});

describe('chunk sizes from Resource Timing', () => {
  it('finds the hashed production chunk and the dev-server module, latest first', () => {
    const entries = [
      entry('https://x.dev/_astro/graph.Ab12.js', 100),
      entry('https://x.dev/_astro/graph.Cd34.js', 200),
    ];
    expect(chunkBytes('graph', entries)).toBe(200);
    expect(chunkBytes('graph', [entry('http://localhost/src/demos/routes/graph.ts?v=1', 50)])).toBe(50);
  });

  it('falls back to the encoded size, and to null when the browser exposes none', () => {
    expect(chunkBytes('core', [entry('/_astro/core.1.js', 0, 40)])).toBe(40);
    expect(chunkBytes('core', [entry('/_astro/core.1.js', 0, 0)])).toBeNull();
    expect(chunkBytes('core', [])).toBeNull();
  });

  it('totals a run and marks it unsupported if any size is missing', () => {
    expect(bundleMeasurement([1024, 2048], 'two')).toMatchObject({
      value: 3072,
      display: '3 KB',
      supported: true,
    });
    expect(bundleMeasurement([1024, null], 'one missing')).toMatchObject({ value: 1024, supported: false });
  });
});

describe('resourceEntries and importCounted', () => {
  const timing = (name: string) =>
    ({ name, decodedBodySize: 10, encodedBodySize: 5 }) as PerformanceResourceTiming;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** A PerformanceObserver whose pending records the test controls, plus its callback. */
  function stubObserver() {
    const pending: PerformanceResourceTiming[] = [];
    let callback: (list: { getEntries(): PerformanceResourceTiming[] }) => void = () => {};
    vi.stubGlobal(
      'PerformanceObserver',
      class {
        static supportedEntryTypes = ['resource'];
        constructor(cb: typeof callback) {
          callback = cb;
        }
        observe() {}
        takeRecords() {
          return pending.splice(0);
        }
      },
    );
    return {
      add: (...names: string[]) => pending.push(...names.map(timing)),
      deliver: (...names: string[]) => callback({ getEntries: () => names.map(timing) }),
    };
  }

  it('keeps every entry the observer sees, beyond the ~250-entry Resource Timing buffer', async () => {
    const observer = stubObserver();
    const { resourceEntries } = await import('@/lab/resources');
    expect(resourceEntries()).toHaveLength(0); // starts observing
    observer.deliver(...Array.from({ length: 400 }, (_, i) => `/data/status.json?${i}`));
    observer.add('/_astro/graph.1.js');
    const entries = resourceEntries();
    expect(entries).toHaveLength(401);
    expect(entries.at(-1)!.name).toBe('/_astro/graph.1.js');
    observer.deliver(...Array.from({ length: 2000 }, (_, i) => `/x/${i}.json`));
    // The callback itself must bound memory even if no consumer calls resourceEntries again.
    expect(entries.length).toBe(1500);
    expect(resourceEntries().length).toBe(1500);
  });

  it('falls back to the Resource Timing buffer where there is no observer', async () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([timing('/_astro/core.1.js')]);
    const { resourceEntries } = await import('@/lab/resources');
    expect(resourceEntries().map((e) => e.name)).toEqual(['/_astro/core.1.js']);
  });

  it('counts a request only when the chunk was actually downloaded', async () => {
    const observer = stubObserver();
    const { importCounted, requestsInLast, clearRequestLog } = await import('@/lab/requests');
    clearRequestLog();
    const fetched = await importCounted('es', async () => {
      observer.add('https://x.dev/_astro/es.Ab12.js');
      return 'dictionary';
    });
    expect(fetched).toEqual({ result: 'dictionary', fetched: true });
    const cached = await importCounted('es', async () => 'dictionary');
    expect(cached.fetched).toBe(false);
    expect(requestsInLast(60_000)).toBe(1);
  });
});
