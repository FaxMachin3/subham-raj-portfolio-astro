# Subham Raj · Portfolio

**Break the site, watch him fix it.** Six live demos rebuild problems Subham has fixed in production. Each one
can be broken and fixed in the visitor's browser, and every number is measured on the visitor's own device.

Built with Astro 7 (static output), React 19 islands and nanostores.

## Quick start

```sh
nvm use 22            # Node >= 22.22
npm ci
npm run dev           # http://localhost:4321
npm run verify        # every quality gate, the same as CI
```

## Architecture

```text
              Astro pages (static HTML, zero JS by default)
  ┌────────────────────────────────────────────────────────────────┐
  │ Hero · Work · Writing · Leverage · Lab · Experience · Contact  │
  │ /work/[slug] · /writing/[slug] (MDX) · /resume · 404           │
  │ /og/[slug].png (build-time social images) · /llms.txt          │
  └───────────────┬────────────────────────────────────────────────┘
                  │ client:idle islands (hydrate after first paint)
  ┌───────────────▼────────────────────────────────────────────────┐
  │ BreakFixControls  FixCard × 6  ResultsTable  HealthBar  (React)│
  │   PlotFix  JankFix  BundleFix  NetworkFix  A11yFix  I18nFix    │
  └───────────────┬────────────────────────────────────────────────┘
                  │ useFixLifecycle(): reconcile towards a target
  ┌───────────────▼────────────────────────────────────────────────┐
  │ src/stores/fixes.ts   nanostores, shared across islands        │
  │   $targets → requested state   $statuses / $results → actual   │
  └───────────────┬────────────────────────────────────────────────┘
                  │ plain functions, no framework imports
  ┌───────────────▼────────────────────────────────────────────────┐
  │ src/lab/      plot · frames · idle · contrast · audit ·        │
  │               requests · observers   (unit tested in Vitest)   │
  └────────────────────────────────────────────────────────────────┘
```

| Path                      | What lives there                                                       |
| ------------------------- | ---------------------------------------------------------------------- |
| `src/pages`               | Routes. Pages are static; only islands ship JS.                        |
| `src/components/sections` | Server-rendered page sections.                                         |
| `src/components/islands`  | Interactive React islands, one per demo plus shared controls.          |
| `src/fixes`               | Fix IDs, registry and the `useFixLifecycle` reconciliation hook.       |
| `src/lab`                 | Framework-free measurement and workload code.                          |
| `src/xray`                | X-ray store, timeline runtime and the six scenes (plain DOM code).     |
| `src/stores`              | Cross-island state (nanostores).                                       |
| `src/data/metrics.ts`     | Every production number, with approval status and evidence.            |
| `src/content/work`        | Case studies (MDX, schema in `src/content.config.ts`).                 |
| `src/content/writing`     | Write-ups; `draft: true` posts appear in `npm run dev` only.           |
| `src/lib/seo.ts`          | Schema.org JSON-LD builders (one Person entity across every page).     |
| `src/lib/og.ts`           | Build-time social image renderer (satori + resvg; no runtime cost).    |
| `src/demos`               | Generated route chunks for the bundle demo (`npm run demos:generate`). |
| `src/i18n`                | Locale files for the i18n demo; `keys.gen.ts` is generated.            |
| `docs/adr`                | Architecture decision records.                                         |

Why it is built this way is recorded in [docs/adr](docs/adr).

## Quality gates

`npm run verify` runs them in order and fails fast:

