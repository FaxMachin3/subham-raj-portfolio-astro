import { useEffect, useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { analyzeFrames, recordFrames, type FrameReport } from '@/lab/frames';
import { busyWait, runWhenIdle } from '@/lab/idle';
import type { Measurement } from '@/fixes/types';

const TRANSITION_MS = 500;
const MEASURE_MS = 650;
/** Five 70 ms blocks during a 500 ms animation re-create the work that used to fight the resize. */
const HEAVY_SLICES_MS = [0, 90, 180, 270, 360];
const HEAVY_SLICE_COST_MS = 70;
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  top: 12 + ((i * 37) % 140),
  left: 8 + ((i * 53) % 86),
}));

type Mode = 'broken' | 'fixed';

export default function JankFix({ productionNote }: { productionNote: string }) {
  const [open, setOpen] = useState(false);
  const [lastRun, setLastRun] = useState('');
  const modeRef = useRef<Mode>('fixed');
  const openRef = useRef(false);
  const sideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const toggle = async (signal?: AbortSignal): Promise<FrameReport> => {
    const opening = !openRef.current;
    openRef.current = opening;
    const frames = recordFrames(MEASURE_MS, signal);
    setOpen(opening);
    if (modeRef.current === 'broken') {
      HEAVY_SLICES_MS.forEach((delay) => setTimeout(() => busyWait(HEAVY_SLICE_COST_MS), delay));
    } else {
      const side = sideRef.current;
      const afterTransition = () => void runWhenIdle(300, 4, signal);
      side?.addEventListener('transitionend', afterTransition, { once: true });
      // Fallback for when transitions are disabled (reduced motion) and transitionend never fires.
      setTimeout(() => side?.removeEventListener('transitionend', afterTransition), TRANSITION_MS + 400);
    }
    const report = analyzeFrames(await frames);
    setLastRun(
      `Last run: ${report.dropped} dropped frames, longest frame ${Math.round(report.longestMs)} ms`,
    );
    return report;
  };

  const measure = async (mode: Mode, signal: AbortSignal): Promise<Measurement> => {
    modeRef.current = mode;
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      await new Promise((r) => setTimeout(r, TRANSITION_MS + 150));
    }
    const { dropped, longestMs } = await toggle(signal);
    return {
      value: dropped,
      unit: 'frames',
      display: `${dropped} frames`,
      detail: `longest frame ${Math.round(longestMs)} ms during the 0.5 s animation`,
      supported: true,
    };
  };

  useFixLifecycle('jank', {
    break: (signal) => measure('broken', signal),
    fix: (signal) => measure('fixed', signal),
  });

  return (
    <FixCard
      id="jank"
      number="02"
      area="rendering"
      title="A sidebar that stutters"
      description="Opening the sidebar resizes the graph. Broken: heavy work runs during the animation. Fixed: the work waits until the transition ends, then runs in small idle chunks."
      measureLabel={{ before: 'dropped frames', after: 'dropped frames' }}
      productionNote={productionNote}
      actions={
        <button type="button" className="btn btn--sm" onClick={() => void toggle()}>
          Toggle sidebar
        </button>
      }
      footnote={lastRun}
    >
      <div className={`jank-app${open ? ' jank-app--open' : ''}`} aria-hidden="true">
        <div className="jank-app__side" ref={sideRef}>
          <div>Entity details</div>
          <div>Linked addresses</div>
          <div>Risk indicators</div>
          <div>Notes</div>
        </div>
        <div className="jank-app__graph">
          {DOTS.map((dot, i) => (
            <i key={i} style={{ top: dot.top, left: `${dot.left}%` }} />
          ))}
        </div>
      </div>
    </FixCard>
  );
}
