import type { CSSProperties } from 'react';
import { useStore } from '@nanostores/react';
import { $prState, $results } from '@/stores/fixes';
import { FIX_IDS, type FixId, type Measurement } from '@/fixes/types';
import CountUp from './CountUp';

const LABELS: Record<FixId, string> = {
  plot: 'Plot matching',
  jank: 'Sidebar animation',
  bundle: 'JS on load',
  network: 'Requests in 6 s',
  a11y: 'Accessibility audit',
  i18n: 'Missing translations',
};

const show = (m?: Measurement) => (!m ? '—' : m.supported ? m.display : 'n/a');

export default function ResultsTable({ production }: { production: Record<FixId, string> }) {
  const results = useStore($results);
  const pr = useStore($prState);

  return (
    <>
      <div className="pr-line">
        <span className={`pr-badge pr-badge--${pr}`} data-testid="pr-badge">
          {pr === 'merged' ? 'Merged' : pr === 'open' ? 'Open' : 'Not started'}
        </span>
        <span>PR #581 · Let Subham fix it</span>
      </div>
      <div className="results-scroll" tabIndex={0} role="region" aria-label="Session results, scrollable">
        <table className={`results${pr === 'merged' ? ' results--merged' : ''}`}>
          <caption className="sr-only">
            Before and after measurements from this session, with production results
          </caption>
          <thead>
            <tr>
              <th scope="col">Fix</th>
              <th scope="col">Before (your device)</th>
              <th scope="col">After (your device)</th>
              <th scope="col">In production</th>
            </tr>
          </thead>
          <tbody>
            {FIX_IDS.map((id, i) => (
              <tr key={id} style={{ '--i': i } as CSSProperties}>
                <th scope="row">{LABELS[id]}</th>
                <td className="before">{show(results[id].before)}</td>
                <td className="after">
                  <CountUp text={show(results[id].after)} />
                </td>
                <td>{production[id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
