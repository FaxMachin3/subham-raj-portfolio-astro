# 0001 · Astro with React islands

**Status:** accepted

## Context

Most of the site is reading material: hero, case studies, experience, résumé. Only the six break/fix demos,
their controls, the results table and the health bar need JavaScript. A portfolio about frontend performance
cannot ship a heavy single-page app to render static text.

## Decision

Use Astro with static output. Sections and pages are `.astro` components rendered to HTML at build time.
Interactive parts are React islands hydrated with `client:idle`, so hydration never competes with first paint.
No island uses `client:load`. Islands share state through nanostores rather than a React context, because
each island is a separate React root.

React was picked for the islands because it is the framework Subham uses daily, which keeps the code
representative of how he works.

## Consequences

- Text content is visible and indexable with zero JavaScript.
- Homepage JS stays within a 90 KB gzip budget, enforced in CI by `scripts/check-budget.mjs`.
- Cross-island state must go through stores; islands cannot pass props to each other.
- Hydration-dependent UI must render the same markup on the server and the first client render
  (`useHydrated`) to avoid hydration mismatches.
