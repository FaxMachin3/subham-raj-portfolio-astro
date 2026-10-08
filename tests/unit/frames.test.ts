import { describe, expect, it } from 'vitest';
import { analyzeFrames, frameInterval } from '@/lab/frames';

const steady = (count: number, step = 16.7) => Array.from({ length: count }, (_, i) => i * step);

describe('analyzeFrames', () => {
  it('reports no dropped frames for a steady 60 fps run', () => {
    expect(analyzeFrames(steady(30))).toMatchObject({
      dropped: 0,
      longestMs: expect.closeTo(16.7, 1),
      frameMs: expect.closeTo(16.7, 1),
      enough: true,
    });
  });

  it('uses the display’s own cadence: a 120 Hz screen has an 8.3 ms frame budget', () => {
    const stamps = [...steady(20, 8.3), 8.3 * 19 + 50]; // one 50 ms gap ≈ 5 missed frames at 120 Hz
    const report = analyzeFrames(stamps);
    expect(report.frameMs).toBeCloseTo(8.3, 1);
    expect(report.dropped).toBe(5);
  });

  it('counts the frames hidden inside a long gap', () => {
    const stamps = [0, 16.7, 33.4, 133.4, 150.1, 166.8, 183.5]; // a 100 ms gap swallows ~5 frames
    expect(analyzeFrames(stamps)).toMatchObject({ dropped: 5, longestMs: 100, enough: true });
  });

  it('ignores small jitter below ~1.5 frames', () => {
    expect(analyzeFrames([0, 18, 36, 58, 75, 93]).dropped).toBe(0);
  });

  it('says when there are too few frames instead of reporting a perfect run', () => {
    expect(analyzeFrames([])).toMatchObject({ dropped: 0, longestMs: 0, enough: false });
    expect(analyzeFrames([5])).toMatchObject({ enough: false });
    expect(analyzeFrames(steady(4))).toMatchObject({ enough: false });
  });
});

describe('frameInterval', () => {
  it('falls back to 60 Hz without data and clamps implausible cadences', () => {
    expect(frameInterval([])).toBeCloseTo(16.7, 1);
    expect(frameInterval([1, 1, 1])).toBeCloseTo(1000 / 240, 3);
    expect(frameInterval([80, 80, 80])).toBeCloseTo(1000 / 30, 3);
  });
});
