import { useRef, useState, type KeyboardEvent } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { auditRegion, type AuditReport } from '@/lab/audit';
import { afterNextPaint } from '@/lab/frames';
import type { Measurement } from '@/fixes/types';

const HEADERS = ['Address', 'Type', 'Risk'] as const;
const ROWS = [
  ['0x9f…a21', 'Exchange', 'Low'],
  ['0x3c…7e0', 'Mixer', 'High'],
  ['0x71…b4d', 'OTC desk', 'Medium'],
] as const;
const MOVES: Record<string, [number, number]> = {
  arrowup: [-1, 0],
  w: [-1, 0],
  arrowdown: [1, 0],
  s: [1, 0],
  arrowleft: [0, -1],
  a: [0, -1],
  arrowright: [0, 1],
  d: [0, 1],
};

const toMeasurement = (r: AuditReport): Measurement => ({
  value: r.reachable,
  unit: 'audit',
  display: `${r.reachable}/${r.interactive} reachable`,
  detail: `${r.unlabeled} unlabeled · text contrast ${r.contrast.toFixed(1)}:1`,
  supported: true,
});

/** The intentionally inaccessible panel: clickable divs, no focus, an unlabeled icon, faint text. */
function BrokenPanel() {
  const noop = () => {};
  return (
    <>
      <div className="a11y-demo__bar">
        <div className="a11y-demo__ctl" data-interactive onClick={noop}>
          Filter
        </div>
        <div className="a11y-demo__ctl" data-interactive onClick={noop}>
          Export
        </div>
        <div className="a11y-demo__ctl" data-interactive onClick={noop}>
          ⋯
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {HEADERS.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row[0]}>
              {row.map((cell) => (
                <td key={cell} data-interactive onClick={noop}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-audit-text>Three addresses linked to a flagged entity.</p>
    </>
  );
}

function FixedPanel({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const tableRef = useRef<HTMLTableElement>(null);

  const focusCell = (row: number, col: number) => {
    setActive([row, col]);
    const cell = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`);
    cell?.focus();
    onAnnounce(`Row ${row + 1}, ${HEADERS[col]}: ${ROWS[row]![col]}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const move = MOVES[event.key.toLowerCase()];
    if (!move) return;
    event.preventDefault();
    const [row, col] = active;
    focusCell(
      Math.max(0, Math.min(ROWS.length - 1, row + move[0])),
      Math.max(0, Math.min(HEADERS.length - 1, col + move[1])),
    );
  };

  return (
    <>
      <div className="a11y-demo__bar" role="toolbar" aria-label="Table actions">
        <button type="button" className="a11y-demo__ctl" data-interactive>
          Filter
        </button>
        <button type="button" className="a11y-demo__ctl" data-interactive>
          Export
        </button>
        <button type="button" className="a11y-demo__ctl" data-interactive aria-label="More actions">
          ⋯
        </button>
      </div>
      <table
        ref={tableRef}
        onKeyDown={onKeyDown}
        aria-label="Linked addresses. Use arrow keys or W, A, S, D to move between cells."
      >
        <thead>
          <tr>
            {HEADERS.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={row[0]}>
              {row.map((cell, c) => (
                <td
                  key={cell}
                  data-interactive
                  data-cell={`${r}-${c}`}
                  tabIndex={active[0] === r && active[1] === c ? 0 : -1}
                  onClick={() => focusCell(r, c)}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-audit-text>Three addresses linked to a flagged entity.</p>
    </>
  );
}

export default function A11yFix({ productionNote }: { productionNote: string }) {
  const [variant, setVariant] = useState<'broken' | 'fixed'>('fixed');
  const [announcement, setAnnouncement] = useState('');
  const regionRef = useRef<HTMLDivElement>(null);

  const audit = async (next: 'broken' | 'fixed') => {
    setVariant(next);
    await afterNextPaint();
    return toMeasurement(auditRegion(regionRef.current!));
  };

  useFixLifecycle('a11y', {
    break: () => audit('broken'),
    fix: () => audit('fixed'),
  });

  return (
    <FixCard
      id="a11y"
      number="05"
      area="accessibility"
      title="A panel only mouse users can use"
      description="Broken: clickable divs, no focus ring, an unlabeled icon, faint text. Fixed: real buttons, labels, visible focus, readable contrast, and a table you can drive with arrow keys or WASD."
      measureLabel={{ before: 'live audit', after: 'live audit' }}
      productionNote={productionNote}
    >
      <div
        ref={regionRef}
        className={`a11y-demo a11y-demo--${variant}`}
        data-testid="a11y-region"
        aria-describedby="a11y-note"
      >
        {variant === 'broken' ? <BrokenPanel /> : <FixedPanel onAnnounce={setAnnouncement} />}
      </div>
      <p id="a11y-note" className="sr-only">
        In the broken state this demo panel is intentionally inaccessible. The Fix button below always works.
      </p>
      <p className="sr-only" aria-live="polite" data-testid="a11y-live">
        {announcement}
      </p>
    </FixCard>
  );
}
