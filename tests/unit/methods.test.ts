import { describe, expect, it } from 'vitest';
import { FIX_METHODS } from '@/fixes/methods';
import { FIX_IDS } from '@/fixes/types';

describe('"How this is measured" notes', () => {
  it('exist for every demo and say they are live measurements', () => {
    for (const id of FIX_IDS) expect(FIX_METHODS[id]).toMatch(/^Measured live/);
  });

  it('match the workloads in the code', () => {
    expect(FIX_METHODS.plot).toContain('floor of 1,600');
    expect(FIX_METHODS.jank).toContain('350 ms');
    expect(FIX_METHODS.network).toContain('24 panels');
    expect(FIX_METHODS.i18n).toContain('all 5');
    expect(FIX_METHODS.a11y).toContain('not a WCAG audit');
  });
});
