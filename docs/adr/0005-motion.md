# 0005 · Motion

**Status:** accepted

## Context

The site sells performance and accessibility work, so its motion has to demonstrate both: it should explain
what is happening in the break/fix demo without costing load time, causing layout shift, or excluding people
who prefer less motion.

## Decision

- **Motion tells the story of each issue**, never decorates. The hero words break and heal with the fixes
  they stand for; cards glitch as they break, show a scan line while being fixed, and get a green wipe when
  fixed; the PR merge cascades into the results table.
- **X-rays explain, measurements prove.** Each fix gets an x-ray: an animated explanation of the mechanism on a
  tiny example, played before the real run. It is framework-free DOM code in `src/xray` (like the lab core),
  loaded on first use together with its CSS, skippable, captioned through a live region, and a still frame
  under reduced motion. The measured run starts only after it, and nothing animates over a card while it is
  measured, so the explanation can never distort the numbers.
- **CSS and the platform first.** View transitions (cross-document for pages, same-document for the theme
  reveal), scroll-driven animations and keyframes. JavaScript animates only what CSS cannot: the count-up and
  the streamed plot. No animation library (GSAP or Framer Motion would cost 25–45 KB against a 90 KB budget).
- **Safe properties only.** Transform-type properties (`transform`, `translate`, `scale`) and, for overlays,
  backgrounds. Text never animates opacity, so contrast never dips below AA mid-animation (axe would catch it).
  Nothing animates layout properties, so nothing shifts.
- **Progressive enhancement.** Browsers without view transitions or scroll timelines get the same content
  without the effect.
- **`prefers-reduced-motion` turns everything off**, including view transitions, and breaking the whole site
  is disabled.

## Consequences

- Homepage JS stays within budget (about 89 KB gzip).
- Firefox currently gets no scroll-linked entrances or page morphs; content is identical.
- New animations must pass the same e2e checks: no CLS during the fix phase, axe clean in both themes.
