# Application design system — extending the marketing system

`styles/tokens.css` is the source of truth. This document explains what
carried over from the marketing site's design language, what didn't and why,
and exactly how every derived color was produced, so nobody has to
re-derive or guess at it later.

## What carried over unchanged

- The eight brand anchors: `blue-deep`, `blue-mid`, `blue-light`,
  `blue-bright`, `gold`, `warm-white`, `muted`, `footer-deep`. Same hex
  values, same roles.
- Zero border radius, everywhere.
- Cormorant Garamond for headings (weight 300), Montserrat for UI/body
  (300–700), uppercase labels at 600–700 with 0.14em–0.26em tracking.
- Motion is color transitions only — no entrance animation, no parallax.
- No grey scale — text hierarchy is opacity on `warm-white`, not a
  separate neutral palette.

## What didn't carry over, and why

The marketing system is a small, static set of pages: a handful of
sections, no tables, no forms, no long-running state, no field-collected
customer output. The application has none of that luxury, so three things
had to be invented rather than copied:

1. **A semantic status scale.** Marketing has no notion of pass/fail/running
   state. See below for how these six colors were derived and verified —
   this is the part most likely to have been done by eye and be wrong, so
   every ratio here is measured, not guessed.
2. **A compressed type scale.** The marketing site can afford large display
   type; a table of 64 run rows cannot. The application scale tops out at
   28px and treats 13–14px as the workhorse size, with `tabular-nums` on
   every figure so numbers don't jitter in a column.
3. **A monospace stack, for locators, ids, hashes, and step output.**
   CLAUDE.md's font rule says Cormorant Garamond and Montserrat, nothing
   else — written with _decorative_ typefaces in mind. A CSS selector or a
   proof hash rendered in Montserrat is actively harder to read (no
   fixed-width alignment, ambiguous `l`/`1`/`I`). This uses the _platform's_
   monospace stack (`ui-monospace, "SF Mono", ... monospace`) — no
   additional webfont, no additional brand voice, just the OS's utilitarian
   code font. This is a judgment call, not a literal reading of the rule —
   flagged in the Phase A report for explicit sign-off rather than decided
   silently.
4. **A 4px density system** for table rows and form controls at two
   densities (comfortable / compact). Marketing has no data-dense surfaces
   at all.

## Semantic status colors — full derivation

Constraint, verbatim from the brief: _"If a new state color is needed
(error, success), derive it with OKLCH from the existing gold/blue rather
than introducing an unrelated color."_ Taken literally: no plain red for
`fail`, no plain green for `pass`. Every status color below is the anchor's
OKLCH coordinates with the hue rotated and lightness re-solved for
contrast — not a color-wheel pick.

**Method:** convert each anchor to OKLCH (Björn Ottosson's reference
formulas — sRGB → linear → OKLab → OKLCH). Pick a target hue by rotating
away from gold (H≈82°) or blue (H≈258°); hold chroma in the same
intensity band the anchors already use (0.03–0.16); binary-search the
minimum lightness `L` that clears the target contrast ratio against
**both** `blue-deep` and `blue-mid` simultaneously (`blue-mid` is lighter
and is almost always the binding constraint). Foreground text targets
AA normal text (≥4.5:1); border targets AA non-text / UI components
(≥3:1, WCAG 1.4.11). The wash background is a fill, not text, so it has no
contrast requirement — it's the same hue at low chroma, lightness ≈0.30,
picked to read as a raised tint over either ground.

| State     | Role       | Hue (rotated from)                 | Hex       | vs `blue-deep` | vs `blue-mid` |
| --------- | ---------- | ---------------------------------- | --------- | -------------- | ------------- |
| `warning` | foreground | gold anchor, unrotated (H=82°)     | `#c9a96e` | **8.10:1**     | **7.06:1**    |
| `fail`    | foreground | gold → H=20° (toward red)          | `#db6368` | **5.18:1**     | **4.51:1**    |
| `pass`    | foreground | blue → H=150° (toward green)       | `#48995d` | **5.17:1**     | **4.51:1**    |
| `running` | foreground | blue → H=225° (toward cyan)        | `#0095bc` | **5.20:1**     | **4.53:1**    |
| `queued`  | foreground | gold → H=65°, chroma cut to 0.035  | `#998674` | **5.19:1**     | **4.53:1**    |
| `skipped` | foreground | blue → H=280°, chroma cut to 0.028 | `#85889a` | **5.17:1**     | **4.50:1**    |

