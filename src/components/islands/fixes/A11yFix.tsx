import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import FixCard from '../FixCard';
import Menu from '../Menu';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { auditRegion, type AuditReport } from '@/lab/audit';
import { afterNextPaint } from '@/lab/frames';
import type { Measurement } from '@/fixes/types';
import {
  COLUMNS,
  copyAddresses,
  downloadCsv,
  moveFocus,
  nextSort,
  RISK_FILTERS,
  ROWS,
  visibleRows,
  type ColumnKey,
  type Row,
  type RiskFilter,
  type Sort,
  type TableFocus,
} from './a11yTable';

const EXPORT_FILENAME = 'linked-addresses.csv';

const toMeasurement = (r: AuditReport): Measurement => ({
  value: r.reachable,
  unit: 'audit',
  display: `${r.reachable}/${r.interactive} reachable`,
  detail: `${r.unlabeled} unlabeled · text contrast ${r.contrast.toFixed(1)}:1`,
  supported: true,
});

interface TableState {
  rows: Row[];
  filter: RiskFilter;
  sort: Sort | null;
  setFilter: (filter: RiskFilter) => void;
  sortBy: (key: ColumnKey) => void;
  exportRows: () => void;
  copyRows: () => void;
  reset: () => void;
  status: string;
}

const summary = (rows: readonly Row[], filter: RiskFilter) =>
  filter === 'All'
    ? `${rows.length} addresses linked to a flagged entity.`
    : `${rows.length} of ${ROWS.length} addresses (${filter.toLowerCase()} risk) linked to a flagged entity.`;

function KeyLegend() {
  return (
    <>
      <kbd>W</kbd>
      <kbd>S</kbd> rows · <kbd>A</kbd>
      <kbd>D</kbd> headers · arrow keys cells · <kbd>Enter</kbd> sorts
    </>
  );
}