| Gate           | Command                | What it checks                                                                                                                                         |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| i18n keys      | `npm run i18n:check`   | Generated key types match the locale files.                                                                                                            |
| Types          | `npm run check`        | `astro check`, strict TypeScript, `noUncheckedIndexedAccess`.                                                                                          |
| Lint           | `npm run lint`         | ESLint 10, typescript-eslint, Astro and React Hooks rules.                                                                                             |
| Format         | `npm run format:check` | Prettier, including `.astro` files.                                                                                                                    |
| Unit/component | `npm run test`         | Vitest: lab core, stores, metrics guard, colour tokens, SEO helpers, components.                                                                       |
| Build          | `npm run build`        | Static build; fails if an unapproved metric is required.                                                                                               |
| Budget         | `npm run budget`       | Gzip budgets: initial JS ≤ 100 KB (incl. inline scripts), on-demand lab JS ≤ 15 KB, CSS ≤ 10 KB, inlined fonts ≤ 70 KB. Prints the commit it measured. |
| End to end     | `npm run test:e2e`     | Playwright on Chromium, WebKit and Firefox, 10 device profiles, axe WCAG 2.2 AA, no horizontal overflow, CLS checks.                                   |

Run `npx playwright install --with-deps` once before the end-to-end tests.

### Coverage (100%, merged)

CI builds the production site once, then tests that artifact in ten parallel device jobs. The aggregate
`verify` status requires the source checks and every device job to pass. Browser reports and traces are
uploaded even when a job fails or is cancelled. Coverage runs separately with its existing 100% gate.

`npm run coverage` measures unit and end-to-end coverage together and fails unless statements, branches,
functions and lines are all at 100% for every file in `src` (generated demo routes, `keys.gen.ts`, type
declarations and static data excluded).

1. `test:coverage`: Vitest with raw V8 coverage, collected per worker by `tests/setup/v8-coverage.ts`.
2. `test:e2e:coverage`: a build with inline source maps and no minification, then Playwright on Chromium
   (desktop and a 360 px phone) recording browser coverage through the fixture in `tests/e2e/fixtures.ts`.
3. `coverage-config/merge.mjs`: monocart-coverage-reports merges both into `coverage/merged`
   (console summary, `lcov.info`, HTML).

Vite's SSR transform wraps modules in code that never runs in a test (`catch {}`, the `import.meta` fallback,
export getters). Those wrapper ranges are marked covered in `v8-coverage.ts`; nothing written in `src` is.

### Recorded walkthroughs

`npm run build && npm run walkthrough` drives one long, assertion-driven tour on desktop (1440 × 900 Chrome),
tablet (iPad, WebKit) and phone (iPhone 14, WebKit): header, theme, break/fix, every card's x-ray, every demo
control, every language, all sections and links, each case study, the résumé, the PDF and the 404 page. Each
device's video lands in `walkthrough-results/`; a caption names the step, and taps and key presses are drawn.

## Accessibility

The target is **WCAG 2.2 AA everywhere, AAA where it is cheap**: body and secondary text meet 7:1 contrast in
both themes, and every other text pair meets 4.5:1. `tests/unit/tokens.test.ts` checks every colour pair in
both themes.

Beyond axe (run in light and dark, healthy and broken, on every device profile), the end-to-end suite checks:

- keyboard focus is never hidden behind the sticky header or the bottom health bar (2.4.11);
- content survives the WCAG text-spacing overrides without clipping (1.4.12);
- no sideways scrolling down to 320 px wide (1.4.10);
- the Fix 05 table and menus work from the keyboard alone, and the broken panel genuinely does not.

Windows high-contrast mode (`forced-colors`) gets explicit borders and focus outlines. Breaking the site is
opt-in, clearly labelled, and one keypress from fixed; see [ADR 0004](docs/adr/0004-broken-mode-safety.md).

### Fix 05 keyboard model

| Keys            | Moves focus                                           |
| --------------- | ----------------------------------------------------- |
| `W` / `S`       | Between whole rows. `S` from a header goes to row 1.  |
| `A` / `D`       | Between column headers.                               |
| Arrow keys      | Between cells only.                                   |
| `Enter`/`Space` | On a header, sorts by that column (again to reverse). |

The keys only act while focus is inside the table, which keeps single-letter shortcuts within WCAG 2.1.4.

## Theming

