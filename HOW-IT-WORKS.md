# How Macro Diary works

## Files and how they fit

| File | Role |
|---|---|
| `index.html` | The whole UI (markup + CSS) for the four pages (Today, Plan, Progress, More). Loads `calc.js`, `stats.js`, `ideas.js`, `backup.js`, `app.js` in that order with plain `<script>` tags, so each defines globals (`Calc`, `Stats`, `Ideas`, `Backup`) the next one uses. Meal icons live in `<template>` tags that `app.js` clones. |
| `stats.js` | Pure date/diary math: Sun–Sat weeks, totals, macro % split (by calories), logging streak, weekly weight averages, serving-size scaling (`servingFactor`: "30 g" → "45 g" = 1.5, only when the units match). Unit tested. |
| `ideas.js` | Built-in meal ideas for the Plan page, tagged High protein / Low calorie / Cutting / Bulking. |
| `calc.js` | Pure math: profile in, targets out. No DOM, so Node tests can `require` it. The bottom `module.exports` / `root.Calc` lines make the same file work in Node and the browser. |
| `backup.js` | Export format + strict import validation. Same Node/browser trick, so it's unit tested too. |
| `app.js` | Everything on screen: state in `localStorage`, Today/Plan/Progress/More pages, charts (inline SVG built with `createElementNS`, no chart library), food sheet, barcode scanning, backup buttons. Registers the service worker at the end. |
| `sw.js` | Service worker: offline copy of the app. |
| `manifest.webmanifest` | Name, icons, colors and `display: standalone` for installing to the home screen. |
| `vendor/zxing-browser.min.js` | Barcode decoder (MIT). Loaded lazily by `app.js` only when you tap Scan. |
| `_headers` | Security headers for Cloudflare Pages (ignored elsewhere). |
| `build.mjs` | Makes `dist/` and stamps `CACHE_VERSION`. |

Flow: page loads → `app.js` reads `localStorage['macro-diary.v1']` → renders → registers `sw.js`. The SW installs in the background and caches the files in its `FILES` list. Next visit, even offline, the SW answers from that cache.

## Cloudflare Access in one paragraph

Access sits in front of the site. Any request without a valid `CF_Authorization` cookie gets a **302 redirect** to `https://<team>.cloudflareaccess.com/...` (the login page). After login, Access sets the cookie on your `pages.dev` domain and redirects back. Every problem below comes from requests that either don't carry that cookie, or carry an expired one, and so get a redirect + HTML login page instead of the file they asked for.

## The manifest fix

- By spec, `<link rel="manifest">` is fetched in CORS mode with credentials **omitted**, even when it's on the same origin. No cookie → Access redirects → the browser gets a login page instead of JSON → no install name/icon.
- `crossorigin="use-credentials"` switches the credentials mode to `include`, so the `CF_Authorization` cookie is sent. Same origin, so no CORS headers are needed.
- I kept the existing filename `manifest.webmanifest` rather than renaming to `manifest.json`: the filename doesn't matter, only the attribute does.
- Icons: `<link rel="icon">` and `apple-touch-icon` are normal same-origin fetches that send cookies, and there's no `crossorigin` option that applies to manifest icons. They *should* work, but browsers fetch install icons in odd ways, so `DEPLOY.md` has a verify step and a fallback (a Bypass rule for the icon paths).

## Service worker: lifecycle and strategy

**Lifecycle refresher**
1. `register('sw.js')`: the browser downloads `sw.js`. On later visits it re-downloads it and compares bytes.
2. Bytes changed → **install** event on the new SW. We download all `FILES` into a new cache named `macro-diary-<CACHE_VERSION>`. If any file fails, install fails and the old SW keeps running untouched.
3. `skipWaiting()` → new SW doesn't wait for old tabs to close.
4. **activate** event: delete old `macro-diary-*` caches, `clients.claim()` to control open pages now.
5. **fetch** events: every request from the page goes through our handler.

**Why `CACHE_VERSION`:** if `sw.js` itself never changes, step 2 never happens. Stamping a new version per build changes the bytes, so every deploy triggers a clean install of a fresh, complete cache, and the old one is deleted. Also, the delete only touches caches starting with `macro-diary-`, because on `github.io` every repo of yours shares one origin and one cache storage.

**What gets cached:** only `cacheable(res)` = `res.ok && !res.redirected && res.type === 'basic'`.
- `!res.ok`: no 404/500 pages.
- `!res.redirected`: the response came after following a redirect (e.g. through the login page). Never cache.
- `type === 'basic'`: a normal same-origin response. Rules out `opaque` (no-cors cross-origin, unreadable), `opaqueredirect` (an unfollowed redirect), and `cors`.

**Strategy per request type**

