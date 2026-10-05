export type ColumnKey = 'address' | 'type' | 'risk';
export type Risk = 'Low' | 'Medium' | 'High';
export type RiskFilter = 'All' | Risk;
export type SortDirection = 'ascending' | 'descending';

export interface Row {
  address: string;
  type: string;
  risk: Risk;
}

export interface Sort {
  key: ColumnKey;
  direction: SortDirection;
}

export const COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: 'address', label: 'Address' },
  { key: 'type', label: 'Type' },
  { key: 'risk', label: 'Risk' },
];

export const ROWS: readonly Row[] = [
  { address: '0x9f…a21', type: 'Exchange', risk: 'Low' },
  { address: '0x3c…7e0', type: 'Mixer', risk: 'High' },
  { address: '0x71…b4d', type: 'OTC desk', risk: 'Medium' },
  { address: '0xa4…19c', type: 'Bridge', risk: 'High' },
];

export const RISK_FILTERS: readonly RiskFilter[] = ['All', 'High', 'Medium', 'Low'];

const RISK_RANK: Record<Risk, number> = { Low: 0, Medium: 1, High: 2 };

export function visibleRows(rows: readonly Row[], filter: RiskFilter, sort: Sort | null): Row[] {
  const filtered = filter === 'All' ? [...rows] : rows.filter((r) => r.risk === filter);
  if (!sort) return filtered;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return filtered.sort((a, b) => {
    const diff =
      sort.key === 'risk' ? RISK_RANK[a.risk] - RISK_RANK[b.risk] : a[sort.key].localeCompare(b[sort.key]);
    return diff * sign;
  });
}

/** First press sorts ascending; pressing the same column again flips the direction. */
export function nextSort(current: Sort | null, key: ColumnKey): Sort {
  if (current?.key !== key) return { key, direction: 'ascending' };
  return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

export function toCsv(rows: readonly Row[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [COLUMNS.map((c) => c.label), ...rows.map((r) => COLUMNS.map((c) => r[c.key]))];
  return lines.map((line) => line.map(escape).join(',')).join('\n') + '\n';
}

export function downloadCsv(rows: readonly Row[], filename: string): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyAddresses(rows: readonly Row[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(rows.map((r) => r.address).join('\n'));
    return true;
  } catch {
    return false;
  }
}

/** Where keyboard focus sits in the table: a column header, a whole row, or a single cell. */
export type TableFocus =
  { kind: 'header'; col: number } | { kind: 'row'; row: number } | { kind: 'cell'; row: number; col: number };

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * W/S move between whole rows, A/D between column headers, arrow keys between cells. Each key family
 * starts from the first row, header or cell and then moves relative to wherever focus is.
 * Returns null for keys the table doesn't handle.
 */
export function moveFocus(
  focus: TableFocus,
  key: string,
  rowCount: number,
  colCount: number,
  lastCol: number,
): TableFocus | null {
  const clampRow = (r: number) => Math.max(0, Math.min(rowCount - 1, r));
  const clampCol = (c: number) => Math.max(0, Math.min(colCount - 1, c));
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (lower === 'w' || lower === 's') {
    if (rowCount === 0) return null;
    const step = lower === 's' ? 1 : -1;
    if (focus.kind === 'header') return lower === 's' ? { kind: 'row', row: 0 } : focus;
    if (focus.kind === 'cell') return { kind: 'row', row: focus.row };
    if (focus.row === 0 && step === -1) return { kind: 'header', col: clampCol(lastCol) };
    return { kind: 'row', row: clampRow(focus.row + step) };
  }

  if (lower === 'a' || lower === 'd') {
    if (focus.kind !== 'header') return { kind: 'header', col: focus.kind === 'cell' ? focus.col : lastCol };
    return { kind: 'header', col: clampCol(focus.col + (lower === 'd' ? 1 : -1)) };
  }

  const arrow = ARROWS[key];
  if (arrow) {
    if (rowCount === 0) return null;
    if (focus.kind === 'header') return { kind: 'cell', row: 0, col: focus.col };
    if (focus.kind === 'row') return { kind: 'cell', row: focus.row, col: clampCol(lastCol) };
    return { kind: 'cell', row: clampRow(focus.row + arrow[0]), col: clampCol(focus.col + arrow[1]) };
  }

  return null;
}
