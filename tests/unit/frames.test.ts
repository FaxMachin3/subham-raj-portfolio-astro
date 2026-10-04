import { describe, expect, it } from 'vitest';
import { analyzeFrames } from '@/lab/frames';

const steady = (count: number, step = 16.7) => Array.from({ length: count }, (_, i) => i * step);

describe('analyzeFrames', () => {
  it('reports no dropped frames for a steady 60 fps run', () => {
    expect(analyzeFrames(steady(30))).toEqual({ dropped: 0, longestMs: expect.closeTo(16.7, 1) });
  });

  it('counts the frames hidden inside a long gap', () => {
    const stamps = [0, 16.7, 33.4, 133.4, 150.1]; // a 100 ms gap swallows ~5 frames
    expect(analyzeFrames(stamps)).toEqual({ dropped: 5, longestMs: 100 });
  });

  it('ignores small jitter below the jank threshold', () => {
    expect(analyzeFrames([0, 18, 36, 58, 75]).dropped).toBe(0);
  });

  it('handles empty and single-frame input', () => {
    expect(analyzeFrames([])).toEqual({ dropped: 0, longestMs: 0 });
    expect(analyzeFrames([5])).toEqual({ dropped: 0, longestMs: 0 });
  });
});