| Request | Strategy | Why |
|---|---|---|
| Page navigation | **Network first**, pass the response through as-is. Cache only on a network *error*. | When the session has expired, the network answer is a redirect to the login page. Passing it through means the browser goes to the login page, you log in, you come back. Falling back to cache here would silently hide the expiry and you'd never get updates. |
| App files (JS, icons, manifest) | **Network first**; if the network fails *or* the answer isn't cacheable, use the cached copy. | Network first keeps JS in sync with the HTML you just got. But if `app.js` comes back as a login page, running it is useless, and the cached real file is better. |
| Open Food Facts, non-GET | Not touched by the SW. | Needs live data; caching third-party responses isn't worth it. |
| Offline | Everything served from cache. | Fetch throws on no network → `.catch` → cache. |

The cost of network-first: on a slow connection the app waits for the network before falling back. For a tiny app that's acceptable; cache-first would be faster but would hide login expiry and lag one version behind.

**Expired session while online:** opening the app → navigation → redirect → login page. You log in → app. Meanwhile the browser's SW update check also gets a redirect (SW scripts can't be redirected), so updates simply wait until you're logged in. Nothing broken gets cached.

## Export / Import

- **Export** wraps state as `{ app: 'macro-diary', version: 1, exportedAt, data }` and saves `macro-diary-YYYY-MM-DD.json`. On iPhone (and Android) it uses the share sheet (`navigator.share({ files })`), which is the reliable way to save a file from a home-screen app ("Save to Files"). Elsewhere it falls back to a normal download link.
- **Import** treats the file as untrusted:
  - size cap (5 MB) before reading,
  - `JSON.parse` only (never `eval`),
  - every field type- and range-checked: numbers must be real finite numbers in range (no `"150"` strings, no `NaN`/`Infinity`, no negatives), text has length limits, enums (meal, goal, sex...) must be known values, diary keys must look like dates (this also blocks keys like `__proto__`),
  - a **new object is built with only known fields**, so extra junk in the file never reaches the app,
  - nothing is written until everything passes; then you get a confirm prompt if the phone already has data.
- Imported text is only ever shown with `textContent`, so a food named `<img onerror=...>` displays as literal text.
- No `accept` filter on the file picker because some iOS versions grey out `.json` files with certain `accept` values; validation catches wrong files anyway.

## Build

`node build.mjs` copies an **allowlist** of files to `dist/` (safer than "everything except X": a stray `.env` or notes file never ships), stamps `CACHE_VERSION = '<UTC timestamp>-<git hash>'` into `dist/sw.js`, and fails if `sw.js` precaches a file that isn't in `dist/` (that would make every phone's SW install fail). If you add a file the phone loads, add it to both lists.

## Security review (existing code + this change)

Good already:
- No `innerHTML`, `eval`, or `document.write` anywhere. Food names, Open Food Facts product names and all user input go into the DOM via `textContent`. That's the main XSS defense and it holds.
- The barcode is checked with `/^\d{6,14}$/` before being put into the Open Food Facts URL, so it can't inject a path or query.
- Open Food Facts values pass through the form inputs and `parseFloat` before being saved, so odd API values can't land in storage as strings.
- No secrets in client code (there's nothing to keep secret: no API keys, no backend).

Added:
- `_headers` (Cloudflare Pages): a **Content-Security-Policy** that only allows scripts from our own origin and network calls to our origin + Open Food Facts, blocks framing (clickjacking), plus `nosniff`, `no-referrer`, and camera-only permissions. Even if an XSS bug appears later, injected inline scripts won't run and data can't be sent to an attacker's server. Tested: the app, scanner loading and offline mode run with no CSP errors.
- `navigator.storage.persist()`: asks Chrome/Android not to evict the diary under storage pressure.

Remaining risks / things to know:
- `style-src 'unsafe-inline'` is needed for the inline `<style>`/`style=` in `index.html`. Low risk (CSS injection is far weaker than script injection); moving CSS to a file would let us drop it.
- `localStorage` is readable by any script on the origin. Fine here (only our script runs, CSP enforces it), but never put a token or password there.
- The backup file holds health data (weight, age, pregnancy status). It's plain JSON; anyone who gets the file can read it.
- The repo is public. Access hides the *hosted* app, not the source. No secrets in it, but that's what "private" means here.

## Downsides you didn't list

- **iOS Safari 7-day storage eviction:** in a Safari *tab*, Apple can delete a site's `localStorage` after 7 days without a visit. Home-screen apps are exempt. Tell friends to use the installed app (FRIENDS.md does).
- **Removing a friend** doesn't wipe their installed app: it keeps running offline from cache. They just stop getting updates. Harmless here (no secrets), but worth knowing.
- **Two copies of data on iPhone:** Safari and the installed app have separate storage, so food logged in Safari doesn't show in the app. Use Export/Import to move it.
- **Old GitHub Pages copy:** stays public until you turn it off (DEPLOY.md step 5).
- Updates are network-first, so a phone on bad signal can feel slow to open until it gives up and uses the cache.
