import { useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { addJsBytes } from '@/stores/fixes';
import { recordRequest } from '@/lab/requests';
import { formatKB } from '@/lab/format';
import type { Measurement } from '@/fixes/types';

type DemoModule = { size(): number };
const routeLoaders = import.meta.glob<DemoModule>('../../../demos/routes/*.ts');
const loadCore = (): Promise<DemoModule> => import('../../../demos/core');

const ROUTES = Object.keys(routeLoaders)
  .map((path) => ({ name: path.split('/').pop()!.replace('.ts', ''), load: routeLoaders[path]! }))
  .sort((a, b) => a.name.localeCompare(b.name));

type RowState = 'idle' | 'eager' | 'lazy';
interface Row {
  state: RowState;
  bytes: number | null;
}

/**
 * Bytes the browser actually decoded for a chunk, from Resource Timing. Matches the hashed
 * production file (`graph.Ab12.js`) and the dev-server module (`/demos/routes/graph.ts`).
 */
function chunkBytes(name: string): number | null {
  const pattern = new RegExp(`/${name}(\\.[\\w-]+)?\\.(js|ts)(\\?|$)`);
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const entry = entries.filter((e) => pattern.test(e.name)).pop();
  const bytes = entry ? entry.decodedBodySize || entry.encodedBodySize : 0;
  return bytes > 0 ? bytes : null;
}

const initialRows = (): Record<string, Row> =>
  Object.fromEntries(
    ['core', ...ROUTES.map((r) => r.name)].map((n) => [n, { state: 'idle' as RowState, bytes: null }]),
  );

export default function BundleFix({ productionNote }: { productionNote: string }) {
  const [rows, setRows] = useState(initialRows);
  const [mode, setMode] = useState<'broken' | 'fixed' | null>(null);

  const load = async (name: string, loader: () => Promise<DemoModule>, state: RowState) => {
    recordRequest();
    const mod = await loader();
    mod.size(); // keep the module honest: its payload is actually used
    const bytes = chunkBytes(name);
    if (bytes) addJsBytes(bytes);
    setRows((prev) => ({ ...prev, [name]: { state, bytes } }));
    return bytes;
  };

  const measurement = (bytes: (number | null)[], detail: string): Measurement => {
    const supported = bytes.every((b) => b !== null);
    const total = bytes.reduce<number>((sum, b) => sum + (b ?? 0), 0);
    return { value: total, unit: 'bytes', display: formatKB(total), detail, supported };
  };

  useFixLifecycle('bundle', {
    async break() {
      setMode('broken');
      setRows(initialRows());
      const sizes = await Promise.all([
        load('core', loadCore, 'eager'),
        ...ROUTES.map((r) => load(r.name, r.load, 'eager')),
      ]);
      return measurement(sizes, `${sizes.length} scripts before anything works`);
    },
    async fix() {
      setMode('fixed');
      setRows(initialRows());
      const core = await load('core', loadCore, 'eager');
      return measurement([core], 'core only · each route loads on first visit');
    },
  });

  const maxBytes = Math.max(1, ...Object.values(rows).map((r) => r.bytes ?? 0));

  return (
    <FixCard
      id="bundle"
      number="03"
      area="loading"
      title="Every route, shipped up front"
      description="Broken: all route code loads before anything works. Fixed: only the core loads; each route’s code loads the first time you open it."
      measureLabel={{ before: 'JS on load', after: 'JS on load' }}
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
            return (
              <button
                key={route.name}
                type="button"
                className="btn btn--sm"
                disabled={loaded}
                onClick={() => void load(route.name, route.load, 'lazy')}
              >
                {loaded
                  ? `${route.name} · ${row?.bytes ? formatKB(row.bytes) : 'loaded'}`
                  : `Open ${route.name}`}
              </button>
            );
          })}
      </div>
    </FixCard>
  );
}
