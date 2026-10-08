# 0007 · Font delivery, lab hydration and honest measurement

**Status:** accepted (October 2026)

## Context

Three questions came out of a review aimed at senior and staff roles: are the fonts delivered the right way,
should the interactive lab load later, and can every number on the page be defended?

## Decision 1: fonts are inlined into the stylesheet

On the user's iPhone, navigation sometimes painted before linked font files were ready. Font swapping
re-wrapped text; earlier attempts to hide content while restoring navigation also produced blank frames.
The five fonts (65.6 KB
gzip, unchanged fontsource files) now ship as data URIs inside the cached stylesheet. A one-line body script
starts decoding them before the first text layout, so even a cold first visit doesn't shift.

| Measured on (Lighthouse mobile, 3 runs) | First paint | Largest paint | Layout shift |
| --------------------------------------- | ----------- | ------------- | ------------ |
| Linked fonts (before)                   | 1.35 s      | 1.36 s        | 0            |
| Inlined fonts                           | 1.28 s      | 1.51 s        | 0            |

These Lighthouse numbers were supplied by the auditing agent and were not remeasured during integration.
They suggest about 0.15 s later largest paint on a cold visit. Immutable caching avoids redownloading the
stylesheet on repeat visits, though parsing, decoding and rendering still have a cost.

## Decision 2: the lab keeps `client:idle`

The demos hydrate when the browser is idle, after first paint. Lighthouse reports 0 ms total blocking time and
a perfect performance score with all six hydrated, so deferring them further (`client:visible`, or an explicit
"start the lab" step) would make "Break this site" wait for islands that aren't loaded yet, for no measured
gain. The budget script now makes the trade-off visible instead: initial JavaScript, including inline
scripts, has its own budget; code the lab loads on demand has a separate budget; and the bundle demo's
synthetic payloads are reported on their own. If either budget is ever at risk, revisit this.

## Decision 3: every number says what it is

- **Live versus historical.** Demo numbers are measured on the visitor's device. Production results
  (highlights, "At TRM Labs" notes) are labelled as such and never presented as live.
- **No fake values.** The health bar shows "–" until it has a real sample, pauses in hidden tabs and doesn't
  cap FPS at 60. Dropped frames are an estimate, using the display's own frame interval, and too few frames is
  reported as "not enough frames sampled", never as a perfect 0.
- **Requests mean requests.** A dynamic import counts as a request only if the browser actually downloaded the
  chunk. Resource sizes are read through a PerformanceObserver, because the Resource Timing buffer fills up.
- **Every demo explains itself.** A "How this is measured" note per card (`src/fixes/methods.ts`) gives the
  workload, scope and limits. It's rendered by Astro, so it costs no client JavaScript.
- **Failure is a state.** A demo that throws shows _Failed · try again_; one abandoned mid-run (the visitor
  left) shows _Cancelled_. Neither is ever shown as healthy or fixed, and the whole-site controller ends its
  run with a message instead of waiting forever.

## Integration decisions

Keep the existing root transition, card-title glide, explicit instant history corrections, and early themed
canvas. The supplied root stagger fades both page snapshots to low opacity at once; that could resemble
the dark flicker previously resolved on the user's iPhone. Retain the stronger first-frame font assertions,
back-link safeguards, return-history tests, Windows clipboard normalization and portable content setup.
Physical iPhone verification is still required for this new homepage layout.
