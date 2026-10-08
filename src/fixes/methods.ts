import type { FixId } from './types';

/**
 * "How this is measured" for each demo: workload, scope and limits. It must match what the demo's code
 * actually does. Rendered into the page by Astro and passed to each card, so it adds nothing to the
 * client bundle.
 */
export const FIX_METHODS: Record<FixId, string> = {
  plot: 'Measured live on this device. Both versions get the same seeded records (about 6% repeat an earlier id) and produce the same plot; the time covers the plotting function only, not drawing. The record count comes from a quick calibration so the broken version takes about 1–2 s here, with a floor of 1,600. One run, so background activity in the browser can move the number.',
  jank: 'Measured live on this device. The sidebar runs its 0.5 s transition while animation frames are recorded for 0.65 s; both versions do the same 350 ms of work. Broken runs it in 70 ms blocks during the animation; fixed waits for the transition, then runs it in idle-time slices, which can finish after the window closes: the work is moved, not removed. Dropped frames are an estimate from frame timing (gaps longer than about 1.5 of this display’s frames), not a paint log.',
  bundle:
    'Measured live. The demo loads its own code-split chunks with dynamic import(); sizes are each chunk’s decoded size from Resource Timing. Broken loads the core and every route before anything works; fixed loads the core only. On a repeat run the chunks are already in memory: sizes are still shown, and the result says nothing was downloaded.',
  network:
    'Measured live. Counts this demo’s own requests over 6 s: entity panels and a status check. Broken fetches all 24 panels at once and polls status about 30 times a second (it stops after 20 s); fixed fetches panels as they scroll near view and polls every 20 s. Layout shift appears only in browsers that report it (Chromium).',
  a11y: 'Measured live, on this panel only: how many of its interactive elements a keyboard user can reach, how many lack an accessible name, and the contrast of its body text. Three automated checks to illustrate the fix, not a WCAG audit; real conformance needs screen-reader and manual testing.',
  i18n: 'Measured live. Counts strings missing in the chosen language: broken renders raw keys, so all 5 are missing; fixed loads that language’s file the first time it is picked and reuses it after. A request is counted only when the browser actually downloaded the file.',
};
