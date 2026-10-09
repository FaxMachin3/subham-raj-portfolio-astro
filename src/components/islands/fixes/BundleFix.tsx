import { useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { addJsBytes } from '@/stores/fixes';
import { importCounted } from '@/lab/requests';
import { formatKB } from '@/lab/format';
import { bundleMeasurement, chunkBytes, chunkPattern, resourceEntries } from '@/lab/resources';

type DemoModule = { size(): number };
const routeLoaders = import.meta.glob<DemoModule>('../../../demos/routes/*.ts');
const loadCore = (): Promise<DemoModule> => import('../../../demos/core');

const ROUTES = Object.keys(routeLoaders)
  .map((path) => ({ name: path.split('/').pop()!.replace('.ts', ''), load: routeLoaders[path]! }))
  .sort((a, b) => a.name.localeCompare(b.name));

type RowState = 'idle' | 'eager' | 'lazy';
type RouteLoad = 'loading' | 'error';
interface Row {
  state: RowState;
  bytes: number | null;
}

const initialRows = (): Record<string, Row> =>
  Object.fromEntries(
    ['core', ...ROUTES.map((r) => r.name)].map((n) => [n, { state: 'idle' as RowState, bytes: null }]),
  );

export default function BundleFix({ productionNote, method }: { productionNote: string; method?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [mode, setMode] = useState<'broken' | 'fixed' | null>(null);
  const [routeLoads, setRouteLoads] = useState<Record<string, RouteLoad>>({});
  // Bumped by every break, fix or abort: a load that finishes after its run was replaced changes nothing.
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const routeSources = useRef(new Map<string, { url: string; failed: boolean }>());
  const retryId = useRef(0);

  // Browsers cache rejected imports. Retry the same built asset with a fresh URL; remember successful
  // retry URLs too, so later runs reuse the module instead of returning to the poisoned original URL.
  const importRoute = async (route: (typeof ROUTES)[number]): Promise<DemoModule> => {
    const source = routeSources.current.get(route.name);
    let url: URL | undefined;
    if (source) {
      url = new URL(source.url);
      if (source.failed) url.searchParams.set('retry', String(++retryId.current));
    }
    try {
      const module = url ? await import(/* @vite-ignore */ url.href) : await route.load();
      if (url) routeSources.current.set(route.name, { url: url.href, failed: false });
      return module;
    } catch (error) {
      const entry = resourceEntries()
        .filter((entry) => chunkPattern(route.name).test(entry.name))
        .at(-1);
      const failedUrl = url ?? (entry ? new URL(entry.name) : undefined);
      if (failedUrl?.origin === location.origin)
        routeSources.current.set(route.name, { url: failedUrl.href, failed: true });
      throw error;
    }
  };

  /** Loads one chunk; its size is the decoded script size, also reported when it came from memory. */
  const load = async (
    name: string,
    loader: () => Promise<DemoModule>,
    state: RowState,
    run = generation.current,
  ) => {
    const { result: mod, fetched } = await importCounted(name, loader);
    mod.size(); // keep the module honest: its payload is actually used
    const bytes = chunkBytes(name, resourceEntries());
    if (run !== generation.current) return { bytes, fetched, stale: true };
    if (bytes && fetched) addJsBytes(bytes);
    setRows((prev) => ({ ...prev, [name]: { state, bytes } }));
    return { bytes, fetched, stale: false };
  };

  const startRun = (next: 'broken' | 'fixed', signal: AbortSignal) => {
    const run = ++generation.current;
    signal.addEventListener('abort', () => generation.current++, { once: true });
    inFlight.current.clear();
    setRouteLoads({});
    setMode(next);
    setRows(initialRows());
    return run;
  };

  const settleRoute = (name: string, state: RouteLoad | null) =>
    setRouteLoads((prev) => {
      const next = { ...prev };
      if (state) next[name] = state;
      else delete next[name];
      return next;
    });

  /** Opens a route by hand: one request per route at a time, a retry after a failure, nothing once stale. */
  const openRoute = async (route: (typeof ROUTES)[number]) => {
    if (inFlight.current.has(route.name)) return;
    const run = generation.current;
    inFlight.current.add(route.name);
    settleRoute(route.name, 'loading');
    try {
      const { stale } = await load(route.name, () => importRoute(route), 'lazy', run);
      if (!stale) settleRoute(route.name, null);
    } catch {
      if (run === generation.current) settleRoute(route.name, 'error');
    } finally {
      if (run === generation.current) inFlight.current.delete(route.name);
    }
  };

  // Short on purpose: the result line has a reserved height, so the card never shifts the page.
  const describe = (loads: readonly { fetched: boolean }[], what: string) =>
    loads.some((l) => l.fetched) ? what : `${what} · from memory`;

  useFixLifecycle('bundle', {
    async break(signal) {
      const run = startRun('broken', signal);
      const loads = await Promise.all([
        load('core', loadCore, 'eager', run),
        ...ROUTES.map((r) => load(r.name, () => importRoute(r), 'eager', run)),
      ]);
      return bundleMeasurement(
        loads.map((l) => l.bytes),
        describe(loads, `${loads.length} scripts before anything works`),
      );
    },
    async fix(signal) {
      const run = startRun('fixed', signal);
      const core = await load('core', loadCore, 'eager', run);
      return bundleMeasurement([core.bytes], describe([core], 'core only · each route loads on first visit'));
    },
  });

  const maxBytes = Math.max(1, ...Object.values(rows).map((r) => r.bytes ?? 0));

  return (
    <FixCard
      id="bundle"
      method={method}
      number="03"
      area="loading"
      title="Every route, shipped up front"
      description="Broken: all route code loads before anything works. Fixed: only the core loads; each route’s code loads the first time you open it."
      measureLabel={{ before: 'JS needed to start', after: 'JS needed to start' }}
      productionNote={productionNote}
    >
      <div className="waterfall" role="list" aria-label="Scripts loaded">
        {Object.entries(rows).map(([name, row]) => (
          <div className="waterfall__row" role="listitem" data-state={row.state} key={name}>
            <span>{name}.js</span>
            <span className="waterfall__track" aria-hidden="true">
              <span
                className="waterfall__bar"
                style={{ width: row.bytes ? `${Math.max(4, (row.bytes / maxBytes) * 100)}%` : 0 }}
              />
            </span>
            <span className="waterfall__size">
              {row.bytes ? formatKB(row.bytes) : row.state === 'idle' ? '—' : 'n/a'}
            </span>
          </div>
        ))}
      </div>
      <div className="route-buttons">
        {mode === 'fixed' &&
          ROUTES.map((route) => {
            const row = rows[route.name];
            const loaded = row?.state === 'lazy';
            const pending = routeLoads[route.name];
            return (
              <button
                key={route.name}
                type="button"
                className="btn btn--sm"
                data-state={pending}
                disabled={loaded}
                aria-disabled={pending === 'loading' || undefined}
                aria-busy={pending === 'loading' || undefined}
                onClick={() => void openRoute(route)}
              >
                {loaded
                  ? `${route.name} · ${row?.bytes ? formatKB(row.bytes) : 'loaded'}`
                  : pending === 'loading'
                    ? `Opening ${route.name}…`
                    : pending === 'error'
                      ? `Retry ${route.name} · failed`
                      : `Open ${route.name}`}
              </button>
            );
          })}
      </div>
    </FixCard>
  );
}
