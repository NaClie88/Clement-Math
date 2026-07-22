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
  home-stop impact. Also includes `optimizer.html`, a Monte Carlo
  parameter-sweep / design-space explorer over the same model.

`shared/` holds cross-calculator utilities so future calculators don't
reinvent them: `theme.css` (the visual language), `physics.js`-style pattern
for pure computation modules, `prng.js` (seeded RNG), `spreadsheet-export.js`
(CSV + dependency-free real `.xlsx` export), `idb-store.js` (tiny IndexedDB
wrapper for persistent, offline-capable storage).

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