All six clear AA (4.5:1) on both grounds with 0.5–0.7:1 of headroom — deliberate,
since these grounds are also used as `<body>` backgrounds where the actual
rendered surface can shift slightly from color management, and because
`blue-mid` was consistently the tighter constraint by ~0.6:1 across every
hue tested.

Borders (non-text, AA ≥3:1) — same hues, lower lightness:

| State     | Hex       | vs `blue-deep` | vs `blue-mid` |
| --------- | --------- | -------------- | ------------- |
| `warning` | `#85682d` | 3.47:1         | 3.02:1        |
| `fail`    | `#b04c50` | 3.45:1         | 3.01:1        |
| `pass`    | `#387949` | 3.45:1         | 3.01:1        |
| `running` | `#007695` | 3.48:1         | 3.03:1        |
| `queued`  | `#796a5b` | 3.48:1         | 3.03:1        |
| `skipped` | `#6a6b7a` | 3.45:1         | 3.01:1        |

Backgrounds (wash fills, L=0.30, no contrast requirement — for badge/row
tinting, always paired with the matching foreground for the actual text):
`warning #3a2b0d` · `fail #472021` · `pass #1a3520` · `running #0a3341` ·
`queued #362c22` · `skipped #2c2d37`.

**Why `skipped` and `muted` (the existing marketing secondary-text token,
`#8a9ab5`) look similar:** that's intentional, not a derivation accident.
"Skipped" is the one status that isn't really a status — it's the absence
of a result — so giving it the same quiet, low-presence character as
secondary text is the correct signal, not a collision to fix.

**Why `pass` reads as a fairly ordinary green and `fail` as a fairly
ordinary red despite being "derived, not introduced":** rotating a hue by
~55–75° from a warm or cool anchor while holding the anchor's chroma band
lands, unsurprisingly, near the hues human vision already treats as
"success" and "error" — OKLCH doesn't have a way to make a _derived_ green
look categorically different from _an_ green. The derivation constraint
governs the _method_ (rotate from the anchors, stay in their chroma band)
rather than guaranteeing an exotic result. If the intent was specifically
to avoid colors that read as conventional red/green/amber regardless of
method, that's a different, stricter constraint than what's written, and
worth confirming.

## Text hierarchy — measured, not assumed

