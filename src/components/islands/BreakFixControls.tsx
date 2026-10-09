import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $prState,
  $ready,
  $runActive,
  $statuses,
  allReady,
  cancelInProgress,
  requestTarget,
  startSession,
  waitForStatus,
} from '@/stores/fixes';
import { BREAK_ORDER, FIX_META, FIX_ORDER, HERO_WORDS } from '@/fixes/registry';
import { FIX_IDS, type FixId, type FixStatus } from '@/fixes/types';
import { clearRequestLog } from '@/lab/requests';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useHydrated } from '@/lib/useHydrated';

const STAGGER_MS = 260;
// Long enough to read the commit; the measurements themselves set the rest of the pace.
const BETWEEN_FIXES_MS = 400;
const MERGED_GLOW_MS = 1600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = 'idle' | 'breaking' | 'broken' | 'fixing' | 'fixed';
type StepState = 'pending' | 'active' | 'done' | 'failed';

interface Toast {
  title: string;
  body?: string;
  tone: 'info' | 'warn';
}

interface Progress {
  mode: 'break' | 'fix';
  order: readonly FixId[];
  steps: Partial<Record<FixId, StepState>>;
}

const stepText = (verb: string, index: number, order: readonly FixId[], id: FixId) =>
  `${verb} ${index + 1} of ${order.length} · ${FIX_META[id].label}`;

/** Anything short of healthy or fixed: a failed or cancelled run still needs fixing. */
const isBroken = (status: FixStatus) => status !== 'healthy' && status !== 'fixed';

const STATUS_WORD: Record<FixStatus, string> = {
  healthy: 'healthy',
  breaking: 'breaking',
  broken: 'broken',
  fixing: 'fixing',
  fixed: 'fixed',
  failed: 'failed',
  cancelled: 'cancelled',
};

