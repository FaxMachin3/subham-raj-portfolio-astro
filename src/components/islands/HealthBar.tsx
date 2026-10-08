import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $jsBytes, $session } from '@/stores/fixes';
import { observeLayoutShifts, observeLongTasks, support } from '@/lab/observers';
import { requestsInLast } from '@/lab/requests';
import { formatKB } from '@/lab/format';
import { useHydrated } from '@/lib/useHydrated';

type Level = 'good' | 'warn' | 'bad' | 'na';

function Cell({
  long,
  short,
  value,
  level,
  optional,
}: {
  long: string;
  short: string;
  value: string;
  level: Level;
  optional?: boolean;
}) {
  return (
    <div className={`hud__cell${optional ? ' hud__cell--optional' : ''}`} data-level={level}>
      <small>
        <span className="hud__long">{long}</span>
        <span className="hud__short">{short}</span>
      </small>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Sums values reported by an observer during the current session. Totals are stored with the session
 * they belong to, so starting a new session reads as zero without resetting state in an effect.
 */
function useSessionTotal(session: number, observe: (add: (value: number) => void) => () => void): number {
  const [total, setTotal] = useState({ session, value: 0 });
  useEffect(
    () =>
      observe((value) =>
        setTotal((prev) =>
          prev.session === session ? { session, value: prev.value + value } : { session, value },
        ),
      ),
    // `observe` is a stable call-site lambda; re-subscribing per session is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  );
  return total.session === session ? total.value : 0;
}

const HUD_KEY = 'hud';

/**
 * Live page health. Every value is measured in this tab: nothing is shown until there is a real sample,
 * and unsupported metrics say "n/a". It can be collapsed so it never covers content.
 */
export default function HealthBar() {
  const hydrated = useHydrated();
  const session = useStore($session);
  const jsBytes = useStore($jsBytes);
  const [fps, setFps] = useState<number | null>(null);
  const [reqLastMinute, setReqLastMinute] = useState(0);
  // The head script applies a saved preference before first paint; once hydrated, read it from <html>.
  const [choice, setChoice] = useState<boolean | null>(null);
  const collapsed = choice ?? (hydrated && document.documentElement.dataset.hud === 'collapsed');

  const toggle = () => {
    const next = !collapsed;
    setChoice(next);
    if (next) document.documentElement.dataset.hud = 'collapsed';
    else delete document.documentElement.dataset.hud;
    try {
      if (next) localStorage.setItem(HUD_KEY, 'collapsed');
      else localStorage.removeItem(HUD_KEY);
    } catch {
      // Storage unavailable: the choice lasts for this page view.
    }
  };

  // Frames per second from animation-frame timestamps over ~0.5 s windows, uncapped (120 Hz screens show
  // 120). Paused while the tab is hidden, where browsers throttle frames and any reading would be false.
  useEffect(() => {
    let frames = 0;
    let since: number | null = null;
    let raf = 0;
    const tick = (now: number) => {
      if (since === null) {
        since = now;
      } else {
        frames++;
        if (now - since >= 500) {
          setFps(Math.round((frames * 1000) / (now - since)));
          frames = 0;
          since = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      frames = 0;
      since = null;
      if (document.hidden) setFps(null);
      else raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const longTasks = useSessionTotal(session, (add) => observeLongTasks(() => add(1)));
  const shift = useSessionTotal(session, (add) => observeLayoutShifts((value) => add(value)));

  // A real count of demo requests in the last 60 seconds, not an extrapolation.
  useEffect(() => {
    const timer = setInterval(() => setReqLastMinute(requestsInLast(60_000)), 500);
    return () => clearInterval(timer);
  }, []);

  const level = (value: number, warn: number, bad: number): Level =>
    value >= bad ? 'bad' : value >= warn ? 'warn' : 'good';

  return (
    <aside
      className="hud"
      aria-label="Live page health, measured in this tab since the last full break or fix run"
      data-testid="hud"
    >
      <div className="hud__label">
        <small>live</small>page health
      </div>
      <div className="hud__cells" id="hud-cells">
        <Cell
          long="FPS"
          short="FPS"
          value={fps === null ? '–' : String(fps)}
          level={fps === null ? 'na' : fps >= 50 ? 'good' : fps >= 30 ? 'warn' : 'bad'}
        />
        <Cell
          long="Long tasks"
          short="Tasks"
          value={!hydrated ? '–' : support.longTask ? String(longTasks) : 'n/a'}
          level={hydrated && support.longTask ? level(longTasks, 1, 1) : 'na'}
        />
        <Cell
          long="Layout shift"
          short="Shift"
          value={!hydrated ? '–' : support.layoutShift ? shift.toFixed(2) : 'n/a'}
          level={hydrated && support.layoutShift ? level(shift, 0.02, 0.1) : 'na'}
        />
        <Cell
          long="Demo JS"
          short="JS"
          value={formatKB(jsBytes)}
          level={level(jsBytes, 100 * 1024, 300 * 1024)}
          optional
        />
        <Cell
          long="Req · last min"
          short="Req/min"
          value={String(reqLastMinute)}
          level={level(reqLastMinute, 20, 120)}
        />
      </div>
      <button
        type="button"
        className="hud__toggle"
        aria-expanded={!collapsed}
        aria-controls="hud-cells"
        aria-label={collapsed ? 'Show page health' : 'Hide page health'}
        onClick={toggle}
      >
        {collapsed ? 'Show' : 'Hide'}
      </button>
    </aside>
  );
}