`rgba(248, 244, 238, α)` composited over both grounds (browsers alpha-blend
on encoded sRGB channels directly, which is what's measured here):

| Token              | α    | vs `blue-deep` | vs `blue-mid` | Use                                                                       |
| ------------------ | ---- | -------------- | ------------- | ------------------------------------------------------------------------- |
| `--text-primary`   | 1.00 | 16.55:1        | 14.42:1       | Body, headings                                                            |
| `--text-secondary` | 0.72 | 8.92:1         | 8.05:1        | De-emphasized but still primary content                                   |
| `--text-tertiary`  | 0.50 | 4.89:1         | 4.60:1        | **AA floor** — captions, meta; nothing below this may carry meaning alone |
| `--text-disabled`  | 0.32 | 2.73:1         | 2.68:1        | Sub-AA on purpose — disabled controls, decorative only                    |

## Type scale, density, numerals

- Scale: 11 / 12 / 13 / 14 / 16 / 18 / 21 / 24 / 28px (`--text-2xs` through
  `--text-3xl`). 13–14px is the workhorse; 28px is the ceiling for anything
  short of a hero, and nothing in the application shell should need one.
- `font-variant-numeric: tabular-nums` is set globally in `:root` so every
  figure — durations, counts, token costs — lines up in a column without
  per-component opt-in.
- Density: two row/control heights, `--row-height-comfortable` /
  `-compact` (40px / 32px) and matching control heights, plus a 28px
  `--control-height-inline` for toolbars. All on the 4px grid used
  throughout (`--space-1` = 4px).

## shadcn theme mapping (A4)

shadcn's CLI is `shadcn@4.21.0`, initialized with its default preset
(`--defaults`, which resolves to `base-nova` at time of writing) — **Base
UI**, not Radix, as the underlying primitive library. There was no existing
Radix dependency to preserve and Base UI is the CLI's own current default
for new projects, so this took the path of least resistance rather than a
deliberated choice; the `migrate-radix-to-base` skill is installed if that
ever needs reconsidering.

`components.json` → `baseColor: "neutral"` is irrelevant here — every
color slot below is overwritten to reference `styles/tokens.css`, none of
shadcn's generated neutral scale survives:

| shadcn slot                              | Maps to                                                                           | Note                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background` / `foreground`              | `blue-deep` / `text-primary`                                                      |                                                                                                                                                                                                                                                                                                                                                                                  |
| `card`, `popover` / `-foreground`        | `blue-mid` / `text-primary`                                                       | Raised surfaces                                                                                                                                                                                                                                                                                                                                                                  |
| `primary` / `primary-foreground`         | `gold` / `blue-deep`                                                              | **Dark text on gold** — warm-white on gold measures 2.04:1 (fails); blue-deep measures 8.10:1                                                                                                                                                                                                                                                                                    |
| `secondary`, `accent` / `-foreground`    | `blue-light` / `text-primary`                                                     |                                                                                                                                                                                                                                                                                                                                                                                  |
| `muted` / `muted-foreground`             | `blue-mid` / `text-secondary`                                                     |                                                                                                                                                                                                                                                                                                                                                                                  |
| `destructive` / `destructive-foreground` | `status-fail-fg` / `blue-deep`                                                    | Same dark-text logic: warm-white on the derived fail red measures 3.20:1 (fails AA text), blue-deep measures 5.18:1. In practice the installed Button/Badge `destructive` variants use `text-destructive` as a wash (`bg-destructive/10`), not a solid fill, so `-foreground` isn't exercised by anything installed yet — kept defined for whatever does need a solid fill later |
| `border` / `input`                       | `border-default` / `border-strong`                                                | New tokens, not anchors — see below                                                                                                                                                                                                                                                                                                                                              |
| `ring`                                   | `gold`                                                                            | Focus ring reuses the single accent                                                                                                                                                                                                                                                                                                                                              |
| `chart-1..5`                             | `blue-bright`, `gold`, `status-pass-fg`, `status-running-fg`, `status-warning-fg` | Not exercised by any required A4 component; filled in so no default grey survives unused in committed CSS                                                                                                                                                                                                                                                                        |
| `sidebar*`                               | `blue-deep` nav ground, `gold` accent, `border-default`                           | Ahead of A7's app shell                                                                                                                                                                                                                                                                                                                                                          |

**New tokens this required, not in the A3 set:** `--border-default`
(`rgb(248 244 238 / 0.14)`) and `--border-strong` (`/ 0.24`) — generic UI
borders/dividers didn't exist yet because A3 only defined _status_ borders.
Same opacity-on-warm-white method as the text hierarchy, extended to
borders, so "no grey tokens" holds here too.

**One theme, not two.** shadcn scaffolds a light `:root` + dark `.dark`
pair by default. This product has no light mode — the entire palette in
the brief is a single dark identity — so the light block and the
`.dark` class selector are deleted outright rather than populated; every
color lives directly in `:root`. If a light mode is ever wanted, this is
the first thing that has to change and it isn't a small edit.

**Bundle budget moved again.** Wiring `TooltipProvider` and `Toaster` into
the root layout (needed so any route can trigger a toast or tooltip) put
that JS on every route, not just ones using them. Measured floor moved
from ~186 KB (A1, no shadcn) to ~253 KB (`/_not-found`, which imports none
of the themed components). The provisional per-route budget in
`scripts/check-bundle-budget.mjs` is now 300 KB — still a placeholder, but
grounded in two real measurements instead of one.

## Radius

`--radius: 0px`, set once in `styles/tokens.css` and never redeclared
elsewhere (shadcn's `init` scaffolds its own `--radius: 0.625rem` in
`globals.css`'s `:root` block - that line is deleted, not overridden, so
there's a single source of truth). The `base-nova` style's radius chain
(`--radius-sm/md/lg/xl/...`) is defined as `calc(var(--radius) * 0.6)`
through `* 2.6` - multiplication, not subtraction - so at `--radius: 0px`
every derived radius is exactly `0px` with no negative-value clamping to
reason about. (An earlier draft of this doc assumed the older
subtraction-based chain and a clamping edge case that turned out not to
apply to this shadcn version - corrected here once the real generated CSS
was in hand.)