Colour tokens in `src/styles/tokens.css` use CSS `light-dark()`, so the site follows the OS theme with no
JavaScript. The header's three-way switch (System, Light, Dark; a single cycling button below 480 px) pins
`data-theme` on `<html>` and stores the choice. A tiny inline script in `BaseLayout` applies a saved choice
before first paint, so there is no flash of the wrong theme.

Lighthouse (mobile and desktop) scores 100 in performance, accessibility, best practices and SEO on every
route at the time of writing.

## Motion

Animation explains what is happening; it never decorates. The break/fix run is choreographed per issue:

- **Breaking:** the headline glitches once, each card shudders as it breaks and the hazard tape drops, the
  brand dot turns red, and the health bar values shake as they cross into the red.
- **Hero words heal with their fixes** (`HERO_WORDS` in `src/fixes/registry.ts`): "fast" with the four
  performance demos, "accessible" with Fix 05, "global" with Fix 06.
- **X-rays:** before each measured run, an x-ray plays over the card's demo and shows the mechanism on a
  tiny example: the scan inside the plot loop vs. a Map lookup, long tasks dropping frames vs. idle chunks
  after `transitionend`, the bundle waterfall vs. route splitting, request lanes and the layout shift vs.
  fetch-on-demand, the Tab path and screen-reader transcript, and the i18n typo vs. a compile error. Whole-site
  runs play a short version. Captions go to a polite live region, a Skip button ends it, and under reduced
  motion it is a still frame (or skipped in whole-site runs). The measurement only starts after the x-ray, and
  nothing animates over a card while it is being measured.
- **Fixing:** the tape peels away; a green wipe and a stamp land when it is done. The toast shows a six-step
  progress bar of commits.
- **Per demo:** the fixed plot streams in while staying responsive (the broken one freezes, then appears at
  once); Fix 05's focus ring glides between rows, headers and cells; translations crossfade.
- **Merged:** the PR badge pops, results rows cascade in and their numbers count up.
- **Site-wide:** case-study cards are a container transform: the card's surface grows into the case study's
  header card and shrinks back on return (cross-document view transitions; surface and title share one timing,
  text fades through and is never scaled, the rest of the page crossfades without sliding; about 300 ms to open
  and 240 ms to return). Coming back puts focus on the card that was opened (`src/lib/return-focus.ts`). The
  theme switch reveals the new theme in a circle from the control, and sections slide in on scroll
  (`animation-timeline: view()`). "← All case studies" goes back in history when the page was opened from the
  homepage in this tab (`src/lib/back-link.ts`), so it returns to the exact scroll position like Back does.
  Smooth scrolling only starts after `load`, so arriving at `/#work` never animates down from the top.

Rules: section entrances use transforms to avoid fading body text or changing layout. Navigation snapshots
and short demo/title effects also use opacity; the LCP headline is never hidden. Everything is CSS or the platform's view
transitions, with JavaScript only for the count-up, the plot stream and the x-ray timelines (loaded on first use,
with their CSS, so they add nothing to the initial page); `prefers-reduced-motion` turns it all
off. See [ADR 0005](docs/adr/0005-motion.md).

### Layout stability

Breaking or fixing a card never moves the page around it, at any width. Results, footnotes, translated
text and route buttons all have space reserved for their longest state; the broken and fixed panels of Fix
05 share the same lines; and the network demo's deliberate late banner shoves content inside its own frame
only. An end-to-end test breaks and fixes every card in view on all Chromium profiles and asserts no layout
shift outside the demo regions.

## SEO

- One `Person` entity (`@id` `https://subhamraj.dev/#person`) referenced from every page's JSON-LD graph:
  `ProfilePage` on the homepage and résumé, `TechArticle` + `BreadcrumbList` on case studies and posts.
- A build-time 1200×630 social image per page (`/og/*.png`), with title, eyebrow and headline metric.
- Clean, canonical URLs with no trailing slash (`build.format: 'file'`); the sitemap matches them and carries
  `lastmod` from `src/data/updated.json`. The 404 page is `noindex`.
- `llms.txt` for AI search, generated from the same content collections.
- Full icon set and web manifest.

