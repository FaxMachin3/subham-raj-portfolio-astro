# Subham Raj · Portfolio

**Break the site, watch him fix it.** Six live demos rebuild problems Subham has fixed in production. Each one
can be broken and fixed in the visitor's browser, and every number is measured on the visitor's own device.

Built with Astro 7 (static output), React 19 islands and nanostores.

## Quick start

```sh
nvm use 22            # Node >= 22.12
npm ci
npm run dev           # http://localhost:4321
npm run verify        # every quality gate, the same as CI
```

## Architecture

```text
              Astro pages (static HTML, zero JS by default)
  ┌────────────────────────────────────────────────────────────────┐
  │ Hero · Work · Leverage · Experience · Contact     (.astro)     │
  │ /work/[slug] (MDX content collection) · /resume · 404          │
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
| `src/stores`              | Cross-island state (nanostores).                                       |
| `src/data/metrics.ts`     | Every production number, with approval status and evidence.            |
| `src/content/work`        | Case studies (MDX, schema in `src/content.config.ts`).                 |
| `src/demos`               | Generated route chunks for the bundle demo (`npm run demos:generate`). |
| `src/i18n`                | Locale files for the i18n demo; `keys.gen.ts` is generated.            |
| `docs/adr`                | Architecture decision records.                                         |

Why it is built this way is recorded in [docs/adr](docs/adr).

## Quality gates

`npm run verify` runs them in order and fails fast:

| Gate           | Command                | What it checks                                                                                                       |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| i18n keys      | `npm run i18n:check`   | Generated key types match the locale files.                                                                          |
| Types          | `npm run check`        | `astro check`, strict TypeScript, `noUncheckedIndexedAccess`.                                                        |
| Lint           | `npm run lint`         | ESLint 10, typescript-eslint, Astro and React Hooks rules.                                                           |
| Format         | `npm run format:check` | Prettier, including `.astro` files.                                                                                  |
| Unit/component | `npm run test`         | Vitest: lab core, stores, metrics guard, components.                                                                 |
| Build          | `npm run build`        | Static build; fails if an unapproved metric is required.                                                             |
| Budget         | `npm run budget`       | Homepage JS ≤ 90 KB and CSS ≤ 10 KB gzip (static imports).                                                           |
| End to end     | `npm run test:e2e`     | Playwright on Chromium, WebKit and Firefox, 10 device profiles, axe WCAG 2.2 AA, no horizontal overflow, CLS checks. |

Run `npx playwright install --with-deps` once before the end-to-end tests.

Lighthouse (mobile and desktop) scores 100 in performance, accessibility, best practices and SEO on every
route at the time of writing.

## Metrics governance

Every production figure lives in `src/data/metrics.ts` with an `approved` flag and an `evidence` note.

- `requireMetric(id)` fails the build if the metric is unapproved. Use it where the copy depends on the number.
- `optionalMetric(id)` returns `undefined` for unapproved metrics, so the sentence is left out.

`designSystemMigration` (~65% of screens migrated) is **unapproved**, so it does not render. To publish it,
confirm the figure with TRM Labs, set `approved: true`, update `evidence`, and rebuild.

Demo workloads are synthetic and labelled as such. Live readings (frame times, long tasks, request counts,
layout shift) are measured on the visitor's device. Browsers without a given `PerformanceObserver` entry type
(for example `longtask` in Safari and Firefox) show "n/a" instead of a made-up value.

## Deployment

The build is fully static (`dist/`). `vercel.json` sets the cache headers: hashed `/_astro/*` assets are
immutable, and `/data/status.json` is `no-store` because the network demo polls it. Any static host works if
it applies the same two headers.

Update `site` in `astro.config.mjs` and `url` in `src/data/site.ts` if the domain is not `subhamraj.dev`.

## Known decisions

- **TypeScript is pinned to `~6.0`** because typescript-eslint does not support 6.1+ yet.
- **No eslint-plugin-jsx-a11y**: it does not support ESLint 10. Accessibility is enforced with axe in
  Playwright against the rendered page, in both healthy and broken states.
- **One Rollup warning is filtered** in `astro.config.mjs`: the `MODULE_LEVEL_DIRECTIVE` warning about
  `astro:head-inject` from the MDX integration. Nothing else is suppressed.
- **Font fallbacks are metric-matched** (`size-adjust` and ascent/descent overrides in `tokens.css`) and the
  two most visible Poppins weights are preloaded, so the font swap does not shift layout.
