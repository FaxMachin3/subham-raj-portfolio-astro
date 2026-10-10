# Option Y: local mobile navigation review

The mobile header (up to 720px) now opens a full-screen navigation panel with four numbered primary links,
current availability, and email/LinkedIn/GitHub actions. It follows the existing paper-and-ink colours in
both light and dark themes. Desktop navigation retains its current layout.

## Motion and interaction

- The icon morphs between two lines and a cross; no visible "Menu" text is used. Accessible names announce
  "Open navigation" and "Close navigation".
- A circular clip expands from the icon's centre in 380ms and collapses into it in 260ms. Interrupted
  animations reverse from their current clip; stale completion callbacks cannot close a reopened panel.
- Reduced-motion users receive immediate opening and closing. Native details navigation remains usable
  without JavaScript, or without the Web Animations API.
- The page behind the panel is inert. Keyboard focus stays in the header/panel, including the theme switch;
  Escape and manual close return focus to the icon. Previous inert states are restored.
- The panel itself can scroll on short screens. Background scroll is locked while it is open.
- Scroll is captured before native pointer focus, because WebKit can adjust the page when focusing a
  sticky disclosure button. Restoration is synchronous and uses `behavior: 'instant'`, before paint and
  before a selected link's default navigation. Cancelled pointer gestures do not supply stale positions
  to a later keyboard opening.
- Link selection closes immediately so native hash navigation and the existing page/card transitions
  continue to operate normally. Pagehide and resizing to desktop clear the panel and its scroll lock.

The font priming, case-study history restoration, themed first paint, card transitions, and lab measurement
code were not changed. The navigation uses existing fonts and theme tokens with no added dependency.

## Performance allowance

The requested full-screen design adds roughly 0.3KB compressed CSS. The CSS limit changes from 10KB to
10.5KB, retaining a small bounded allowance. The existing 100KB initial JavaScript and 70KB font limits,
and the 100% merged coverage gate, are retained.

## Connecting the www hostname

Verified on October 10, 2026: `https://subhamraj.dev` returns HTTP 200; `www.subhamraj.dev` does not resolve.
The `.com` address is a different domain and currently resolves to a different server.

For the domain already purchased:

1. Open Cloudflare **Workers & Pages → subham-raj-portfolio-astro → Custom domains**.
2. Select **Set up a custom domain**, enter **www.subhamraj.dev**, then continue and activate it.
3. Cloudflare should create the required CNAME and provision HTTPS. Wait for the hostname to show Active,
   then test `https://www.subhamraj.dev`.
4. Optionally configure a permanent redirect from `www.subhamraj.dev` to `https://subhamraj.dev`, preserving
   paths and query strings, so the existing canonical address stays consistent.

Associate the hostname in Pages before adding DNS manually. For `.com`, ownership and configuration of
that separate domain would be required; adding a `.dev` subdomain does not configure `.com`.

Official instructions:

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/how-to/www-redirect/

## Review status

Local changes only. No commit, GitHub push, deployment, or Cloudflare account change was made for this work.
Browser automation uses Chromium and Playwright WebKit; a physical iPhone check remains part of user review.

## Validation completed

- 299 unit/component tests pass.
- Full desktop and small-phone Chromium suite: 220 pass, 16 expected skips, no failures or retries.
- Final production build: 18 targeted Android, iPhone SE WebKit and iPhone 14 WebKit checks pass in both
  themes, including scroll preservation, history return, short screens, focus trapping, resizing and
  native navigation without JavaScript. Three additional keyboard-opening checks pass in those profiles.
- Merged unit and browser coverage passes the existing 100% statements, branches, functions and lines
  requirements. An independent browser keyboard sample was added to the preserved full-suite raw data;
  the keyboard path is also in the committed-test candidate so future full coverage runs exercise it.
- Astro check, lint, translation validation and changed-file formatting checks pass.
- Production budgets pass: initial JS 99.6KB/100KB, CSS 10.3KB/10.5KB, fonts 65.6KB/70KB, on-demand lab
  9KB/15KB. Budget figures are gzip sizes. Build and coverage checks use production output.
- Open navigation passes axe in both light and dark themes. Intermediate animation frames were inspected
  to confirm a circular reveal centred at the menu icon.

Local review: http://127.0.0.1:4321/ on this computer, or http://192.168.1.20:4321/ from the same network.

