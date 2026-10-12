# Domain and error-page review

Reviewed on 12 October 2026. Search Console sitemap submission is deferred at the owner's request.

## Error pages

The existing `src/pages/404.astro` builds the top-level `404.html` that Cloudflare Pages uses for missing
files. It uses the shared layout, provides a homepage recovery link, sets `noindex`, and omits the
canonical link. Existing end-to-end tests cover its content, HTTP status and indexing metadata.

Live checks returned HTTP 404 and the custom error page for:

- `/review-missing-page-20261012`
- `/work/review-missing-case-study`
- `/resume/review-missing-page`

Each response had `noindex`, no canonical link, and a homepage link. A direct visit to `/404` returned
200 with `noindex`: this is the explicit static page, not a missing URL. Actual missing routes return
404, so no routing override is needed.

Cloudflare's separate Custom Errors feature handles edge/origin errors and challenges and is available
on paid plans. The current Free plan still supports the repository's custom Pages 404. Keep this setup;
an upgrade solely to brand rare infrastructure errors is not recommended. Adding a static `500.html`
would not automatically replace Cloudflare infrastructure failures. No outage was deliberately caused.

References:

- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/rules/custom-errors/

## Repository changes

Updated `site.email` to `hello@subhamraj.dev`, after the owner confirmed delivery to Gmail. Header and
contact links, the accessibility contact address, Person structured data, and `llms.txt` consume this
single setting. The resume PDF is an independent document and is unchanged.

Updated the launch checklist to record the actual domain, redirects, DNSSEC, verified email forwarding,
and deferred Search Console task. Made old-domain migration instructions conditional on ownership,
removed an unverified transfer deadline/price, and updated the recommended build runtime to Node 24
to meet the package's minimum version. No Cloudflare build environment was changed in this audit.

The canonical site URL and sitemap configuration already use `https://subhamraj.dev`. DNS records,
DNSSEC, incoming email routing and Google ownership verification require no additional runtime code.
Keep the existing edge redirects; duplicating them in the application is unnecessary.

No new backend, Pages Function, wildcard route or global caching rule is needed. No existing navigation
or animation work was modified. No changes were committed or pushed by this review.

## Verification

- Existing production smoke check passed: all seven sitemap pages, PDF, social image, favicon, crawler
  files, manifest, custom 404 and immutable stylesheet caching.
- Production build, lint of the changed TypeScript file, and formatting checks passed.
- Six existing 404 and homepage SEO tests passed across Chromium desktop and emulated iPhone 14
  WebKit. These are automated browser checks, not a physical iPhone test.
- Generated homepage, accessibility page and `llms.txt` contain the new contact address and no longer
  contain the old Gmail address.
- Public DNSSEC validation and forwarding delivery were confirmed during domain setup; the owner
  tested delivery using another email account.

Search Console ownership is verified and its live inspection accessed the sitemap, but the sitemap
report still showed a fetch failure. Its resubmission and follow-up remain deferred.
