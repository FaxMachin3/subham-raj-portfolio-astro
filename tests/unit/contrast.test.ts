import { describe, expect, it } from 'vitest';
import { contrastRatio, parseCssColor, relativeLuminance } from '@/lab/contrast';

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

  it('confirms the design tokens used for body text meet AA', () => {
    const paper: [number, number, number] = [245, 244, 239];
    expect(contrastRatio([18, 18, 18], paper)).toBeGreaterThan(7); // ink
    expect(contrastRatio([85, 85, 78], paper)).toBeGreaterThan(4.5); // muted
    expect(contrastRatio([8, 115, 74], [220, 245, 232])).toBeGreaterThan(4.5); // good on good-bg
    expect(contrastRatio([179, 38, 30], [253, 228, 225])).toBeGreaterThan(4.5); // bad on bad-bg
  });
});
