import { lazy, Suspense, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { $xray } from '@/xray/store';
import { $results, $statuses, requestTarget } from '@/stores/fixes';
import { FIX_META } from '@/fixes/registry';
import type { FixId, FixStatus, Measurement } from '@/fixes/types';
import { useReducedMotion } from '@/lib/useReducedMotion';

// Loaded on the first break or fix, so the x-rays add nothing to the initial page.
const XRay = lazy(() => import('./XRay'));

const STATUS_LABEL: Record<FixStatus, string> = {
  healthy: 'Healthy',
  breaking: 'Breaking…',
  broken: 'Broken',
  fixing: 'Fixing…',
  fixed: 'Fixed ✓',
};

interface FixCardProps {
  id: FixId;
  number: string;
  area: string;
  title: string;
  description: ReactNode;
  productionNote?: ReactNode;
  measureLabel: { before: string; after: string };
  wide?: boolean;
  /** Extra controls rendered next to Break/Fix (for example "Toggle sidebar"). */
  actions?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
}

function MetricBox({
  phase,
  label,
  measurement,
}: {
  phase: 'before' | 'after';
  label: string;
  measurement?: Measurement;
}) {
  const value = !measurement ? '—' : measurement.supported ? measurement.display : 'n/a';
  return (
    <div className={`metric metric--${phase}`}>
      <small>
        {phase === 'before' ? 'Before' : 'After'} · {label}
      </small>
      <strong data-testid={`metric-${phase}`}>{value}</strong>
      <span>{measurement ? measurement.detail : 'not measured yet'}</span>
    </div>
  );
}

export default function FixCard({
  id,
  number,
  area,
  title,
  description,
  productionNote,
  measureLabel,
  wide,
  actions,
  footnote,
  children,
}: FixCardProps) {
  const status = useStore($statuses, { keys: [id] })[id];
  const result = useStore($results, { keys: [id] })[id];
  const xray = useStore($xray, { keys: [id] })[id];
  const reducedMotion = useReducedMotion();
  const busy = status === 'breaking' || status === 'fixing';
  const breakBlocked = reducedMotion && FIX_META[id].motion;
  const titleId = `fix-${id}-title`;

  return (
    <article
      className={`fix-card${wide ? ' fix-card--wide' : ''}`}
      data-status={status}
      data-testid={`fix-${id}`}
      aria-labelledby={titleId}
    >
      <div className="fix-card__head">
        <span className="fix-card__kicker">
          fix {number} · {area}
        </span>
        <span className={`status-pill status-pill--${status}`} data-testid="status" aria-live="polite">
          {STATUS_LABEL[status]}
        </span>
      </div>
      <h3 id={titleId}>{title}</h3>
      <p className="fix-card__desc">{description}</p>
      <div className="fix-card__demo" data-demo-region>
        {children}
        {xray && (
          <Suspense fallback={null}>
            <XRay key={xray.nonce} id={id} request={xray} />
          </Suspense>
        )}
      </div>
      <div className="metrics">
        <MetricBox phase="before" label={measureLabel.before} measurement={result.before} />
        <MetricBox phase="after" label={measureLabel.after} measurement={result.after} />
      </div>
      <div className="fix-card__actions">
        {actions}
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy || breakBlocked}
          title={breakBlocked ? 'Skipped because you prefer reduced motion' : undefined}
          onClick={() => requestTarget(id, 'broken')}
        >
          Break
        </button>
        <button
          type="button"
          className="btn btn--sm btn--fix"
          disabled={busy}
          onClick={() => requestTarget(id, 'fixed')}
        >
          Fix
        </button>
        {/* Rendered even while empty: its space is reserved, so the first result doesn't push the page down. */}
        {footnote !== undefined && <span className="fix-card__note">{footnote}</span>}
      </div>
      {productionNote && <p className="fix-card__prod">{productionNote}</p>}
    </article>
  );
}
