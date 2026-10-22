# Macro Diary

A phone web app in the style of MyFitnessPal: enter your details, get daily calorie and macro targets, log food by hand or by scanning a barcode.

- **Pages:** Today (week strip, calories and macros, Breakfast/Lunch/Dinner/Snacks), Plan (meal ideas by goal plus your saved meals, logged in one tap), Progress (calories per day Sun–Sat, weekly weight trend, macro pie), More (profile, targets, backup).
- **Targets:** Mifflin-St Jeor (or Katch-McArdle when body fat % is known) × activity, adjusted for goal (cut, recomp, maintain, bulk) and diet intensity. Math lives in `calc.js`.
- **Barcodes:** scanned with the camera via ZXing (`vendor/`, MIT), looked up on [Open Food Facts](https://world.openfoodfacts.org).
- **Offline:** `sw.js` saves the app files on first visit; everything but barcode lookup works without internet. Safe behind Cloudflare Access (never caches login redirects).
- **Data:** stored only in the browser on each phone (`localStorage`). No accounts, no server. Goals → Backup exports/imports a `.json` file.

Run locally: `python3 -m http.server` then open http://localhost:8000. The camera needs HTTPS (or localhost).
Tests: `node --test`

Build for upload: `node build.mjs` (makes `dist/`). Hosting: see [DEPLOY.md](DEPLOY.md). For friends: [FRIENDS.md](FRIENDS.md). How it all fits together and the security notes: [HOW-IT-WORKS.md](HOW-IT-WORKS.md).

Install on a phone: open the hosted URL, then Share → Add to Home Screen (iPhone) or ⋮ → Install app (Android).
