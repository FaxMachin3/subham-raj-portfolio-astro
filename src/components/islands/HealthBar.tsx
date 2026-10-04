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

/** Live page health. Every value is measured in this tab; unsupported metrics say "n/a". */
export default function HealthBar() {
  const hydrated = useHydrated();
  const session = useStore($session);
  const jsBytes = useStore($jsBytes);
  const [fps, setFps] = useState(60);
  const [reqPerMin, setReqPerMin] = useState(0);

  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      if (now - since >= 500) {
        setFps(Math.min(60, Math.round((frames * 1000) / (now - since))));
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const longTasks = useSessionTotal(session, (add) => observeLongTasks(() => add(1)));
  const shift = useSessionTotal(session, (add) => observeLayoutShifts((value) => add(value)));

  useEffect(() => {
    const timer = setInterval(() => setReqPerMin(requestsInLast(5_000) * 12), 500);
    return () => clearInterval(timer);
  }, []);

  const level = (value: number, warn: number, bad: number): Level =>
    value >= bad ? 'bad' : value >= warn ? 'warn' : 'good';

  return (
    <aside className="hud" aria-label="Live page health, measured in your browser" data-testid="hud">
      <div className="hud__label">
        <small>live</small>page health
      </div>
      <Cell
        long="FPS"
        short="FPS"
        value={String(fps)}
        level={fps >= 50 ? 'good' : fps >= 30 ? 'warn' : 'bad'}
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
      <Cell long="Req/min" short="Req/min" value={String(reqPerMin)} level={level(reqPerMin, 20, 120)} />
    </aside>
  );
}
