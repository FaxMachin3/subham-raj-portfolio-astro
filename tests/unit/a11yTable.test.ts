// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  moveFocus,
  nextSort,
  ROWS,
  toCsv,
  visibleRows,
  type TableFocus,
} from '@/components/islands/fixes/a11yTable';

const ROW_COUNT = 4;
const COL_COUNT = 3;
const move = (focus: TableFocus, key: string, lastCol = 0) =>
  moveFocus(focus, key, ROW_COUNT, COL_COUNT, lastCol);

describe('table keyboard model', () => {
  const firstCell: TableFocus = { kind: 'cell', row: 0, col: 0 };

  it('starts each key family from the first row or header', () => {
    expect(move(firstCell, 's')).toEqual({ kind: 'row', row: 0 });
    expect(move(firstCell, 'd')).toEqual({ kind: 'header', col: 0 });
  });

  it('W and S move between whole rows, and W from the first row goes to the headers', () => {
    expect(move({ kind: 'row', row: 1 }, 's')).toEqual({ kind: 'row', row: 2 });
    expect(move({ kind: 'row', row: 3 }, 'S')).toEqual({ kind: 'row', row: 3 });
    expect(move({ kind: 'row', row: 0 }, 'w', 2)).toEqual({ kind: 'header', col: 2 });
  });

  it('S from a header goes to the first row; W on a header stays put', () => {
    expect(move({ kind: 'header', col: 2 }, 's')).toEqual({ kind: 'row', row: 0 });
    expect(move({ kind: 'header', col: 2 }, 'w')).toEqual({ kind: 'header', col: 2 });
  });

  it('A and D move between column headers, clamped at the ends', () => {
    expect(move({ kind: 'header', col: 0 }, 'd')).toEqual({ kind: 'header', col: 1 });
    expect(move({ kind: 'header', col: 2 }, 'd')).toEqual({ kind: 'header', col: 2 });
    expect(move({ kind: 'header', col: 0 }, 'a')).toEqual({ kind: 'header', col: 0 });
    expect(move({ kind: 'cell', row: 2, col: 1 }, 'a')).toEqual({ kind: 'header', col: 1 });
  });

  it('arrow keys only ever land on cells', () => {
    expect(move({ kind: 'cell', row: 0, col: 0 }, 'ArrowRight')).toEqual({ kind: 'cell', row: 0, col: 1 });
    expect(move({ kind: 'cell', row: 3, col: 2 }, 'ArrowDown')).toEqual({ kind: 'cell', row: 3, col: 2 });
    expect(move({ kind: 'header', col: 1 }, 'ArrowUp')).toEqual({ kind: 'cell', row: 0, col: 1 });
    expect(move({ kind: 'row', row: 2 }, 'ArrowLeft', 2)).toEqual({ kind: 'cell', row: 2, col: 2 });
  });

  it('ignores keys it does not own', () => {
    expect(move(firstCell, 'x')).toBeNull();
    expect(move(firstCell, 'Tab')).toBeNull();
  });

  it('does not move into rows when a filter hides them all', () => {
    expect(moveFocus({ kind: 'header', col: 0 }, 's', 0, COL_COUNT, 0)).toBeNull();
    expect(moveFocus({ kind: 'header', col: 0 }, 'ArrowDown', 0, COL_COUNT, 0)).toBeNull();
  });
});

describe('table data', () => {
  it('filters by risk and sorts risk by severity, not alphabetically', () => {
    expect(visibleRows(ROWS, 'High', null).map((r) => r.risk)).toEqual(['High', 'High']);
    const byRisk = visibleRows(ROWS, 'All', { key: 'risk', direction: 'ascending' }).map((r) => r.risk);
    expect(byRisk).toEqual(['Low', 'Medium', 'High', 'High']);
  });

  it('toggles direction on the same column and resets on a new one', () => {
    const first = nextSort(null, 'type');
    expect(first).toEqual({ key: 'type', direction: 'ascending' });
    expect(nextSort(first, 'type').direction).toBe('descending');
    expect(nextSort(first, 'risk')).toEqual({ key: 'risk', direction: 'ascending' });
  });

  it('exports CSV with a header row and escapes commas and quotes', () => {
    const csv = toCsv([{ address: 'a,"b"', type: 'Mixer', risk: 'High' }]);
    expect(csv).toBe('Address,Type,Risk\n"a,""b""",Mixer,High\n');
  });
});

describe('table edge cases', () => {
  it('sorts descending, and flips back to ascending', () => {
    const desc = visibleRows(ROWS, 'All', { key: 'type', direction: 'descending' }).map((r) => r.type);
    expect(desc).toEqual([...desc].sort().reverse());
    expect(nextSort({ key: 'type', direction: 'descending' }, 'type').direction).toBe('ascending');
  });

  it('A/D from a whole row goes to the last-used column header', () => {
    expect(move({ kind: 'row', row: 1 }, 'd', 2)).toEqual({ kind: 'header', col: 2 });
  });
});

describe('table actions', () => {
  it('downloads the rows as a CSV file', async () => {
    const { downloadCsv } = await import('@/components/islands/fixes/a11yTable');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:csv', revokeObjectURL: revoke }));
    vi.useFakeTimers();
    downloadCsv(ROWS, 'rows.csv');
    expect(click).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:csv');
    vi.useRealTimers();
  });

  it('copies addresses, and reports when the clipboard is blocked', async () => {
    const { copyAddresses } = await import('@/components/islands/fixes/a11yTable');
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyAddresses(ROWS)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(ROWS.map((r) => r.address).join('\n'));
    writeText.mockRejectedValue(new Error('denied'));
    expect(await copyAddresses(ROWS)).toBe(false);
    vi.unstubAllGlobals();
  });
});
