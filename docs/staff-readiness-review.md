# Staff-readiness patch review · 8 October 2026

The supplied patch is cumulative against `d750081`. Integration uses the current `1e65d5a` tree, keeping
subsequent Windows and iPhone fixes. Earlier favicon and font assets already match the supplied patch.

## Changes to review

| Area                     | Result                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole-site demo controls | Failed/cancelled states; abortable status waits; errors name the failing demo, stop the sequence and return usable retry controls; page departure cancels in-progress runs.                                                                                                             |
| Network demo             | Abortable entity fetches; HTTP and payload validation; visible failed panels with Retry; banner cleanup; polling stops on cancellation/page departure; scoped measurements exclude other demos' requests.                                                                               |
| Sidebar demo             | Transition-end fallback actually runs deferred work exactly once; equal 350 ms workloads; manual toggle disabled during measurements; insufficient samples show n/a.                                                                                                                    |
| Translations             | Ignore superseded responses; load failures revert the selector; panel language follows displayed text; cached imports do not inflate the request log.                                                                                                                                   |
| Plot                     | Pending streaming draws stop on unmount; distinguish incoming records from unique plotted nodes.                                                                                                                                                                                        |
| Measurements             | Real sampled FPS without a 60 FPS cap; pause when hidden; rolling 60-second request count; display-relative estimated dropped frames; bounded observer-backed Resource Timing history; bundle results distinguish decoded code size from new loading.                                   |
| Explanations             | Every demo has a How this is measured disclosure with workload, scope and limits; historical TRM results are labelled separately.                                                                                                                                                       |
| Homepage                 | Selected work precedes the lab; View selected work and Résumé actions; strengths/availability copy; lab introductory box; senior/staff contact heading.                                                                                                                                 |
| Page-health bar          | Show/Hide control with saved preference applied before paint; keyboard labels and focus styles.                                                                                                                                                                                         |
| Content                  | First-person wording; translation/API claims describe the checks and compile-time scope rather than absolute guarantees.                                                                                                                                                                |
| Accessibility            | New /accessibility page, footer link and sitemap entry; states the AA target and incomplete screen-reader testing.                                                                                                                                                                      |
| Budgets                  | Count inline scripts; separate initial JS, on-demand lab code and deliberate synthetic payloads; check inlined fonts; print Git revision; preserve Windows-safe paths.                                                                                                                  |
| Production checks        | npm run smoke checks sitemap pages, résumé, homepage social image, favicon, crawler files, manifest, a real 404 and immutable CSS caching; per-request timeout; workflow listens for this project's Cloudflare check runs, with daily/manual runs and read-only repository permissions. |
| Tests/docs               | Added failure/retry/cancellation, frame/resource, homepage structure, persistence, no-JS and text-spacing checks; ADR 0007 explains the decisions.                                                                                                                                      |

## Integration corrections

- Kept the working card-title and root transitions. The proposed root stagger makes both page snapshots
  faint simultaneously, which could resemble the previous black flicker. It was not introduced.
- Kept explicit instant history correction, the early themed canvas and the back/forward fragment guard.
- Kept back-link protections for already-handled clicks, downloads, new tabs and insufficient history.
- Retained the stronger font-readiness assertions and existing return-history tests.
- Retained Windows content-store execution, clipboard newline normalization and budget path handling.
- Kept the white translation-panel margin above the black code card.
- Corrected an undefined spacing token in the new hero lab box and reserved each health-meter value's
  width and left edge so replacing the initial FPS placeholder does not create a layout shift. The meter pulses highlight
  instead of scaling/translating the reserved boxes, avoiding overflow with text-spacing overrides.
- Fixed abort-listener cleanup and already-aborted measurement windows; capped the resource observer's
  memory even when nobody reads it; stopped network fetches/polling on cancellation without unmounting.
- Isolated the network card's request window from other demos' concurrent downloads. Manual sidebar work
  is cancelled on unmount or when measurement takes over; cancelling a closing sidebar cannot schedule
  fresh heavy work afterwards.
- Made the skip link explicitly tabbable. Windows WebKit's default keyboard mode skips ordinary links;
  an explicit tabindex=0 keeps the main-content shortcut reachable there as well.
- Corrected the supplied smoke workflow: this repository's Cloudflare integration emits check runs,
  not deployment-status events. Checks target production only after success for the latest default-branch
  revision. Skipped older/preview revisions are intentionally excluded.
- Corrected stale font-size and unsupported causal claims in the README/ADR. The other agent's Lighthouse
  and coverage figures are supplied evidence, not independently repeated integration results.

## Remaining review items

- Please recheck physical iPhone navigation in light/dark mode, both back controls and swipe-back. Emulated
  WebKit does not prove physical-device compositor behavior. VoiceOver/NVDA/TalkBack review remains open.
- Confirm current location, TRM end month, design-system adoption scope/time period and the unapproved
  migration percentage. Confirm Orion terminology and the senior/staff, remote-role wording.
- Staff-level case-study expansion still needs your ownership, collaborators, alternatives, rollout,
  cross-team impact, outcomes and shareable evidence. Testimonials require the speakers' permission.
- Draft writings remain unpublished. No invented career facts, metrics, endorsements or screenshots were
  added, and no résumé PDF was rewritten.
- Optional account work remains outside this patch: www/old-domain redirects, email routing, Search Console
  and Cloudflare Email Obfuscation settings. No dashboard setting was changed by this integration.
- Demo workloads are intentionally synthetic; FPS/frame estimates and Resource Timing have browser limits.
  Initial JS and CSS budgets have limited remaining headroom. Future features should be measured again.

## Validation

- 266 unit/component tests passed in 29 files.
- Astro check: 138 files, no errors, warnings or hints. ESLint, Prettier and Git whitespace checks passed.
- Production build: 8 pages. Gzip budgets passed: initial JS 95.9/100 KB, on-demand lab 9.0/15 KB,
  synthetic demo payloads 280.8/320 KB, CSS 9.4/10 KB and fonts 65.6/70 KB.
- The broad ten-profile attempt passed 902 cases, with four timing-sensitive retries and 55 intended
  skips. Two real checks failed (meter startup shift and WebKit skip-link focus); both were corrected and
  retested without relaxing their assertions. All 107 Firefox cases were blocked at browser launch by a
  Windows side-by-side/mozglue error; reinstalling the official test browser did not resolve it. Firefox
  validation remains a limitation of this machine, rather than a passing result.
- The three retried iPhone/iPad break-to-fix sequences passed serially with retries disabled. First-frame
  font readiness, layout, no-JS, text spacing, health-bar persistence, keyboard focus and axe checks were
  rerun on the final build across the nine available profiles: 79 passed, 11 intended skips, zero failures
  or retries.
- Final desktop Chromium and phone-sized WebKit screenshots (light/dark) were captured. Startup shift
  probes reported zero, with no separate font downloads in the navigation tests.
- The production smoke check passed against the existing live deployment before push. The new
  accessibility page and updated homepage will also be checked after Cloudflare publishes this commit.

No claim is made that Lighthouse or merged 100% coverage was independently remeasured during integration.
