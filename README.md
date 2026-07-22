# Clement-Math
Math Calculator and associated Documentation.

**Live site:** https://naclie88.github.io/Clement-Math/ (see *GitHub Pages* below
for the one-time setup step this needs).

## Layout

Each calculator lives in its own subfolder, self-contained with an
`index.html` (open directly in a browser — no build step) and a `README.md`
documenting its formulas and assumptions.

- [`class3-lever-calculator/`](class3-lever-calculator/) — bent class-3
  lever impact-to-spring shock absorber: force/travel/energy sizing for the
  power stroke, plus a dead-center return-stroke analysis to minimize
  home-stop impact. Also includes `optimizer.html` (a Monte Carlo
  parameter-sweep / design-space explorer over the same model) and
  `settings.html` (unit preferences shared by both, with a live
  self-verifying conversion test).

`shared/` holds cross-calculator utilities so future calculators don't
reinvent them:

- `theme.css` — the visual language (tokens, cards, buttons, tables, chips).
- `units.js` — unit conversion, the *only* place any conversion factor is
  defined. Every composite unit is derived at runtime from three exact
  constants (inch, pound-mass, standard gravity), never a second hand-typed
  decimal, and it ships a `selfTest()` that round-trips every unit and
  independently cross-checks the physics — see any calculator's Settings
  page to run it live.
- `unit-prefs.js` — reads/writes the shared per-quantity unit choices
  (`localStorage`), so picking units once in Settings applies everywhere.
- `prng.js` — seeded `mulberry32` RNG for reproducible Monte Carlo sampling.
- `spreadsheet-export.js` — CSV + a dependency-free real `.xlsx` writer
  (hand-rolled zip/OOXML, no library, works fully offline).
- `idb-store.js` — tiny IndexedDB wrapper for persistent, offline-capable
  storage.

A future calculator that needs units, export, or persistence should reuse
these rather than re-implementing them.

## GitHub Pages

A workflow (`.github/workflows/pages.yml`) deploys this repo to GitHub Pages
on every push to `main` or the active feature branch, using GitHub Actions
as the Pages build source. **One-time manual step required**: in this repo's
Settings → Pages, set *Source* to **GitHub Actions** (repo admin access
needed — this can't be done via the API tooling used to build these tools).
Once that's set, pushes deploy automatically and the site is live at the URL
above.

## Root `index.html`

A small landing page linking to each calculator — the entry point once the
site is hosted.
