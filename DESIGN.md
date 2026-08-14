---
name: MacroMate
description: A macro ledger for lifting — near-white paper, one committed tangerine, numbers you can read at a glance.
colors:
  tangerine: "#ff6a13"
  tangerine-deep: "#e0530a"
  tangerine-wash: "rgba(255, 106, 19, 0.11)"
  paper: "#f1f2f5"
  card: "#ffffff"
  recess: "#f5f6f9"
  track: "#eaecf1"
  ink: "#14161c"
  ink-muted: "#6b7180"
  ink-faint: "#9aa0ad"
  hairline: "rgba(17, 20, 28, 0.07)"
  hairline-firm: "rgba(17, 20, 28, 0.12)"
  protein-green: "#12a06f"
  carbs-blue: "#4c7ef3"
  fat-violet: "#8b5cf6"
  alarm: "#e5484d"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.07em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  row: "12px"
  gutter: "14px"
  card: "18px"
  page: "16px"
components:
  button-primary:
    backgroundColor: "{colors.tangerine}"
    textColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "48px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "48px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "38px"
  chip-on:
    backgroundColor: "{colors.tangerine-wash}"
    textColor: "{colors.tangerine-deep}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.recess}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "48px"
  segment-on:
    backgroundColor: "{colors.card}"
    textColor: "{colors.tangerine-deep}"
    rounded: "{rounded.pill}"
    height: "38px"
---

# Design System: MacroMate

## Overview

**Creative North Star: "The Clean Bench"**

A wiped white bench under good kitchen light, with one bright tool on it. Everything the app shows is laid out flat and legible on near-white paper; nothing is stacked, tinted, or decorated for its own sake. The single tangerine is the tool — you always know where it is, and it always means *do something* or *this is your calorie number*.

The register is calm and dense rather than airy and motivational. The person using this has just eaten and wants to record it; she knows what a macro is and does not need encouragement, badges, or a coach's voice. Density is affordable because she is sitting down with the phone close to her face. So rows are compact, numbers are large where they carry the decision and small where they are reference, and no screen spends a viewport on something she already knows.

Depth is real but quiet: every surface sits on a two-layer shadow with an actual offset, so cards feel like paper resting on paper rather than like glowing rectangles. The one place the system reaches for a genuine physical effect is the floating tab bar, which is real `backdrop-filter` blur over live content, not a painted approximation.

**Key Characteristics:**
- Near-white ground under a barely-there two-field colour wash, so white cards have something to sit on
- One committed tangerine, reserved for actions and for calories
- Figtree 300–900 self-hosted; tabular figures on everything that changes
- Two-layer shadows with real offsets; no halos, no zero-blur blocks
- Data hues (green/blue/violet) held deliberately clear of the accent
- Hand-drawn inline SVG for every chart; no library, nothing fetched at runtime

## Colors

A neutral paper system carrying one saturated accent, plus three data hues that exist only inside charts and macro readouts.

### Primary
- **Tangerine** (`#ff6a13`): The action colour and the calorie colour, and nothing else. It fills the tab bar's centre disc, primary buttons, and the "New food" control; it draws the calorie dial, the calorie bars, and the consistency heatmap. **Tangerine Deep** (`#e0530a`) is its text-on-light variant, used for labels on tinted grounds where the base hue would fail contrast.
- **Tangerine Wash** (`rgba(255,106,19,0.11)`): Tinted ground for selected chips, badges, and the add-row strip.

### Secondary
The three macro hues. They never appear as interface chrome — only as data.
- **Protein Green** (`#12a06f`): Protein everywhere. Doubles as the "on target" colour in adherence readouts.
- **Carbs Blue** (`#4c7ef3`): Carbohydrate.
- **Fat Violet** (`#8b5cf6`): Fat. Violet rather than the obvious amber precisely because amber sits too close to the accent.

### Neutral
- **Paper** (`#f1f2f5`): The page ground.
- **Card** (`#ffffff`): Every raised surface.
- **Recess** (`#f5f6f9`): Inset surfaces — inputs, segmented-control troughs, calculator readouts. Recessed, never raised.
- **Track** (`#eaecf1`): The unfilled portion of any progress track or ring.
- **Ink** (`#14161c`) / **Ink Muted** (`#6b7180`) / **Ink Faint** (`#9aa0ad`): Body text, secondary text, axis labels and placeholders.
- **Alarm** (`#e5484d`): Destructive controls and the over-target calorie figure. Never used for "you ate more than planned" in a chart.

