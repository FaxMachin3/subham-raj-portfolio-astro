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
 * The broken implementation, kept deliberately: every incoming node looks up its index by scanning
 * everything already plotted, so the inner loop runs up to n times per node and the work is O(n²).
 */
export function plotQuadratic(incoming: readonly PlotNode[]): PlotNode[] {
  const plotted: PlotNode[] = [];
  for (const node of incoming) {
    const index = plotted.findIndex((p) => p.id === node.id);
    if (index === -1) plotted.push({ ...node });
    else plotted[index] = { ...plotted[index]!, ...node };
  }
  return plotted;
}

/** The fix: memoize each id's index as it is plotted, so every lookup is O(1) and the work is O(n). */
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

interface CalibrationOptions {
  sample?: number;
  min?: number;
  max?: number;
  /** The work being timed; only its duration matters. */
  measure?: (incoming: readonly PlotNode[]) => unknown;
}

/**
 * Picks a node count so the quadratic version takes about `targetMs` on this device: dramatic on a
 * laptop, never punishing on a slow phone. Quadratic cost means n scales with the square root.
 * A small sample under-predicts at large n (cache effects differ by engine), so a second probe at
 * about a third of the first estimate refines it; that probe costs roughly a ninth of the target.
 */
export function calibrateCount(
  targetMs: number,
  { sample = 4000, min = 1600, max = 80000, measure = plotQuadratic }: CalibrationOptions = {},
): number {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n / 100) * 100));
  const extrapolate = (size: number) => {
    const { ms } = timed(() => measure(generateNodes(size)));
    return Math.sqrt(targetMs / (Math.max(ms, 0.5) / (size * size)));
  };

  measure(generateNodes(1500)); // warm up the JIT so the sample isn't dominated by compilation
  const first = extrapolate(sample);
  const probe = Math.round(first / 3);
  return clamp(probe > sample ? extrapolate(probe) : first);
}