export default function BreakFixControls() {
  const hydrated = useHydrated();
  const ready = allReady(useStore($ready)) && hydrated;
  const statuses = useStore($statuses);
  const reducedMotion = useReducedMotion();
  const pr = useStore($prState);
  const [phase, setPhase] = useState<Phase>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  // The step a run is on, for the line in the controls. Separate from the toast, which hides on a timer.
  const [runStep, setRunStep] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The current whole-site run. Aborting it stops the controller waiting; cards are cancelled separately.
  const runRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const notify = (title: string, body?: string, tone: Toast['tone'] = 'info', holdMs = 5200) => {
    setToast({ title, body, tone });
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastVisible(false);
      setProgress(null);
    }, holdMs);
  };

  const step = (id: FixId, state: StepState) =>
    setProgress((p) => (p ? { ...p, steps: { ...p.steps, [id]: state } } : p));

  const anyBroken = FIX_IDS.some((id) => isBroken(statuses[id]));

  // Mirror the run on <html> so static content can react in CSS: the brand dot follows the whole site,
  // and each hero word breaks and heals with the fixes behind it.
  const siteState = phase === 'idle' ? (anyBroken ? 'broken' : 'healthy') : phase;
  const wordStates = Object.entries(HERO_WORDS).map(
    ([word, ids]) => [word, ids.some((id) => isBroken(statuses[id])) ? 'broken' : 'healed'] as const,
  );
  const wordKey = wordStates.map(([w, s]) => `${w}:${s}`).join(',');

  useEffect(() => {
    document.documentElement.dataset.site = siteState;
  }, [siteState]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [word, state] of wordStates) {
      // "healed" only after a break, so the healing animation never plays on first load.
      if (state === 'broken' || root.dataset[word]) root.dataset[word] = state;
    }
    // wordStates is derived from wordKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordKey]);

  // Only one run at a time: both buttons, and every card's own buttons, are disabled while one is active.
  const beginRun = () => {
    runIdRef.current++;
    runRef.current = new AbortController();
    $runActive.set(true);
    return runRef.current.signal;
  };

  const endRun = () => {
    runRef.current = null;
    $runActive.set(false);
  };

  /** Stops the run and every card still changing; finished cards keep their state. */
  const stopRun = () => {
    cancelInProgress();
    if (!runRef.current) return;
    runRef.current.abort();
    endRun();
    setPhase('idle');
  };

  // Only offered while a run is active.
  const cancelRun = () => {
    stopRun();
    notify('Run cancelled.', 'Demos that were mid-change show Cancelled. Start again any time.', 'warn');
  };

  /** Leaving the page (or unmounting) abandons the run: obsolete work stops instead of finishing unseen. */
  useEffect(() => {
    const abandon = () => {
      clearTimeout(toastTimer.current);
      stopRun();
    };
    addEventListener('pagehide', abandon);
    return () => {
      removeEventListener('pagehide', abandon);
      abandon();
    };
    // stopRun only touches refs, stores and state setters, so the first render's copy stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endRunWithFailure = (ids: readonly FixId[], action: 'break' | 'fix') => {
    for (const id of ids) step(id, 'failed');
    const names = ids.map((id) => FIX_META[id].label).join(', ');
    setPhase('idle');
    endRun();
    notify(
      action === 'break' ? 'Some demos didn’t break.' : 'A fix didn’t complete.',
      `${names}: ${action === 'break' ? 'press “Break this site”' : 'press “Let Subham fix it”'} to try again.`,
      'warn',
      8000,
    );
  };

  const breakAll = async () => {
    const signal = beginRun();
    setPhase('breaking');
    startSession();
    clearRequestLog();
    $prState.set('open');
    setProgress({ mode: 'break', order: BREAK_ORDER, steps: {} });
    notify('⚠ Breaking the site.', 'The graph will freeze the page for a second or two, on purpose.', 'warn');
    for (const [index, id] of BREAK_ORDER.entries()) {
      if (id === 'plot') continue;
      setRunStep(stepText('Breaking', index, BREAK_ORDER, id));
      requestTarget(id, 'broken', { quick: true });
      step(id, 'done');
      await sleep(STAGGER_MS);
      if (signal.aborted) return;
    }
    await sleep(400);
    if (signal.aborted) return;
    step('plot', 'active');
    setRunStep(stepText('Breaking', BREAK_ORDER.indexOf('plot'), BREAK_ORDER, 'plot'));
    requestTarget('plot', 'broken', { quick: true });
    const outcomes = await Promise.all(BREAK_ORDER.map((id) => waitForStatus(id, 'broken', signal)));
    if (signal.aborted) return;
    const failed = BREAK_ORDER.filter((_, i) => outcomes[i] !== 'broken');
    if (failed.length) return endRunWithFailure(failed, 'break');
    step('plot', 'done');
    endRun();
    setPhase('broken');
    notify(
      'Site broken. Six issues, all measured.',
      'Scroll to see the damage, or press “Let Subham fix it”.',
      'warn',
    );
  };

  const fixAll = async () => {
    const signal = beginRun();
    const runId = runIdRef.current;
    setPhase('fixing');
    startSession();
    clearRequestLog();
    $prState.set('open');
    setProgress({ mode: 'fix', order: FIX_ORDER, steps: {} });
    for (const [index, id] of FIX_ORDER.entries()) {
      const count = `${index + 1}/${FIX_ORDER.length}`;
      step(id, 'active');
      setRunStep(stepText('Fixing', index, FIX_ORDER, id));
      notify(`Commit ${count}`, FIX_META[id].commit, 'warn');
      requestTarget(id, 'fixed', { quick: true });
      const outcome = await waitForStatus(id, 'fixed', signal);
      if (signal.aborted) return;
      if (outcome !== 'fixed') return endRunWithFailure([id], 'fix');
      step(id, 'done');
      notify(`✓ Commit ${count}`, FIX_META[id].commit);
      await sleep(BETWEEN_FIXES_MS);
      if (signal.aborted) return;
    }
    // Merged only if every demo really ended fixed, whatever happened to it during the run.
    const final = $statuses.get();
    const unfinished = FIX_ORDER.filter((id) => final[id] !== 'fixed');
    if (unfinished.length) return endRunWithFailure(unfinished, 'fix');
    endRun();
    $prState.set('merged');
    setPhase('fixed');
    notify('PR #581 merged.', 'Every demo number was measured on your device.', 'info', 6000);
    await sleep(MERGED_GLOW_MS);
    if (!signal.aborted && runId === runIdRef.current) setPhase('idle');
  };

  const running = phase === 'breaking' || phase === 'fixing';

  const breakDisabled = !ready || reducedMotion || running;
  const fixDisabled = !ready || running || !anyBroken;

  const next = !ready ? (
    <span>Loading the demos…</span>
  ) : phase === 'broken' ? (
    <a href="#fix-cards">See what broke ↓</a>
  ) : pr === 'merged' && !anyBroken ? (
    <a href="#results">See your results ↓</a>
  ) : null;

  return (
    <>
      <div className="controls">
        <button
          type="button"
          className="btn btn--break"
          disabled={breakDisabled}
          onClick={() => void breakAll()}
        >
          {phase === 'breaking' ? 'Breaking…' : 'Break this site'}
        </button>
        <button type="button" className="btn btn--fix" disabled={fixDisabled} onClick={() => void fixAll()}>
          {phase === 'fixing' ? 'Fixing…' : 'Let Subham fix it'}
        </button>
        {/* Always rendered with a reserved height, so its message can change without shifting the page. */}
        <p className="controls__next" data-testid="controls-next">
          {running ? (
            <>
              {/* Not a live region: the toast announces each commit, so this isn't heard twice. */}
              <span data-testid="run-step">{runStep}</span>
              <button type="button" className="controls__cancel" onClick={cancelRun}>
                Cancel run
              </button>
            </>
          ) : (
            next
          )}
        </p>
        {/* Each demo's state at a glance, next to the buttons that change it. Cards announce changes. */}
        <ul className="controls__status" aria-label="Demo status">
          {FIX_ORDER.map((id) => (
            <li key={id} data-status={statuses[id]}>
              <span className="controls__dot" aria-hidden="true" />
              {FIX_META[id].label}
              <span className="sr-only">: {STATUS_WORD[statuses[id]]}</span>
            </li>
          ))}
        </ul>
        {reducedMotion && (
          <span className="controls__note">
            Breaking is turned off because you prefer reduced motion. Each fix and its explanation is still
            below.
          </span>
        )}
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        <div
          className={`toast${toastVisible ? ' toast--visible' : ''}${toast?.tone === 'warn' ? ' toast--warn' : ''}`}
        >
          {toast && (
            <>
              <strong>{toast.title}</strong> {toast.body}
            </>
          )}
          {progress && (
            <ol className={`toast__steps toast__steps--${progress.mode}`} aria-hidden="true">
              {progress.order.map((id) => (
                <li key={id} data-state={progress.steps[id] ?? 'pending'} title={FIX_META[id].label} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
