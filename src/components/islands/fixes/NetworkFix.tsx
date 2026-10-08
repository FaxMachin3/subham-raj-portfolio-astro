import { useCallback, useEffect, useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { countRequestsDuring, trackedFetch } from '@/lab/requests';
import { observeLayoutShifts, support } from '@/lab/observers';
import type { Measurement } from '@/fixes/types';

const ENTITY_COUNT = 24;
const MEASURE_MS = 6000;
const BROKEN_POLL_MS = 33;
const HEALTHY_POLL_MS = 20_000;
/** Broken polling is capped so a visitor who walks away never hammers the CDN. */
const BROKEN_POLL_LIMIT_MS = 20_000;
const BANNER_DELAY_MS = 900;

type Mode = 'broken' | 'fixed';
interface Entity {
  id: number;
  name?: string;
  risk?: string;
  /** The request failed (network, HTTP error or bad payload); the panel offers a retry. */
  failed?: boolean;
}

const isEntity = (data: unknown): data is Required<Omit<Entity, 'failed'>> =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as Entity).name === 'string' &&
  typeof (data as Entity).risk === 'string';

const emptyEntities = (): Entity[] => Array.from({ length: ENTITY_COUNT }, (_, i) => ({ id: i + 1 }));

export default function NetworkFix({ productionNote, method }: { productionNote: string; method?: string }) {
  const [mode, setMode] = useState<Mode>('fixed');
  const [entities, setEntities] = useState(emptyEntities);
  const [banner, setBanner] = useState<'hidden' | 'shown'>('hidden');
  const [pollRate, setPollRate] = useState(0);
  const [runId, setRunId] = useState(0);
  const [activated, setActivated] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const shiftRef = useRef(0);
  const visibleRef = useRef(false);
  const pollTimes = useRef<number[]>([]);
  const runRef = useRef(0);
  // Aborts the current run's panel requests when a new run starts or the card unmounts.
  const fetchesRef = useRef(new AbortController());
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadEntity = useCallback(async (id: number, run: number) => {
    const { signal } = fetchesRef.current;
    const update = (next: Entity) =>
      run === runRef.current && setEntities((prev) => prev.map((e) => (e.id === id ? next : e)));
    try {
      const response = await trackedFetch(`/data/entities/${id}.json`, { signal }, 'network');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isEntity(data)) throw new Error('Unexpected panel data');
      update({ id, name: data.name, risk: data.risk });
    } catch {
      if (!signal.aborted) update({ id, failed: true });
    }
  }, []);

  useEffect(() => {
    const stop = () => {
      fetchesRef.current.abort();
      clearTimeout(bannerTimer.current);
      setPollingActive(false);
    };
    addEventListener('pagehide', stop);
    return () => {
      removeEventListener('pagehide', stop);
      stop();
    };
  }, []);

  // Track whether the card is on screen: the late banner only appears while it is, so the shift is visible.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => (visibleRef.current = entry!.isIntersecting), {
      threshold: 0.3,
    });
    observer.observe(rootRef.current!);
    return () => observer.disconnect();
  }, []);

  // The panel observer below uses the list as its root, which ignores the page viewport, so hold it back
  // until the card is near the screen. Otherwise the healthy page fetches panels nobody can see.
  useEffect(() => {
    if (activated) return;
    const root = rootRef.current!;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setActivated(true), {
      rootMargin: '200px',
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [activated]);

  // Layout shifts caused inside this card.
  useEffect(
    () =>
      observeLayoutShifts((value, nodes) => {
        if (nodes.some((n) => rootRef.current!.contains(n))) shiftRef.current += value;
      }),
    [],
  );

  // Live polling rate, from the last two seconds of polls.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = performance.now();
      pollTimes.current = pollTimes.current.filter((t) => now - t < 2000);
      setPollRate(Math.round(pollTimes.current.length / 2));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // Fixed mode: fetch a panel only when it scrolls into the list's viewport.
  useEffect(() => {
    if (mode !== 'fixed' || !activated) return;
    const list = listRef.current!;
    const run = runRef.current;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          void loadEntity(Number((entry.target as HTMLElement).dataset.id), run);
        }),
      { root: list, rootMargin: '40px' },
    );
    list.querySelectorAll('[data-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, runId, activated, loadEntity]);

  // Status polling: frantic when broken (capped at 20 s), every 20 s when fixed. Paused when the tab is hidden.
  useEffect(() => {
    if (!pollingActive) return;
    const interval = mode === 'broken' ? BROKEN_POLL_MS : HEALTHY_POLL_MS;
    const startedAt = performance.now();
    const polls = new AbortController();
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (mode === 'broken' && performance.now() - startedAt > BROKEN_POLL_LIMIT_MS) return;
      pollTimes.current.push(performance.now());
      // A failed status check is still a request made; there is nothing to show for it.
      trackedFetch('/data/status.json', { cache: 'no-store', signal: polls.signal }, 'network').catch(
        () => {},
      );
    }, interval);
    return () => {
      clearInterval(timer);
      polls.abort();
    };
  }, [mode, runId, pollingActive]);

  /** Shows the late banner once the card is on screen. Stops when the run is aborted or the card unmounts. */
  const scheduleBanner = (signal: AbortSignal) => {
    const show = () => setBanner('shown');
    const wait = () => {
      bannerTimer.current = visibleRef.current ? setTimeout(show, BANNER_DELAY_MS) : setTimeout(wait, 250);
    };
    signal.addEventListener('abort', () => clearTimeout(bannerTimer.current), { once: true });
    wait();
  };

  const reset = (next: Mode) => {
    fetchesRef.current.abort();
    fetchesRef.current = new AbortController();
    clearTimeout(bannerTimer.current);
    runRef.current += 1;
    setRunId(runRef.current);
    setActivated(true);
    setPollingActive(true);
    shiftRef.current = 0;
    setBanner('hidden');
    setEntities(emptyEntities());
    setMode(next);
    listRef.current!.scrollTo({ top: 0 });
  };

  const run = async (next: Mode, signal: AbortSignal): Promise<Measurement> => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    reset(next);
    const fetches = fetchesRef.current;
    signal.addEventListener(
      'abort',
      () => {
        fetches.abort();
        clearTimeout(bannerTimer.current);
        setPollingActive(false);
      },
      { once: true },
    );
    const counting = countRequestsDuring(MEASURE_MS, signal, 'network');
    if (next === 'broken') {
      const thisRun = runRef.current;
      for (let id = 1; id <= ENTITY_COUNT; id++) void loadEntity(id, thisRun);
    }
    scheduleBanner(signal);
    const requests = await counting;
    const shift = support.layoutShift ? shiftRef.current.toFixed(3) : 'n/a';
    return {
      value: requests,
      unit: 'requests',
      display: `${requests} requests`,
      detail:
        next === 'broken'
          ? `layout shift ${shift} · all 24 panels + polling 30/s`
          : `layout shift ${shift} · visible panels · polling every 20 s`,
      supported: true,
    };
  };

  useFixLifecycle('network', {
    break: (signal) => run('broken', signal),
    fix: (signal) => run('fixed', signal),
  });

  const loaded = entities.filter((e) => e.name).length;

  return (
    <FixCard
      id="network"
      method={method}
      number="04"
      area="network"
      title="Requests nobody asked for"
      description="Broken: every panel fetches on load, a late banner shoves the layout, and a status check polls 30 times a second. Fixed: panels fetch as you scroll near them, space is reserved, and polling backs off."
      measureLabel={{ before: 'requests in 6 s', after: 'requests in 6 s' }}
      productionNote={productionNote}
    >
      <div ref={rootRef}>
        <div className={`late-slot${mode === 'fixed' ? ' late-slot--reserved' : ''}`}>
          {banner === 'shown' ? (
            <div className="late-banner">New: 3 alerts since your last visit</div>
          ) : (
            mode === 'fixed' && <div className="late-skeleton" aria-hidden="true" />
          )}
        </div>
        <ul className="entity-list" ref={listRef} tabIndex={0} aria-label="Entity panels, scrollable">
          {entities.map((entity) => (
            <li
              key={entity.id}
              data-id={entity.id}
              className={`entity${entity.name || entity.failed ? '' : ' entity--waiting skeleton'}`}
            >
              {entity.name ? (
                <>
                  <span>{entity.name}</span>
                  <span className="mono">{entity.risk}</span>
                </>
              ) : entity.failed ? (
                <>
                  <span>Couldn’t load panel {entity.id}</span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => void loadEntity(entity.id, runRef.current)}
                  >
                    Retry
                  </button>
                </>
              ) : (
                <span className="sr-only">Loading panel {entity.id}</span>
              )}
            </li>
          ))}
        </ul>
        {/* Holds the banner's height while it is missing, so the shove happens inside the demo, not to the page. */}
        {mode === 'broken' && banner === 'hidden' && <div className="late-spacer" aria-hidden="true" />}
        <div className="network-stats">
          <span>
            <span className={`pulse-dot${pollRate > 2 ? ' pulse-dot--hot' : ''}`} aria-hidden="true" />
            status polling: <strong>{pollRate}</strong> req/s
          </span>
          <span>
            panels fetched: <strong>{loaded}</strong>/{ENTITY_COUNT}
          </span>
        </div>
      </div>
    </FixCard>
  );
}
