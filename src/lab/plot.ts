export interface PlotNode {
  id: string;
  x: number;
  y: number;
  cluster: number;
}

const CLUSTERS = 6;
const DUPLICATE_RATE = 0.06;

/** Deterministic pseudo-random generator so every run plots the same graph. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 48271) % 2147483647) / 2147483647;
}

/**
 * Generates `count` incoming nodes in six gaussian clusters. About 6% reuse an earlier id, as
 * investigation graphs do when the same address appears in several transfers.
 */
export function generateNodes(count: number, seed = 7): PlotNode[] {
  const rand = seeded(seed);
  const gaussian = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const nodes: PlotNode[] = [];
  for (let i = 0; i < count; i++) {
    const reuse = i > 10 && rand() < DUPLICATE_RATE;
    const cluster = i % CLUSTERS;
    nodes.push({
      id: reuse ? `n${Math.floor(rand() * i)}` : `n${i}`,
      x: clamp(0.17 + (cluster % 3) * 0.33 + gaussian() * 0.055, 0.02, 0.98),
      y: clamp((cluster < 3 ? 0.32 : 0.7) + gaussian() * 0.09, 0.04, 0.96),
      cluster,
    });
  }
  return nodes;
}

/**
 * The broken implementation, kept deliberately: `find` scans the array and the spread copies it on
 * every step, so the work is O(n²) and allocates a new array per node.
 */
export function plotQuadratic(incoming: readonly PlotNode[]): PlotNode[] {
  let plotted: PlotNode[] = [];
  for (const node of incoming) {
    const existing = plotted.find((p) => p.id === node.id);
    plotted = existing
      ? plotted.map((p) => (p.id === node.id ? { ...p, ...node } : p))
      : [...plotted, { ...node }];
  }
  return plotted;
}

/** The fix: an id → index Map and a single array. O(n), same output order. */
export function plotLinear(incoming: readonly PlotNode[]): PlotNode[] {
  const indexById = new Map<string, number>();
  const plotted: PlotNode[] = [];
  for (const node of incoming) {
    const index = indexById.get(node.id);
    if (index === undefined) {
      indexById.set(node.id, plotted.length);
      plotted.push({ ...node });
    } else {
      plotted[index] = { ...plotted[index]!, ...node };
    }
  }
  return plotted;
}

export function timed<T>(
  fn: () => T,
  now: () => number = () => performance.now(),
): { result: T; ms: number } {
  const start = now();
  const result = fn();
  return { result, ms: now() - start };
}

/**
 * Picks a node count so the quadratic version takes about `targetMs` on this device: dramatic on a
 * laptop, never punishing on a slow phone. Quadratic cost means n scales with the square root.
 */
interface CalibrationOptions {
  sample?: number;
  min?: number;
  max?: number;
  /** The work being timed; only its duration matters. */
  measure?: (incoming: readonly PlotNode[]) => unknown;
}

export function calibrateCount(
  targetMs: number,
  { sample = 2500, min = 1600, max = 20000, measure = plotQuadratic }: CalibrationOptions = {},
): number {
  const nodes = generateNodes(sample);
  measure(nodes.slice(0, 300)); // warm up the JIT so the sample isn't dominated by compilation
  const { ms } = timed(() => measure(nodes));
  const perNodeSquared = Math.max(ms, 0.5) / (sample * sample);
  const count = Math.sqrt(targetMs / perNodeSquared);
  return Math.max(min, Math.min(max, Math.round(count / 100) * 100));
}
