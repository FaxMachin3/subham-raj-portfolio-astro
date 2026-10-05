import { describe, expect, it } from 'vitest';
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