### Named Rules

**The One Solid Rule.** Solid tangerine is reserved for actions. A *state* — a selected tab, an active chip, a current day — lifts on white or takes a wash tint, but never fills with the accent. If two solid tangerine shapes are visible at once and only one of them is a button, the screen is wrong.

**The Single-Hue Adherence Rule.** Performance against a target is encoded by *intensity of the accent*, never by a red/green traffic light. A day on target is full tangerine; a day off target is the same tangerine at 28%. Eating more is good on a bulk and bad on a cut, so a directional colour would be wrong half the time.

**The Data-Hue Quarantine Rule.** Protein green, carbs blue and fat violet appear only where they label real macro data. They never become button colours, nav states, or decoration.

## Typography

**Display Font:** Figtree (self-hosted variable, 300–900), falling back to the platform sans
**Body Font:** the same family — one voice throughout
**Label/Mono Font:** none; measurement is carried by tabular figures, not by a monospace costume

**Character:** Figtree is a geometric humanist sans with round, open counters and unfussy numerals. It reads as friendly without being soft, and at 800 weight with tight tracking its figures get genuinely large and confident, which is what the calorie number needs.

### Hierarchy
- **Display** (800, 46px, -0.045em, line-height 1): The remaining-calories figure. One per screen, ever.
- **Headline** (800, 26px, -0.035em): The app bar's route title.
- **Title** (700, 16px, -0.02em): Card headings. Sheet headings run 19px at -0.03em.
- **Body** (400–600, 15.5–16px, 1.4): Entry names, list rows, prose hints.
- **Label** (700, 11.5px, uppercase, 0.07em, muted): Field labels, meal headings, axis captions, the "KCAL LEFT" strapline.

### Named Rules

**The Tabular Rule.** Every number that can change carries `font-variant-numeric: tabular-nums` — totals, targets, table cells, ring centres, weigh-ins. A number that reflows as it counts is a bug.

**The One Display Rule.** Only one element per screen may use the display size. If a second wants it, the screen has two headlines and no hierarchy.

## Layout

Single column, `max-width: 620px`, centred, with 16px page gutters. The app bar is full-bleed for its blur but pads its contents to the same measure via `padding-inline: max(18px, calc((100vw - 620px) / 2 + 16px))`, so the title stays aligned with the content on desktop.

Vertical rhythm: 14px between cards, 18px inside them, 12px vertical on list rows. Labels sit 7px above their control; headings take more space above than below.

The Today screen's order is fixed and expresses the thesis: week strip → remaining instrument → the log by meal → weigh-in. The log is the page; the instrument is a header for it.

### Named Rules

**The Reserved Bottom Rule.** The bottom `62px + safe-area + 26px` belongs to the floating tab bar. Body padding reserves it; no content, button, or toast may sit there.

## Elevation & Depth

Layered, not flat, and never neumorphic. Depth comes from real shadows with offsets plus a hairline border, so a white card is legible against near-white paper. The page itself sits on a fixed two-field radial wash (warm top-right, cool bottom-left, both under 11% alpha) which gives the ground enough variation that white cards read as floating rather than as cut-outs.

### Shadow Vocabulary
- **Resting** (`0 1px 2px rgba(17,20,28,.04), 0 4px 12px rgba(17,20,28,.05)`): Every card, list container, and selected day chip.
- **Raised** (`0 2px 4px rgba(17,20,28,.05), 0 12px 28px rgba(17,20,28,.08)`): Chart tooltips and anything overlaying a card.
- **Popped** (`0 4px 10px rgba(17,20,28,.08), 0 24px 56px rgba(17,20,28,.16)`): The tab bar, bottom sheets, toasts.
- **Accent** (`0 2px 5px rgba(224,83,10,.22), 0 8px 18px rgba(224,83,10,.18)`): Tangerine-filled controls only. Tinted from the accent's own deep variant so it reads as the object's own shadow rather than a glow.

### Named Rules

**The Two-Layer Rule.** Every shadow has a tight contact layer and a wide key layer, both with a vertical offset. A single-blur shadow reads as fog; a zero-offset shadow reads as a halo. Neither ships.

## Shapes

