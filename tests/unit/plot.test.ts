import { describe, expect, it } from 'vitest';
import { calibrateCount, generateNodes, plotLinear, plotQuadratic, timed } from '@/lab/plot';

describe('plot algorithms', () => {
  it('generates deterministic nodes for a seed', () => {
    expect(generateNodes(200, 3)).toEqual(generateNodes(200, 3));
    expect(generateNodes(200, 3)).not.toEqual(generateNodes(200, 4));
  });

  it('keeps every coordinate inside the canvas', () => {
    for (const node of generateNodes(2000)) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(1);
    }
  });

  it('produces identical output from the quadratic and linear implementations', () => {
    const nodes = generateNodes(1500);
    expect(plotLinear(nodes)).toEqual(plotQuadratic(nodes));
  });

  it('merges duplicate ids, keeping first-seen order and the latest values', () => {
    const incoming = [
      { id: 'a', x: 0.1, y: 0.1, cluster: 0 },
      { id: 'b', x: 0.2, y: 0.2, cluster: 1 },
      { id: 'a', x: 0.9, y: 0.9, cluster: 0 },
    ];
    const result = plotLinear(incoming);
    expect(result.map((n) => n.id)).toEqual(['a', 'b']);
    expect(result[0]).toMatchObject({ x: 0.9, y: 0.9 });
  });

  it('does not mutate its input', () => {
    const nodes = generateNodes(50);
    const copy = structuredClone(nodes);
    plotLinear(nodes);
    plotQuadratic(nodes);
    expect(nodes).toEqual(copy);
  });

  it('is meaningfully faster in the linear implementation', () => {
    const nodes = generateNodes(6000);
    const slow = timed(() => plotQuadratic(nodes)).ms;
    const fast = timed(() => plotLinear(nodes)).ms;
    expect(fast * 5).toBeLessThan(slow);
  });
});

describe('timed', () => {
  it('measures with the provided clock', () => {
    let t = 100;
    const clock = () => (t += 25);
    expect(timed(() => 'ok', clock)).toEqual({ result: 'ok', ms: 25 });
  });
});

describe('calibrateCount', () => {
  it('scales with the square root of the target time and respects bounds', () => {
    const fastMachine = calibrateCount(1600, { measure: (n) => n, sample: 2500, max: 20000 });
    expect(fastMachine).toBe(20000); // capped at max on a very fast "device"
    const bounded = calibrateCount(1, { measure: (n) => n, min: 1600 });
    expect(bounded).toBeGreaterThanOrEqual(1600);
  });

  it('rounds to the nearest hundred', () => {
    expect(calibrateCount(1600, { max: 1e9, measure: plotQuadratic }) % 100).toBe(0);
  });
});
