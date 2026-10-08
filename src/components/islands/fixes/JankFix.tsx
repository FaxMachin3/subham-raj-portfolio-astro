import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $statuses } from '@/stores/fixes';
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
/** Both versions do the same total work; only when it runs differs. */
const HEAVY_WORK_MS = HEAVY_SLICES_MS.length * HEAVY_SLICE_COST_MS;
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  top: 12 + ((i * 37) % 140),
  left: 8 + ((i * 53) % 86),
}));

type Mode = 'broken' | 'fixed';

export default function JankFix({ productionNote, method }: { productionNote: string; method?: string }) {
  const [open, setOpen] = useState(false);
  const [lastRun, setLastRun] = useState('');
  const modeRef = useRef<Mode>('fixed');
  const openRef = useRef(false);
  const sideRef = useRef<HTMLDivElement>(null);
  const manualRun = useRef<AbortController | null>(null);

  useEffect(() => () => manualRun.current?.abort(), []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const toggle = async (signal?: AbortSignal): Promise<FrameReport> => {
    if (signal?.aborted) return analyzeFrames([]);
    const opening = !openRef.current;
    openRef.current = opening;
    const frames = recordFrames(MEASURE_MS, signal);
    setOpen(opening);
    if (modeRef.current === 'broken') {
      const timers = HEAVY_SLICES_MS.map((delay) => setTimeout(() => busyWait(HEAVY_SLICE_COST_MS), delay));
      signal?.addEventListener('abort', () => timers.forEach(clearTimeout), { once: true });
    } else {
      // The deferred work runs exactly once: when the transition ends, or after it should have ended if
      // transitionend never fires (transitions disabled or interrupted). Whichever comes first removes the
      // other, and aborting removes both.
      const side = sideRef.current!;
      const afterTransition = () => {
        clearTimeout(fallback);
        side.removeEventListener('transitionend', afterTransition);
        void runWhenIdle(HEAVY_WORK_MS, 4, signal);
      };
      side.addEventListener('transitionend', afterTransition);
      const fallback = setTimeout(afterTransition, TRANSITION_MS + 100);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(fallback);
          side.removeEventListener('transitionend', afterTransition);
        },
        { once: true },
      );
    }
    const report = analyzeFrames(await frames);
    setLastRun(
      report.enough
        ? `Last run: ~${report.dropped} dropped frames, longest frame ${Math.round(report.longestMs)} ms`
        : 'Last run: not enough frames sampled',
    );
    return report;
  };

  const measure = async (mode: Mode, signal: AbortSignal): Promise<Measurement> => {
    manualRun.current?.abort();
    modeRef.current = mode;
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      await new Promise((r) => setTimeout(r, TRANSITION_MS + 150));
    }
    const { dropped, longestMs, frameMs, enough } = await toggle(signal);
    return {
      value: dropped,
      unit: 'frames',
      display: `${dropped} frames`,
      // Short on purpose: the result line has a reserved height, so the card never shifts the page.
      detail: enough
        ? `longest frame ${Math.round(longestMs)} ms · est. at ${frameMs.toFixed(1)} ms/frame`
        : 'not enough frames sampled',
      supported: enough,
    };
  };

  const status = useStore($statuses, { keys: ['jank'] }).jank;
  const measuring = status === 'breaking' || status === 'fixing';

  useFixLifecycle('jank', {
    break: (signal) => measure('broken', signal),
    fix: (signal) => measure('fixed', signal),
  });

  return (
    <FixCard
      id="jank"
      method={method}
      number="02"
      area="rendering"
      title="A sidebar that stutters"
      description="Opening the sidebar resizes the graph. Broken: heavy work runs during the animation. Fixed: the work waits until the transition ends, then runs in small idle chunks."
      measureLabel={{ before: 'dropped frames', after: 'dropped frames' }}
      productionNote={productionNote}
      actions={
        <button
          type="button"
          className="btn btn--sm"
          disabled={measuring}
          onClick={() => {
            manualRun.current?.abort();
            const controller = new AbortController();
            manualRun.current = controller;
            void toggle(controller.signal);
          }}
        >
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