/** Mouse-only menu, the way many in-house components are built: divs that open on click. */
function MouseMenu({ label, items }: { label: string; items: { label: string; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu">
      <div className="a11y-demo__ctl" data-interactive onClick={() => setOpen((o) => !o)}>
        {label}
      </div>
      {open && (
        <div className="menu__list">
          {items.map((item) => (
            <div
              key={item.label}
              className="menu__item"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The intentionally inaccessible panel: everything works with a mouse and nothing else. */
function BrokenPanel({ table }: { table: TableState }) {
  return (
    <>
      <div className="a11y-demo__bar">
        <MouseMenu
          label="Filter"
          items={RISK_FILTERS.map((f) => ({ label: f, onSelect: () => table.setFilter(f) }))}
        />
        <div className="a11y-demo__ctl" data-interactive onClick={table.exportRows}>
          Export
        </div>
        <MouseMenu
          label="⋯"
          items={[
            { label: 'Copy addresses', onSelect: table.copyRows },
            { label: 'Reset table', onSelect: table.reset },
          ]}
        />
      </div>
      <table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} data-interactive onClick={() => table.sortBy(c.key)}>
                {c.label}
                <span className="sort-indicator" aria-hidden="true">
                  ↕
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.address}>
              {COLUMNS.map((c) => (
                <td key={c.key} data-interactive>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* The fixed panel's legend, invisible, holds the same height at every width; the message sits on top. */}
      <p className="a11y-demo__keys a11y-demo__keys--none">
        <span className="a11y-demo__keys-ghost" aria-hidden="true">
          <KeyLegend />
        </span>
        <span className="a11y-demo__keys-message">No keyboard support.</span>
      </p>
      <p data-audit-text>{summary(table.rows, table.filter)}</p>
      <p className="a11y-demo__status">{table.status}</p>
    </>
  );
}

const navKey = (focus: TableFocus) =>
  focus.kind === 'header'
    ? `h-${focus.col}`
    : focus.kind === 'row'
      ? `r-${focus.row}`
      : `c-${focus.row}-${focus.col}`;

function FixedPanel({ table, onAnnounce }: { table: TableState; onAnnounce: (text: string) => void }) {
  // `lastCol` remembers the column so W/S → arrows and header ↔ cell moves keep their place.
  const [{ focus, lastCol }, setNav] = useState<{ focus: TableFocus; lastCol: number }>({
    focus: { kind: 'cell', row: 0, col: 0 },
    lastCol: 0,
  });
  const shouldFocus = useRef(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const glideRef = useRef<HTMLSpanElement>(null);
  const { rows } = table;

  // One focus ring that glides between rows, headers and cells instead of jumping.
  const moveGlide = (event: FocusEvent<HTMLTableElement>) => {
    const wrap = wrapRef.current!;
    const glide = glideRef.current!;
    const target = (event.target as HTMLElement).getBoundingClientRect();
    const origin = wrap.getBoundingClientRect();
    glide.style.transform = `translate(${target.left - origin.left}px, ${target.top - origin.top}px)`;
    glide.style.width = `${target.width}px`;
    glide.style.height = `${target.height}px`;
    glide.classList.add('focus-glide--on');
  };

  const hideGlide = (event: FocusEvent<HTMLTableElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      glideRef.current?.classList.remove('focus-glide--on');
    }
  };

  // Keep the roving tab stop on a row that still exists after filtering (every filter leaves at least one).
  const safeFocus: TableFocus =
    focus.kind !== 'header' && focus.row >= rows.length ? { ...focus, row: rows.length - 1 } : focus;

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    tableRef.current?.querySelector<HTMLElement>(`[data-nav="${navKey(safeFocus)}"]`)?.focus();
  });

  const sortLabel = (key: ColumnKey) =>
    table.sort?.key === key ? `sorted ${table.sort.direction}` : 'not sorted';

  const describe = (target: TableFocus) => {
    if (target.kind === 'header') {
      const column = COLUMNS[target.col]!;
      return `${column.label} column header, ${sortLabel(column.key)}. Press Enter to sort.`;
    }
    const row = rows[target.row]!;
    if (target.kind === 'row') {
      return `Row ${target.row + 1} of ${rows.length}: ${row.address}, ${row.type}, ${row.risk} risk`;
    }
    const column = COLUMNS[target.col]!;
    return `Row ${target.row + 1}, ${column.label}: ${row[column.key]}`;
  };

  const goTo = (target: TableFocus) => {
    shouldFocus.current = true;
    setNav({ focus: target, lastCol: target.kind === 'row' ? lastCol : target.col });
    onAnnounce(describe(target));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if ((event.key === 'Enter' || event.key === ' ') && safeFocus.kind === 'header') {
      event.preventDefault();
      table.sortBy(COLUMNS[safeFocus.col]!.key);
      return;
    }
    const next = moveFocus(safeFocus, event.key, rows.length, COLUMNS.length, lastCol);
    if (!next) return;
    event.preventDefault();
    goTo(next);
  };

  const tabIndexFor = (target: TableFocus) => (navKey(target) === navKey(safeFocus) ? 0 : -1);

  return (
    <>
      <div className="a11y-demo__bar" role="toolbar" aria-label="Table actions">
        <Menu
          label="Filter"
          items={RISK_FILTERS.map((f) => ({
            id: f,
            label: f === 'All' ? 'All risks' : `${f} risk`,
            checked: table.filter === f,
            onSelect: () => table.setFilter(f),
          }))}
        />
        <button type="button" className="a11y-demo__ctl" data-interactive onClick={table.exportRows}>
          Export
        </button>
        <Menu
          label="⋯"
          ariaLabel="More actions"
          align="end"
          items={[
            { id: 'copy', label: 'Copy addresses', onSelect: table.copyRows },
            { id: 'reset', label: 'Reset table', onSelect: table.reset },
          ]}
        />
      </div>
      <div className="table-wrap" ref={wrapRef}>
        <span className="focus-glide" ref={glideRef} aria-hidden="true" />
        <table
          ref={tableRef}
          onKeyDown={onKeyDown}
          onFocus={moveGlide}
          onBlur={hideGlide}
          aria-label="Linked addresses"
          aria-describedby="a11y-keys"
        >
          <thead>
            <tr>
              {COLUMNS.map((c, col) => (
                <th
                  key={c.key}
                  scope="col"
                  data-interactive
                  data-nav={`h-${col}`}
                  tabIndex={tabIndexFor({ kind: 'header', col })}
                  aria-sort={table.sort?.key === c.key ? table.sort.direction : undefined}
                  onClick={() => {
                    goTo({ kind: 'header', col });
                    table.sortBy(c.key);
                  }}
                >
                  {c.label}
                  <span className="sort-indicator" aria-hidden="true">
                    {table.sort?.key === c.key ? (table.sort.direction === 'ascending' ? '▲' : '▼') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.address} data-nav={`r-${r}`} tabIndex={tabIndexFor({ kind: 'row', row: r })}>
                {COLUMNS.map((c, col) => (
                  <td
                    key={c.key}
                    data-interactive
                    data-nav={`c-${r}-${col}`}
                    tabIndex={tabIndexFor({ kind: 'cell', row: r, col })}
                    onClick={() => goTo({ kind: 'cell', row: r, col })}
                  >
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id="a11y-keys" className="a11y-demo__keys">
        <KeyLegend />
      </p>
      <p data-audit-text>{summary(rows, table.filter)}</p>
      <p className="a11y-demo__status" role="status">
        {table.status}
      </p>
    </>
  );
}

function useTable(): TableState {
  const [filter, setFilterState] = useState<RiskFilter>('All');
  const [sort, setSort] = useState<Sort | null>(null);
  const [status, setStatus] = useState('');
  const rows = visibleRows(ROWS, filter, sort);

  return {
    rows,
    filter,
    sort,
    status,
    setFilter: (next) => {
      setFilterState(next);
      const count = visibleRows(ROWS, next, null).length;
      setStatus(
        next === 'All' ? `Showing all ${count} addresses.` : `Showing ${count} ${next.toLowerCase()}-risk.`,
      );
    },
    sortBy: (key) => {
      const next = nextSort(sort, key);
      setSort(next);
      setStatus(`Sorted by ${COLUMNS.find((c) => c.key === key)!.label}, ${next.direction}.`);
    },
    exportRows: () => {
      downloadCsv(rows, EXPORT_FILENAME);
      setStatus(`Exported ${rows.length} rows to ${EXPORT_FILENAME}.`);
    },
    copyRows: () => {
      void copyAddresses(rows).then((ok) =>
        setStatus(ok ? `Copied ${rows.length} addresses.` : 'Your browser blocked clipboard access.'),
      );
    },
    reset: () => {
      setFilterState('All');
      setSort(null);
      setStatus('Table reset.');
    },
  };
}

export default function A11yFix({ productionNote, method }: { productionNote: string; method?: string }) {
  const [variant, setVariant] = useState<'broken' | 'fixed'>('fixed');
  const [announcement, setAnnouncement] = useState('');
  const regionRef = useRef<HTMLDivElement>(null);
  const table = useTable();

  const audit = async (next: 'broken' | 'fixed', signal: AbortSignal) => {
    table.reset();
    setVariant(next);
    await afterNextPaint(signal);
    signal.throwIfAborted();
    return toMeasurement(auditRegion(regionRef.current!));
  };

  useFixLifecycle('a11y', {
    break: (signal) => audit('broken', signal),
    fix: (signal) => audit('fixed', signal),
  });

  return (
    <FixCard
      id="a11y"
      method={method}
      number="05"
      area="accessibility"
      title="A panel only mouse users can use"
      description="Broken: every control works with a mouse and nothing else. Clickable divs, no focus ring, an unlabeled icon, faint text. Fixed: real buttons and menus, labels, visible focus, readable contrast, and a sortable table you can drive from the keyboard."
      measureLabel={{ before: 'demo checks', after: 'demo checks' }}
      productionNote={productionNote}
    >
      <div
        ref={regionRef}
        className={`a11y-demo a11y-demo--${variant}`}
        data-testid="a11y-region"
        aria-describedby="a11y-note"
      >
        {variant === 'broken' ? (
          <BrokenPanel table={table} />
        ) : (
          <FixedPanel table={table} onAnnounce={setAnnouncement} />
        )}
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
