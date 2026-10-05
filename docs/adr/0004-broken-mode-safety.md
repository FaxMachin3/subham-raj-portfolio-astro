# 0004 · Broken-mode safety

**Status:** accepted

## Context

"Break this site" deliberately freezes the main thread, floods the network and removes accessibility. Done
carelessly, that would hurt the visitor: a long freeze, a runaway request loop, or motion for someone who has
asked for less.

## Decision

- **Bounded freezes.** The plot demo calibrates its element count on the visitor's device so the slow path
  takes a second or two, within fixed minimum and maximum counts.
- **Bounded traffic.** Broken polling stops after 20 s. Healthy polling runs every 20 s, and only on-screen
  entities are fetched.
- **Reduced motion.** Demos that freeze the page or add motion cannot be broken when
  `prefers-reduced-motion` is set. The fixes and their write-ups are still shown.
- **Always recoverable.** "Let Subham fix it" aborts any in-flight break through `AbortSignal`, and every
  demo restores a healthy state if a handler throws.
- **Accessible while broken.** Everything outside the demo regions still passes axe WCAG 2.2 AA in the broken
  state; Playwright checks both states.
- **No layout shift from the controls.** Buttons, toast and overlays reserve their space, and end-to-end tests
  assert CLS below 0.01 during the fix phase.

## Consequences

- Numbers vary by device. That is the point, and the copy says so.
- Browsers without some `PerformanceObserver` entry types show "n/a" rather than an estimate.