## Follow-up: console errors on October 10

The Experience link reproduced an uncaught `AbortError` when entering the homepage from a résumé or case
study. The incoming `pagereveal` runs before the fragment target is parsed, so the existing scroll guard
intentionally calls `skipTransition()`. Its `ready` promise rejects and previously had no rejection
handler. Added a local handler to the page-transition lifecycle, keeping the fragment scroll guard and
card transitions intact. Theme transitions now handle the same expected pre-start cancellation.

Added a unit test for a skipped theme transition and browser regressions for Work, The fixes and
Experience from both inner pages, in light and dark themes. Follow-up verification: 300 unit tests pass;
63 browser checks pass across desktop Chromium, small-phone Chromium and iPhone SE WebKit (9 expected
skips); type check and lint pass. Production size budgets pass.

The separate scrolling trace references `react_devtools_backend_compact.js` and its shutdown debugging
Bridge. That file/string is absent from the site source and production output. Scrolling across Work,
The fixes, Experience and Contact in a clean Chromium context produces no uncaught errors and loads no
React DevTools backend scripts. Temporarily disable the React Developer Tools browser extension and reload
the tab to confirm the injected tool is the source. No site code was added to suppress extension errors.

Both follow-up fixes remain local; nothing was committed or pushed.

## Follow-up: invalid-state aborts during repeated navigation

The reported message identifies a cross-document transition losing its navigation opt-in. Its exact
natural trigger did not reproduce in a clean Chromium session: 15 repeated résumé/section/theme/history
cycles and 16 case-study entry/return cycles completed without errors. Explicitly removing navigation
opt-in during outgoing page swaps also produced no uncaught errors in that session.

There were still incomplete promise paths in the local handlers. Added rejection handlers to the
outgoing `pageswap` transition as well as the incoming one. Replaced `.finished.finally(cleanup)` with
`.finished.then(cleanup, cleanup)`: cleanup still runs on rejection, while the returned promise resolves
instead of creating a second unhandled rejection. The theme animation's promise chain also handles a
pseudo-element becoming unavailable after `ready` resolves. No global error suppression was added.

New regressions reject both `ready` and `finished` with the supplied `InvalidStateError`, verify cleanup,
and exercise repeated native case-study/section returns. Validation: 302 unit tests and 69 targeted
browser tests pass (9 expected skips) across desktop Chromium, phone Chromium and iPhone SE WebKit.
Type check, lint, formatting and production budgets pass. Card transitions, circular menu animation and
theme animations remain enabled; no CSS animation opt-in or motion preference was changed.

## Follow-up: manual testing in the user's Chrome profile

Manual testing reproduced fresh `InvalidStateError` reports on case-study entry and return even with
the latest handlers loaded. This rules out stale documents as the complete explanation. Temporary
diagnostics confirmed a main-document unhandled rejection and an incoming `pagereveal` with a null
`viewTransition`; the rejected promise did not match any transition exposed to the lifecycle handlers.
The abort therefore happens before those handlers can attach a rejection handler.

The navigation opt-in lived in the external stylesheet, after the initial inline scripts. Merely adding
the rule after the theme script did not resolve the error. Moving the opt-in and its reduced-motion
opt-out into the first inline style, before any script, produced clean manual case-study round trips.
The theme canvas styles move with that block; the theme selection still runs synchronously before the
body is parsed. External transition animation styles, native history, fragment handling and font loading
remain intact. No global rejection suppression or native API monkeypatch is included.

A new browser regression checks that Chromium actually exposes an incoming transition on entry and
return, rather than merely checking for the absence of console errors. Temporary tracing was removed.
Changes remain local with no commit or push.

Final manual verification in the user's existing Chrome tab: case-study entry and the site's Back link
in dark mode, case-study entry and native browser Back in light mode, Experience from a case study,
and Work on the homepage produced no new console errors. The original System theme preference was
restored. Screenshot: `../../_review/chrome-navigation-verified.jpg`.

Latest validation: 71 targeted browser tests passed, with 10 expected skips, across desktop Chromium,
small-phone Chromium and iPhone SE WebKit. Type check (146 files), lint, changed-file formatting and
production budgets passed. These browser checks include native card morphs, exact scroll restoration,
font stability, both themes, reduced motion and the circular mobile navigation.
