# MacroMate

A macro tracker built for bulking and cutting. Installable web app, works offline, all data stays on your device.

- **Today** — a week strip, then what you have left (calories, a percent dial, three macro tracks), then the day's log by meal. The tab bar's centre disc opens the food picker for whichever meal the clock suggests, from any screen.
- **Foods** — your own library. Enter a food once, log it in a couple of taps forever after. Group foods into saved meals.
- **Progress** — three dashboards. *Overview*: streak, adherence, 7-day average, 28 days of calories vs target, and a 12-week consistency heatmap. *Weight*: gradient trend chart with a goal-pace line. *Macros*: 7-day average rings, daily protein against target, and a stacked macro split.
- **Settings** — TDEE calculator (Mifflin-St Jeor), goal targets, backup export/import.

Every chart is drawn by hand as inline SVG in [js/charts.js](js/charts.js) — no libraries, nothing fetched at runtime. Drag across any chart to read a specific day.

The visual system is recorded in [DESIGN.md](DESIGN.md); product truth lives in [PRODUCT.md](PRODUCT.md).

## Running it locally

Any static server works. The service worker needs `http://`, so opening `index.html` from the filesystem will skip offline support.

```bash
python -m http.server 3421
```

Then open `http://localhost:3421`.

## Deploying

The repo root is the app — no build step, no dependencies. GitHub Pages serves it as-is from `main` / root.

After changing any file, bump `CACHE` in [sw.js](sw.js) and `APP_VERSION` in [js/store.js](js/store.js), then push. Clients see an "Update ready" prompt on their next visit.

## How the numbers work

- **BMR** uses Mifflin-St Jeor, multiplied by an activity factor (1.2 sedentary through 1.9 athlete) for maintenance calories.
- **Goal** shifts maintenance by a percentage: cut −10/−20/−25%, bulk +5/+10/+15%.
- **Protein** 2.2 g/kg cutting, 2.0 maintaining, 1.8 bulking. **Fat** 0.8 g/kg with a 0.6 g/kg floor. Carbs take whatever calories are left.
- **Weight trend** is a 7-day rolling average; the weekly rate compares the trend now against the trend a week ago, so a single heavy morning does not move it.
- **A day counts as adherent** when calories land within 5% (or 100 kcal) of target and protein reaches 90% of target — measured against the target that was live on that day, not today's.

Entries store their macros at the moment you log them. Editing a food later changes future logs only; your history stays honest.

## Data

Everything lives in `localStorage` on the device, sharded by month so a day's edit rewrites one small key. There is no server and no sync — moving between devices means Settings → Export backup on one, Import backup on the other.

Storage keys are versioned (`mm:meta.schemaVersion`). Migrations run at boot and snapshot the old data to `mm:backup:migration` first.

## Icons

`icons/icon.svg` is the master. Regenerate the PNGs with:

```bash
python tools/make-icons.py
```

## Dev console

`window.MacroMate` exposes `seedDemo()` (about eight weeks of plausible data for checking charts), `eraseAll()` and `exportBundle()`.
