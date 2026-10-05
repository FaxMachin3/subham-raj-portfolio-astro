import { describe, expect, it } from 'vitest';
import { formatDate, formatPeriod, formatYearMonth } from '@/lib/dates';
import { formatCount, formatKB, formatMs } from '@/lab/format';
import { requestIdle, runWhenIdle } from '@/lab/idle';
import { FIX_ORDER, BREAK_ORDER, FIX_META } from '@/fixes/registry';
import { FIX_IDS } from '@/fixes/types';

describe('formatting', () => {
  it('formats durations for humans', () => {
    expect(formatMs(3.44)).toBe('3.4 ms');
    expect(formatMs(42.4)).toBe('42 ms');
    expect(formatMs(1534)).toBe('1.53 s');
  });

  it('formats sizes and counts', () => {
    expect(formatKB(565 * 1024)).toBe('565 KB');
    expect(formatCount(20000)).toBe('20,000');
  });

  it('formats experience periods', () => {
    expect(formatYearMonth('2023-11')).toBe('Nov 2023');
    expect(formatYearMonth('2026')).toBe('2026');
    expect(formatDate(new Date('2026-10-04'))).toBe('4 Oct 2026');
    expect(formatPeriod('2018-04', '2020-10')).toBe('Apr 2018 – Oct 2020');
  });
});

describe('idle scheduling without requestIdleCallback (Safari)', () => {
  it('gives the callback a real, shrinking time budget', async () => {
    const remaining = await new Promise<number>((resolve) => requestIdle((d) => resolve(d.timeRemaining())));
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(8);
  });

  it('completes chunked work', async () => {
    await expect(runWhenIdle(20, 4)).resolves.toBeUndefined();
  });
});

describe('fix registry', () => {
  it('orders every fix exactly once', () => {
    expect([...FIX_ORDER].sort()).toEqual([...FIX_IDS].sort());
    expect([...BREAK_ORDER].sort()).toEqual([...FIX_IDS].sort());
  });

  it('ends both sequences with the plot fix', () => {
    expect(FIX_ORDER.at(-1)).toBe('plot');
    expect(BREAK_ORDER.at(-1)).toBe('plot');
  });

  it('has a commit label for every fix', () => {
    for (const id of FIX_IDS) expect(FIX_META[id].commit).toMatch(/^\w+(\(\w+\))?: /);
  });
});
