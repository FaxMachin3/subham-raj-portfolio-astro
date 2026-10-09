# Job-search facts and mobile usability review

Integrated the new round in `subham-raj-portfolio.patch` onto `61a8e06`. The supplied patch is cumulative
against `d750081`; comparing its reconstructed output with the previous incoming lab/motion patch isolated
24 changed files. The existing font priming, themed first paint, history restoration, import recovery,
cancellation guards, browser matrix and coverage fixes are retained.

## Accepted changes

- Use the facts supplied in the handover: Bhubaneswar, immediate availability, remote work and openness to
  relocation; target senior, staff and lead frontend roles without changing past employment titles.
- Set TRM's résumé date range to November 2023 through October 2026. Since the stated last day is October 21,
  remove premature "ex-TRM" wording from the hero and use neutral "Experience at" wording in `llms.txt`.
- Explain the supplied Paytm A/B-service caching and traffic-split work, retaining the existing approximate
  90% cost and 30% load-time claims without adding a new metric.
- Remove the unapproved design-system migration estimate and its optional rendering path.
- Replace the public résumé PDF with the supplied one-page public copy. Its text and rendering were checked;
  no phone number is present. The handover mentions résumé, cover-letter and LinkedIn source scripts, but
  those files are not in this patch and were not updated in the separate work repository.
- Add a native disclosure menu on screens up to 720px, including all primary links and email. Keep native
  navigation and no-JavaScript operation; add Escape/focus return, outside-tap and link-selection closure.
- On phones, hide the health bar away from the lab, retaining it for an active whole-site run.
- Keep the current run step visible independently of the toast timer, and shorten inter-fix pauses from
  900ms to 400ms. Measurement durations, cancellation and locking are unchanged.
- Consolidate identical header declarations and move the canvas comment outside its inline CSS payload
  to fit the existing budget. The early canvas and theme scripts are unchanged.

## Deliberately omitted

- Earlier cumulative changes already integrated, including their outdated versions of later local fixes.
- A CSS-budget increase. The existing 10KB gzip gate remains enforced.
- Font removal, a replacement Orion statistic or a shortened network measurement window.

## Validation

The other agent's Lighthouse and walkthrough results describe its build, not this merged implementation.
Local validation:

- All 295 unit/component tests passed.
- The full Chromium desktop and Android 360px coverage suites passed: 216 tests, 12 input/viewport-specific
  skips. An existing header-navigation test was updated to open the new menu on narrow screens.
- Merged coverage passed at 100% statements, branches, functions and lines, with no exclusions added.
- iPhone WebKit regression checks passed: 31 tests and one keyboard-specific skip. This covered the native
  menu with and without JavaScript, health-bar preferences, accessibility, fonts, returns and failures.
- The public résumé was rendered and checked for layout, selectable text and absence of a phone number.
- A 360px visual check covered the menu and run-progress controls.
- Types, lint, formatting, generated i18n keys, production build and unchanged size budgets were checked.

GitHub's clean CI run and Cloudflare deployment are monitored after the push; the live site and public PDF
are then checked independently. Browser emulation does not replace physical-device review.
