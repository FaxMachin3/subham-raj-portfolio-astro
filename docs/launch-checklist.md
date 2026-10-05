# Launch checklist

Everything here happens in your own accounts. Do it in order; each step lists how to confirm it worked.
Budget about ₹1,400 a year for the domain; everything else is free.

## 1. Buy the domain

1. Create a Cloudflare account and open **Domain Registration → Register Domains**.
2. Search `subhamraj.dev` and buy it for 3–5 years up front (the price is the same every year, and it avoids
   Indian cards failing automatic renewals from foreign companies). Pay with PayPal or a card without a
   foreign-exchange fee.
3. Add PayPal as a backup payment method and turn on auto-renew anyway.

**Check:** the domain shows under _Websites_ with status _Active_.

## 2. Publish the repository

1. Create a new public GitHub repository, for example `subhamraj.dev`.
2. From the project folder: `git init && git add . && git commit -m "Launch" && git branch -M main`, then
   add the remote and push.
3. The **CI** workflow runs every quality gate on each push and pull request.

**Check:** the _Actions_ tab shows a green run.

## 3. Deploy on Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, and pick the repository.
2. Framework preset **Astro**, build command `npm run build`, output directory `dist`.
   Under _Environment variables_ set `NODE_VERSION` = `22`.
3. After the first deploy: **Custom domains → Set up a custom domain → `subhamraj.dev`**. Add
   `www.subhamraj.dev` too.
4. `public/_headers` sets caching and security headers automatically.

**Check:** `https://subhamraj.dev/resume` loads, and `https://subhamraj.dev/og/home.png` shows the social image.

## 4. Redirect `www` and the old domain

Cloudflare Pages' `_redirects` file cannot redirect between domains, so use **Bulk Redirects**
(account level → _Bulk Redirects_):

| Source               | Target                  | Status | Options                                                       |
| -------------------- | ----------------------- | ------ | ------------------------------------------------------------- |
| `www.subhamraj.dev`  | `https://subhamraj.dev` | 301    | preserve query string, subpath matching, preserve path suffix |
| `shubhamraj.dev`     | `https://subhamraj.dev` | 301    | same                                                          |
| `www.shubhamraj.dev` | `https://subhamraj.dev` | 301    | same                                                          |

For the old domain, add it to Cloudflare first (it can stay registered at Namecheap: change its
nameservers to the two Cloudflare gives you), then add proxied DNS records (`A @ 192.0.2.1`,
`A www 192.0.2.1`) so the redirect rule can catch its traffic.

Before 30 March 2027, transfer the old domain to Cloudflare as well (about $12.20, which includes a year of
renewal).

**Check:** `curl -I https://shubhamraj.dev/anything` returns `301` with `location:
https://subhamraj.dev/anything`.

## 5. Search engines

1. **Google Search Console:** add a _Domain_ property for `subhamraj.dev` (verify with the DNS record it
   gives you; Cloudflare can add it in one click). Submit `https://subhamraj.dev/sitemap-index.xml`.
2. Add the old domain as a property too, then use **Settings → Change of address** to tell Google it moved.
   This needs the 301s from step 4 in place.
3. **Bing Webmaster Tools:** _Import from Google Search Console_. Bing also powers ChatGPT search.
4. Test the homepage and one case study in the **Rich Results Test** (`search.google.com/test/rich-results`)
   and paste a URL into LinkedIn's **Post Inspector** to refresh the preview image.

**Check:** Search Console shows the sitemap as _Success_ within a day or two; pages appear under _Pages →
Indexed_ over the following weeks.

## 6. Email: hi@subhamraj.dev

1. Cloudflare dashboard → the domain → **Email → Email Routing → Get started**.
2. Create `hi@subhamraj.dev` → forward to your Gmail, and confirm the verification email.
3. Then change `email` in `src/data/site.ts` and push. The site, structured data and `llms.txt` all update
   from that one value.

**Check:** an email to hi@subhamraj.dev arrives in Gmail.

## 7. Analytics (optional, privacy-friendly)

Cloudflare dashboard → the Pages project → **Metrics → Web Analytics → Enable**. It uses no cookies, so no
consent banner is needed.

## 8. Profiles

1. **LinkedIn:** set the website field to `https://subhamraj.dev` (label it "Portfolio") and add the
   homepage to _Featured_.
2. **GitHub:** add `https://subhamraj.dev` to your profile and to the README of your profile repository.
3. Use the same photo, name ("Subham Raj") and headline everywhere.

## 9. Publishing a write-up

Posts live in `src/content/writing`. Edit the text, set `draft: false`, update `updated:`, and push. The
post, its social image, the homepage _Writing_ section and the sitemap all appear automatically.
