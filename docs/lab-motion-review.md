# Local lab, motion and reliability review

This integrates the new round from `subham-raj-portfolio (3).patch` onto `83919f4` for local review.
The supplied patch is cumulative against `d750081`. Comparing it with the previous staff-readiness patch
isolated 36 files containing new work; earlier navigation, font, favicon and CI changes were retained.
The integration was reviewed locally before the user authorized committing and pushing it to `main`.

## Changes to review

- The dark lab console and whole-site Break/Fix controls now sit directly above the six demos. The hero
  retains Work and Résumé actions and links down to the lab. Work leads the header navigation.
- The health bar starts collapsed and remembers an explicit expanded preference.
- Case-study cards morph their surfaces and content into the study header, with shared title timing:
  approximately 300 ms opening and 240 ms returning. Returned focus uses `preventScroll`; modified clicks,
  downloads and new-tab links do not replace the saved opener. Reduced motion still disables transitions.
- Whole-site runs lock individual card Break/Fix buttons, offer Cancel, and require all six fixed states
  before showing the merged badge. Completed cards retain their results when a run is cancelled.
- Plot work avoids calibration under reduced motion, caps the calibration probe, checks cancellation
  after awaits and avoids drawing after unmount.
- Bundle route buttons show pending/error states, deduplicate clicks and ignore obsolete results.
- Frame recording, paint waits and idle work settle promptly when aborted, including in background tabs.
- Translation results are guarded by request identity, mode, cancellation and page lifetime.
- Copy now says “the design system I proposed”, scopes the OpenAPI claim and labels the demo checks accurately.

## Integration corrections

- Preserved binary font priming, instant history correction, navigation link guards, native complementary
  root crossfade, early themed canvas, clipboard portability and the current CI workflows.
- Omitted the supplied delayed root fade, which could expose the dark background between snapshots.
  The new card surface/content/title morph is retained.
- Preserved toast cleanup and prevented an earlier merged-glow timer from unlocking a newer run.
- Guarded return focus against modified/cancelled clicks and inaccessible storage.
- Reduced-motion plotting remains bounded even if the visitor enabled the preference after calibration.
- Manual sidebar aborts are handled instead of producing an unhandled rejection.
- A real browser test exposed that the supplied route Retry button reused a cached rejected import.
  Retries now use a fresh URL for the same observed, same-origin asset; successful recovery URLs are kept
  so later openings reuse the module. This adds no duplicate compiled payloads or dependencies.

## Review limits

Local validation:

- Unit/component suite: 289 passed in 31 files. After the import-recovery correction, the affected
  demo/component tests were repeated: 25 passed.
- Full Chromium desktop and iPhone WebKit suites: 206 passed, 11 skipped, one sidebar performance
  assertion initially received insufficient frame samples. That test passed on an isolated rerun with
  its original assertions; no threshold was lowered.
- Targeted Android 360px and iPad suites: 63 passed, seven engine/input-specific skips. These covered
  accessibility, card motion/focus, font stability, failures, cancellation and repeated import recovery.
- Real import recovery also passed independently on desktop Chromium and iPhone WebKit.
- Types, lint, formatting, i18n generation, production build and all existing budgets passed.
  Initial JS: 98.1/100 KB gzip; CSS: 9.9/10 KB; fonts: 65.6/70 KB.

The original handover's Lighthouse, walkthrough and 100% coverage claims are supplied evidence, not
independent measurements of this integration. Physical iPhone review remains necessary for the visual
transition and browser toolbar behavior. Firefox's local Windows runtime was already unavailable;
the full ten-profile Linux CI run will require a later authorized push.

CSS is close to its existing 10 KB budget. Further visual additions should trim other CSS rather than
raise the budget. No new case study, unpublished writing or unsupported personal fact was added.
