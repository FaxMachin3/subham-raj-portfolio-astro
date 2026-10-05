import { describe, expect, it } from 'vitest';
import { contrastRatio, effectiveBackground, parseCssColor, relativeLuminance } from '@/lab/contrast';

describe('parseCssColor', () => {
  it('parses rgb and rgba strings', () => {
    expect(parseCssColor('rgb(18, 18, 18)')).toEqual([18, 18, 18]);
    expect(parseCssColor('rgba(255, 0, 10, 0.5)')).toEqual([255, 0, 10]);
  });

  it('treats fully transparent colours as no colour', () => {
    expect(parseCssColor('rgba(0, 0, 0, 0)')).toBeNull();
    expect(parseCssColor('transparent')).toBeNull();
  });
});

describe('WCAG contrast', () => {
  it('matches the reference extremes', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBeCloseTo(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio([10, 20, 30], [200, 210, 220])).toBeCloseTo(
      contrastRatio([200, 210, 220], [10, 20, 30]),
    );
  });

  it('places #767676 on white just above AA (4.5:1)', () => {
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });
});

describe('effectiveBackground', () => {
  it('falls back to white when no ancestor paints a background', () => {
    expect(effectiveBackground(null)).toEqual([255, 255, 255]);
  });
});
