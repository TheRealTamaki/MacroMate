# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: Jade, tracking her own training nutrition. Bodybuilding-oriented — the goal is muscle gain or fat loss in deliberate blocks, not casual weight management. She knows her own numbers and does not need to be taught what a macro is.

The usual scene is at the table or on the couch, two hands free, phone close to the face, not rushed. Density is affordable; this is not a one-handed-in-the-kitchen product. It is installed to the phone home screen and also opened on desktop.

## Product Purpose

A ledger. The dominant job at the moment of opening is **log what I just ate** — eating is already decided, and the app records it. Speed through that path is the product.

Reviewing progress is a real but secondary job, done in a different sitting: is trend weight tracking the goal rate, is protein being hit, do targets need moving.

Success is that a day gets logged completely, most days, for the length of a training block, with no friction that makes skipping tempting.

## Positioning

Four things a mainstream tracker cannot truthfully offer at once:

- **Speed on a fixed food set.** She eats the same 30-40 foods. Logging comes from a personal library she owns, not a crowd-sourced search full of strangers' bad entries. No ads, no upsell, no paywall.
- **Built for lifting, not dieting.** Protein-first, trend weight against a goal rate, cut and bulk blocks. Mainstream apps are built for casual weight loss and it shows in what they put on screen.
- **Local data.** No account, no cloud, no company reading the food log. Works offline and on a plane.
- **Hackable.** It is her own code; something annoying gets fixed that day rather than never.

## Operating Context

- Installed PWA on phone (primary) and desktop browser (secondary).
- Logging happens several times a day, after eating. Weigh-ins happen in the morning. Review happens roughly weekly.
- Data lives on-device per browser, so phone and desktop hold separate copies. JSON export/import is the only bridge between them and the only backup.
- Food entries are macro snapshots at log time, so editing a food later never rewrites history.

## Capabilities and Constraints

**Confirmed functionality:** daily logging against four renamable meals; personal food library (per 100 g or per unit, named servings); meal presets that expand into individual entries; quick-add raw macros; TDEE and target calculator (Mifflin-St Jeor, activity multiplier, cut/maintain/bulk with slow/standard/aggressive pacing); manual target override; body-weight logging with a 7-day trend; progress dashboards; JSON export/import; erase all.

**Technical constraints, all deliberate and durable:**

- Vanilla HTML/CSS/JS, ES modules, **no build step and no runtime dependencies**. The repo root is the deployed artifact.
- Hosted on GitHub Pages at a project path (`/MacroMate/`), so every URL must stay relative and routing stays hash-based.
- Must work fully offline after first load; a versioned service worker precaches everything. Nothing may be fetched at runtime — no CDN fonts, no chart library, no API.
- localStorage with a versioned schema and month-sharded day logs.
- Charts are hand-drawn inline SVG.

**Terminology:** kcal, protein/carbs/fat (P/C/F), TDEE, trend weight, cut/bulk/maintain, block, adherence.

## Brand Commitments

Name: MacroMate. No logo, wordmark, or palette has been committed to — the current orange-on-near-black scheme was a first-build default, not a decision, and is open to replacement.

## Evidence on Hand

- Working implementation at `index.html`, `css/app.css`, `js/` — treat as product truth for behaviour, and as evidence rather than authority for appearance.
- `js/store.js` exposes `seedDemo()`, which generates roughly eight weeks of plausible logs and weigh-ins. Every design review should run against seeded data, never an empty app.
- Live at https://therealtamaki.github.io/MacroMate/
- A reference screenshot the user supplied (soft neumorphic orange nutrition app) — supplied with the comment that it reads as AI slop. Its role is unresolved at product level and is a visual-direction question, not a product fact.
- No user research, testimonials, benchmarks, or usage data exist. None may be invented.

## Product Principles

1. **The ledger comes first.** The screen that opens must serve logging what was just eaten. Summary and analysis earn their space only after that path is fast.
2. **The library is the moat.** Value compounds as her own foods accumulate. Anything that makes adding, finding, or re-logging a food slower is a regression.
3. **Protein is the load-bearing number.** On a cut it decides whether the weight lost is fat or muscle. It gets prominence the other macros do not.
4. **Trends over readings.** A single weigh-in or a single day means nothing. Design should show the trend and resist making one bad day feel like failure.
5. **Nothing at runtime.** Offline-first is not a feature to trade away for a font, a library, or an API. Every design idea must survive that constraint.
