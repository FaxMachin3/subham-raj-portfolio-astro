import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $prState,
  $ready,
  $statuses,
  allReady,
  requestTarget,
  startSession,
  waitForStatus,
} from '@/stores/fixes';
import { BREAK_ORDER, FIX_META, FIX_ORDER } from '@/fixes/registry';
import { FIX_IDS } from '@/fixes/types';
import { clearRequestLog } from '@/lab/requests';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useHydrated } from '@/lib/useHydrated';

const STAGGER_MS = 220;
const BETWEEN_FIXES_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Toast {
  title: string;
  body?: string;
  tone: 'info' | 'warn';
}

export default function BreakFixControls() {
  const hydrated = useHydrated();
  const ready = allReady(useStore($ready)) && hydrated;
  const statuses = useStore($statuses);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'breaking' | 'broken' | 'fixing'>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = (title: string, body?: string, tone: Toast['tone'] = 'info') => {
    setToast({ title, body, tone });
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 5200);
  };

  // Reflect the overall state on <html> so static content (the hero headline) can react in CSS.
  const anyBroken = FIX_IDS.some((id) => statuses[id] === 'broken' || statuses[id] === 'breaking');
  useEffect(() => {
    document.documentElement.dataset.site = anyBroken ? 'broken' : 'healthy';
  }, [anyBroken]);

  const breakAll = async () => {
    setPhase('breaking');
    startSession();
    clearRequestLog();
    $prState.set('open');
    notify('⚠ Breaking the site.', 'The graph will freeze the page for about 1.5 s on purpose.', 'warn');
    for (const id of BREAK_ORDER) {
      if (id === 'plot') continue;
      requestTarget(id, 'broken');
      await sleep(STAGGER_MS);
    }
    await sleep(500);
    requestTarget('plot', 'broken');
    await Promise.all(BREAK_ORDER.map((id) => waitForStatus(id, 'broken')));
    setPhase('broken');
    notify('Site broken.', 'Every card is measured. Press “Let Subham fix it”.', 'warn');
  };

  const fixAll = async () => {
    setPhase('fixing');
    startSession();
    clearRequestLog();
    $prState.set('open');
    for (const [index, id] of FIX_ORDER.entries()) {
      const step = `${index + 1}/${FIX_ORDER.length}`;
      notify(`Fixing ${step}`, FIX_META[id].commit, 'warn');
      requestTarget(id, 'fixed');
      await waitForStatus(id, 'fixed');
      notify(`✓ ${step}`, FIX_META[id].commit);
      await sleep(BETWEEN_FIXES_MS);
    }
    $prState.set('merged');
    setPhase('idle');
    notify('PR #581 merged.', 'Every number above was measured on your device.');
  };

  const running = phase === 'breaking' || phase === 'fixing';
  const breakDisabled = !ready || reducedMotion || running;
  const fixDisabled = !ready || running || !anyBroken;

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
        {!ready && <span className="controls__note">Loading the demos…</span>}
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
        </div>
      </div>
    </>
  );
}
