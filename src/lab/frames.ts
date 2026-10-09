export interface FrameReport {
  /** Estimated frames the browser skipped: gaps longer than ~1.5 frames, counted in whole frames. */
  dropped: number;
  longestMs: number;
  /** The display's frame interval, from the median gap (≈16.7 ms at 60 Hz, ≈8.3 ms at 120 Hz). */
  frameMs: number;
  /** False when too few frames were sampled to say anything; the UI then shows "n/a", never a perfect 0. */
  enough: boolean;
}

const MIN_GAPS = 5;
const FALLBACK_FRAME_MS = 1000 / 60;

/** Median gap between frames, clamped to plausible displays (30–240 Hz). */
export function frameInterval(gaps: readonly number[]): number {
  if (!gaps.length) return FALLBACK_FRAME_MS;
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return Math.min(1000 / 30, Math.max(1000 / 240, median));
}

/**
 * Estimates dropped frames from consecutive requestAnimationFrame timestamps. This is an estimate:
 * animation frames are not proof of paints, and the frame budget comes from this display's own cadence.
 */
export function analyzeFrames(timestamps: readonly number[]): FrameReport {
  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]!);
  const frameMs = frameInterval(gaps);
  let dropped = 0;
  for (const gap of gaps) if (gap > frameMs * 1.5) dropped += Math.round(gap / frameMs) - 1;
  return { dropped, longestMs: Math.max(0, ...gaps), frameMs, enough: gaps.length >= MIN_GAPS };
}

/**
 * Records animation-frame timestamps for `durationMs`. Aborting settles it at once with the frames so far:
 * background tabs run no animation frames, so waiting for the next one could take forever.
 */
export function recordFrames(durationMs: number, signal?: AbortSignal): Promise<number[]> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    if (signal?.aborted) return resolve(stamps);
    const end = performance.now() + durationMs;
    let handle = 0;
    const finish = () => {
      cancelAnimationFrame(handle);
      signal?.removeEventListener('abort', finish);
      resolve(stamps);
    };
    const tick = (t: number) => {
      stamps.push(t);
      if (t < end) handle = requestAnimationFrame(tick);
      else finish();
    };
    signal?.addEventListener('abort', finish, { once: true });
    handle = requestAnimationFrame(tick);
  });
}

/**
 * Resolves after the browser has painted at least once, so UI changes are visible before heavy work.
 * Aborting resolves it straight away; callers check the signal afterwards.
 */
export function afterNextPaint(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let handle = 0;
    const finish = () => {
      cancelAnimationFrame(handle);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    signal?.addEventListener('abort', finish, { once: true });
    handle = requestAnimationFrame(() => {
      handle = requestAnimationFrame(finish);
    });
  });
}