Everything is rounded, at three steps: 24px for cards and containers, 16px for buttons, inputs and inner blocks, 12px for tooltips and small chips. Anything that reads as a control you toggle — chips, segmented controls, the tab bar, toasts, badges, the add-row's icon — is a full pill or circle.

Borders are hairlines (`rgba(17,20,28,0.07)`) and exist to separate a white card from near-white paper, never to decorate. Inputs carry no border at rest; they are recessed by fill and grow a tangerine border only on focus.

### Named Rules

**The No Nested Card Rule.** Content sits either on a white card or on the bare ground. A block inside a card may be *recessed* (fill, no shadow, no border) but never raised into a second card.

## Components

### Buttons
- **Shape:** 16px radius (`--r-md`); the small variant is a full pill at 38px tall.
- **Primary:** tangerine fill, white label, accent shadow, 48px tall, 18px horizontal padding.
- **Ghost:** transparent with a firm hairline border; the default for secondary actions.
- **Danger:** transparent, alarm-red label, alarm-tinted border. Never filled.
- **Active:** `scale(0.98)` over 120ms; the primary also drops from accent shadow to resting, so it presses *into* the page.

### Chips
- **Style:** white, hairline-firm border, full pill, 38px tall.
- **Selected:** tangerine wash fill, tangerine-deep label, accent-tinted border. Tinted, never filled — see The One Solid Rule.

### Segmented control
- **Trough:** recess fill, full pill, 4px padding.
- **Selected:** white chip on a resting shadow, tangerine-deep label. The accent variant differs from the plain one only in label colour.

### Cards / Containers
- **Corner:** 24px. **Background:** white. **Border:** hairline. **Shadow:** resting. **Padding:** 18px (13/15px in the tight variant, zero in the flush variant used to wrap full-bleed lists).

### Inputs / Fields
- **Style:** recess fill, no border at rest, 16px radius, 48px minimum.
- **Focus:** border shifts to tangerine and the fill lightens to white. No glow.

### Lists
Rows are 58px minimum, separated by hairlines, last row unruled, and the whole list is wrapped in a flush card so it reads as one object. A row presses by tinting to recess.

### Navigation
A floating glass pill, `min(370px, 100vw - 32px)` wide, lifted 14px off the safe-area edge, with real `backdrop-filter: blur(22px) saturate(180%)` over a 78% surface fill. Five slots: four routes with 21px stroke icons and 10px labels, and a 50px tangerine disc at the centre. Active routes colour to tangerine; inactive sit at ink-faint.

### The centre disc
The primary action, not a route. It opens the food picker for whichever meal the clock suggests, from any screen. It is the only control in the system that is a filled circle, and that exclusivity is what makes it findable without a label.

### The remaining instrument
The Today header, and the system's signature component: the calories-left figure at display size in tangerine, a 78px dial at the right showing percent eaten, and three macro tracks below it. It replaces the category's full-viewport progress ring — it says the same thing in a fifth of the height, which is what leaves room for the log.

### Charts
All hand-drawn inline SVG. Grid lines are hairlines, axis text is 9.5px ink-faint, bars are tangerine with rounded caps, and entrances animate via CSS `@keyframes` whose only keyframe is `from` — the final value always sits in the DOM, so a throttled tab never shows zero. Every chart is drag-scrubbable and reports through one shared floating tooltip.

## Do's and Don'ts

### Do:
- **Do** reserve solid tangerine for actions and for calories. State tints or lifts.
- **Do** put every changing number on tabular figures.
- **Do** give every shadow two layers and a vertical offset.
- **Do** wrap a list in a flush card so it reads as one object rather than rows floating on paper.
- **Do** encode adherence by accent intensity, and keep protein green, carbs blue and fat violet inside data.
- **Do** write the final value into the DOM and let animation be decoration.
- **Do** state depth with real `backdrop-filter` where the design calls for glass.

### Don't:
- **Don't** fill a selected tab, chip, or day with solid accent.
- **Don't** use red for over-target or green for under-target; the direction is only meaningful once you know the goal.
- **Don't** nest a card inside a card. Recess it instead.
- **Don't** put a floating action button on a screen — the tab bar's disc is the app's one floating circle.
- **Don't** name a colour in UI copy ("green means…"); describe the state instead, so the sentence survives the dark rendition.
- **Don't** add a runtime dependency for a chart, a font, or an icon. Everything ships in the repo and works offline.
- **Don't** spend a full viewport on a number the user already knows. The log is the page.