Launching (domain, Cloudflare Pages, redirects from the old domain, Search Console, Bing, email): follow
[docs/launch-checklist.md](docs/launch-checklist.md). See [ADR 0006](docs/adr/0006-seo.md).

## Metrics governance

Every production figure lives in `src/data/metrics.ts` with an `approved` flag and an `evidence` note.

- `requireMetric(id)` fails the build if the metric is unapproved. Use it where the copy depends on the number.
- `optionalMetric(id)` returns `undefined` for unapproved metrics, so the sentence is left out.

`designSystemMigration` (~65% of screens migrated) is **unapproved**, so it does not render. To publish it,
confirm the figure with TRM Labs, set `approved: true`, update `evidence`, and rebuild.

Demo workloads are synthetic and labelled as such. Live readings (frame times, long tasks, request counts,
layout shift) are measured on the visitor's device. Browsers without a given `PerformanceObserver` entry type
(for example `longtask` in Safari and Firefox) show "n/a" instead of a made-up value.

### Production smoke check

`npm run smoke -- https://subhamraj.dev` checks every page in the live sitemap, the résumé PDF, homepage social image,
favicon, crawler files, a real 404 and immutable caching on built assets. `.github/workflows/smoke.yml` runs
it after a successful Cloudflare check for the latest default-branch commit, daily, and on demand.

## Deployment

The build is fully static (`dist/`), deployed on **Cloudflare Pages** (step-by-step in
[docs/launch-checklist.md](docs/launch-checklist.md)). `public/_headers` sets the cache and security headers:
hashed `/_astro/*` assets are immutable, `/data/status.json` is `no-store` because the network demo polls it,
and social images cache for a day. `vercel.json` mirrors the same settings if you prefer Vercel.

Update `site` in `astro.config.mjs` and `url` in `src/data/site.ts` if the domain is not `subhamraj.dev`.

## Failure, cancellation and measurement honesty

Every demo has explicit **failed** and **cancelled** states (never shown as healthy or fixed). The
whole-site controller ends a run with a message and usable controls when a demo fails, locks every card's own
Break/Fix while it runs, can be cancelled, and reports "merged" only if all six demos really ended fixed.
Leaving the page cancels work in flight; superseded loads (routes, translations) never overwrite newer state. Each card has a "How this is measured" note (`src/fixes/methods.ts`), the health bar
shows nothing until it has a real sample, and production results are labelled as history, not live
measurements. Details: [ADR 0007](docs/adr/0007-fonts-hydration-and-honest-measurement.md).
`/accessibility` states the WCAG 2.2 AA target, what is tested and the known limits.

## Known decisions

- **TypeScript is pinned to `~6.0`** because typescript-eslint does not support 6.1+ yet.
- **No eslint-plugin-jsx-a11y**: it does not support ESLint 10. Accessibility is enforced with axe in
  Playwright against the rendered page, in both healthy and broken states.
- **One Rollup warning is filtered** in `astro.config.mjs`: the `MODULE_LEVEL_DIRECTIVE` warning about
  `astro:head-inject` from the MDX integration. Nothing else is suppressed.
- **End-to-end tests retry once.** Headless WebKit occasionally crashes a page under heavy parallel load; it
  has never reproduced serially. Retried tests are reported as "flaky", so a real regression stays visible.
- **`npm audit` reports two moderate advisories in `fflate`**, pulled in by satori, which renders social
  images at build time only. Nothing reaches the browser (`npm audit --omit=dev` is clean) and the affected
  function (unzipping malformed archives) is never called with outside input.
- **Web fonts are inlined into the stylesheet** (`src/styles/fonts.css`, ~65.6 KB gzip, cached with it).
  BaseLayout primes their binary bytes before parsing text: WebKit's data-URL loader can otherwise still
  paint a fallback font first. Tests check all five font faces at the first
  styled frame; physical-device review still matters. The fallbacks in `tokens.css` stay metric-matched per
  weight for the first, cold visit.
