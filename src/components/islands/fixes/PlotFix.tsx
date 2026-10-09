import { useCallback, useEffect, useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { calibrateCount, generateNodes, plotLinear, plotQuadratic, timed, type PlotNode } from '@/lab/plot';
import { afterNextPaint } from '@/lab/frames';
import { formatCount, formatMs } from '@/lab/format';
import type { Measurement } from '@/fixes/types';

const PALETTE = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c'];
const TARGET_FREEZE_MS = 1200;
const STREAM_FRAMES = 12;
/** Used without calibrating when motion is reduced: calibrating means freezing the page on purpose. */
const BOUNDED_COUNT = 1600;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PlotFix({ productionNote, method }: { productionNote: string; method?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastNodes = useRef<PlotNode[]>([]);
  const countRef = useRef<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [calibration, setCalibration] = useState('');
  const [plotLabel, setPlotLabel] = useState('Scatter plot of 1,600 graph elements in six clusters');

  const streamRef = useRef(0);

  /**
   * Draws the plot. With `stream`, points arrive over a few frames: after the fix the graph is
   * responsive while it fills in, where the broken version freezes and then appears all at once.
   */
  const draw = useCallback((nodes: PlotNode[], stream = false) => {
    lastNodes.current = nodes;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Null only where canvas is unsupported; the plot then stays blank and the timings still run.
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const size = nodes.length > 8000 ? 1.2 : 2;
    const paint = (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        const node = nodes[i]!;
        ctx.fillStyle = PALETTE[node.cluster]!;
        ctx.fillRect(node.x * width, node.y * height, size, size);
      }
    };

    const run = ++streamRef.current;
    if (!stream || prefersReducedMotion()) {
      paint(0, nodes.length);
      return;
    }
    const chunk = Math.ceil(nodes.length / STREAM_FRAMES);
    let done = 0;
    const step = () => {
      if (run !== streamRef.current) return;
      paint(done, Math.min(nodes.length, done + chunk));
      done += chunk;
      if (done < nodes.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    draw(plotLinear(generateNodes(1600)));
    const observer = new ResizeObserver(() => draw(lastNodes.current));
    observer.observe(canvasRef.current!);
    return () => {
      observer.disconnect();
      // A run counter, not a DOM node: bumping the live value is exactly what stops a scheduled draw.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      streamRef.current++;
    };
  }, [draw]);

  const nodeCount = () => {
    if (prefersReducedMotion()) return BOUNDED_COUNT;
    if (countRef.current === null) {
      countRef.current = calibrateCount(TARGET_FREEZE_MS);
      setCalibration(`${formatCount(countRef.current)} incoming records, calibrated to ~1–2 s here`);
    }
    return countRef.current;
  };

  useFixLifecycle('plot', {
    async break(signal): Promise<Measurement> {
      setFrozen(true);
      await afterNextPaint(signal); // let the overlay paint before the main thread is blocked on purpose
      if (signal.aborted) {
        setFrozen(false);
        signal.throwIfAborted();
      }
      const count = nodeCount();
      const nodes = generateNodes(count);
      const { result, ms } = timed(() => plotQuadratic(nodes));
      setFrozen(false);
      draw(result);
      setPlotLabel(
        `Scatter plot of ${formatCount(result.length)} graph elements in six clusters, plotted by the broken version in ${formatMs(ms)}`,
      );
      return {
        value: ms,
        unit: 'ms',
        display: formatMs(ms),
        detail: `${formatCount(count)} records → ${formatCount(result.length)} unique · main thread blocked`,
        supported: true,
      };
    },
    async fix(signal): Promise<Measurement> {
      signal.throwIfAborted();
      const count = nodeCount();
      const nodes = generateNodes(count);
      await afterNextPaint(signal);
      signal.throwIfAborted();
      const { result, ms } = timed(() => plotLinear(nodes));
      draw(result, true);
      setPlotLabel(
        `Scatter plot of ${formatCount(result.length)} graph elements in six clusters, plotted by the fixed version in ${formatMs(ms)}`,
      );
      return {
        value: ms,
        unit: 'ms',
        display: formatMs(ms),
        detail: `${formatCount(count)} records → ${formatCount(result.length)} unique · same output`,
        supported: true,
      };
    },
  });

  return (
    <FixCard
      id="plot"
      method={method}
      number="01"
      area="performance"
      wide
      title="A graph that freezes while plotting"
      description={
        <>
          The broken version finds each incoming element&rsquo;s index by scanning everything already plotted
          (<code>findIndex</code> inside the loop): quadratic work that blocks the main thread. The fix
          memoizes each element&rsquo;s index in a <code>Map</code> as it is plotted, so every lookup is O(1):
          linear work, identical output.
        </>
      }
      measureLabel={{ before: 'measured', after: 'measured' }}
      footnote={calibration}
      productionNote={productionNote}
    >
      <canvas ref={canvasRef} className="plot-canvas" role="img" aria-label={plotLabel} />
      {frozen && (
        <div className="freeze-overlay" aria-hidden="true">
          Main thread frozen on purpose… everything on this page has stopped.
        </div>
      )}
    </FixCard>
  );
}
