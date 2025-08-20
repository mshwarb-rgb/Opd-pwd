# OPD Tap Logger (PWA)

Tap-only OPD data logger (Patient ID keypad, gender, age, 21 diagnoses, WW/Non-WW for surgical, disposition). Exports CSV/XLS; shows today’s summary incl. Age × Gender table. Works offline.

## Quick start
1) Create a new GitHub repo (e.g., `opd-pwa`).
2) Upload: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`.
3) In repo **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or default branch), **/ (root)**
4) Wait for the Pages link (e.g., `https://yourname.github.io/opd-pwa/`).
5) Open on Android (Chrome) → menu → **Add to Home screen**.

## Notes
- Data is stored locally (localStorage) on the device.
- If you change files and the app looks “stuck”, reload twice. To fully reset cached files: Chrome → Site settings → Clear & reset.
- Age code in export: `1=<5, 2=5-14, 3=15-17, 4=≥18`.
