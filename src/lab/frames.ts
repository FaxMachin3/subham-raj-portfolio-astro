export interface FrameReport {
  dropped: number;
  longestMs: number;
}

const FRAME_MS = 1000 / 60;
const JANK_THRESHOLD_MS = 25;

/** Counts frames the browser failed to paint, from consecutive requestAnimationFrame timestamps. */
export function analyzeFrames(timestamps: readonly number[], frameMs = FRAME_MS): FrameReport {
  let dropped = 0;
  let longestMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i]! - timestamps[i - 1]!;
    longestMs = Math.max(longestMs, gap);
    if (gap > JANK_THRESHOLD_MS) dropped += Math.round(gap / frameMs) - 1;
  }
  return { dropped, longestMs };
}

/** Records animation-frame timestamps for `durationMs`. */
export function recordFrames(durationMs: number, signal?: AbortSignal): Promise<number[]> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    const end = performance.now() + durationMs;
    const tick = (t: number) => {
      stamps.push(t);
      if (t < end && !signal?.aborted) requestAnimationFrame(tick);
      else resolve(stamps);
    };
    requestAnimationFrame(tick);
  });
}

/** Resolves after the browser has painted at least once, so UI changes are visible before heavy work. */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
