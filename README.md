# Macro Diary

A phone web app in the style of MyFitnessPal: enter your details, get daily calorie and macro targets, log food by hand or by scanning a barcode.

- **Targets:** Mifflin-St Jeor (or Katch-McArdle when body fat % is known) × activity, adjusted for goal (cut, recomp, maintain, bulk) and diet intensity. Math lives in `calc.js`.
- **Barcodes:** scanned with the camera via ZXing (`vendor/`, MIT), looked up on [Open Food Facts](https://world.openfoodfacts.org).
- **Data:** stored only in the browser on each phone (`localStorage`). No accounts, no server.

Run locally: `python3 -m http.server` then open http://localhost:8000. The camera needs HTTPS (or localhost).
Tests: `node --test test/calc.test.js`

Install on a phone: open the hosted URL, then Share → Add to Home Screen (iPhone) or ⋮ → Install app (Android).
