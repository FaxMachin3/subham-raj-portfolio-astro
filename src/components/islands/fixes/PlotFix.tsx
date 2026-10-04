import { useCallback, useEffect, useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { calibrateCount, generateNodes, plotLinear, plotQuadratic, timed, type PlotNode } from '@/lab/plot';
import { afterNextPaint } from '@/lab/frames';
import { formatCount, formatMs } from '@/lab/format';
import type { Measurement } from '@/fixes/types';

const PALETTE = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c'];
const TARGET_FREEZE_MS = 1600;

export default function PlotFix({ productionNote }: { productionNote: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastNodes = useRef<PlotNode[]>([]);
  const countRef = useRef<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [calibration, setCalibration] = useState('');

  const draw = useCallback((nodes: PlotNode[]) => {
    lastNodes.current = nodes;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const size = nodes.length > 8000 ? 1.2 : 2;
    for (const node of nodes) {
      ctx.fillStyle = PALETTE[node.cluster] ?? PALETTE[0]!;
      ctx.fillRect(node.x * width, node.y * height, size, size);
    }
  }, []);

  useEffect(() => {
    draw(plotLinear(generateNodes(1600)));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw(lastNodes.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const nodeCount = () => {
    if (countRef.current === null) {
      countRef.current = calibrateCount(TARGET_FREEZE_MS);
      setCalibration(`${formatCount(countRef.current)} elements, calibrated so “before” takes ~1.5 s here`);
    }
    return countRef.current;
  };

  useFixLifecycle('plot', {
    async break(): Promise<Measurement> {
      const count = nodeCount();
      const nodes = generateNodes(count);
      setFrozen(true);
      await afterNextPaint(); // let the overlay paint before the main thread is blocked on purpose
      const { result, ms } = timed(() => plotQuadratic(nodes));
      setFrozen(false);
      draw(result);
      return {
        value: ms,
        unit: 'ms',
        display: formatMs(ms),
        detail: `${formatCount(count)} elements · main thread blocked`,
        supported: true,
      };
    },
    async fix(): Promise<Measurement> {
      const count = nodeCount();
      const nodes = generateNodes(count);
      await afterNextPaint();
      const { result, ms } = timed(() => plotLinear(nodes));
      draw(result);
      return {
        value: ms,
        unit: 'ms',
        display: formatMs(ms),
        detail: `${formatCount(count)} elements · same output`,
        supported: true,
      };
    },
  });

  return (
    <FixCard
      id="plot"
      number="01"
      area="performance"
      wide
      title="A graph that freezes while plotting"
      description={
        <>
          The broken version matches incoming nodes with <code>array.find</code> and rebuilds the array with
          the spread operator on every step: quadratic work that blocks the main thread. The fix uses a Map
          and a single array: linear work, identical output.
        </>
      }
      measureLabel={{ before: 'measured', after: 'measured' }}
      footnote={calibration}
      productionNote={productionNote}
    >
      <canvas
        ref={canvasRef}
        className="plot-canvas"
        role="img"
        aria-label="Scatter plot of plotted graph elements"
      />
      {frozen && (
        <div className="freeze-overlay" aria-hidden="true">
          Main thread frozen on purpose… everything on this page has stopped.
        </div>
      )}
    </FixCard>
  );
}
