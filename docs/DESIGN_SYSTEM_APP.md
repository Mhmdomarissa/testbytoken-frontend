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
   code font. Flagged in the Phase A report as a judgment call rather than
   a literal reading of CLAUDE.md's rule; **confirmed correct in the Phase
   A review** — the two-font rule governs display/body type, and
   `CLAUDE.md` now says so explicitly.
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

**Method (corrected — Phase A review, A1-FIX-2):** convert each anchor to
OKLCH (Björn Ottosson's reference formulas — sRGB → linear → OKLab →
OKLCH). Pick a target hue by rotating away from gold (H≈82°) or blue
(H≈258°). The first version of this document said chroma stayed "in the
same intensity band the anchors already use" for every state; that's true
for `queued` and `skipped` (both disclosed as chroma _cuts_, toward
0.03–0.04) but not for `fail`, whose chroma moved from gold's 0.0854 to
0.1508 — nearly double, undisclosed. The honest statement of the method
is: **hue and chroma are both re-derived per state (queued/skipped cut
toward the anchors' low end, fail and pass/running raised toward the
anchors' high end), and lightness is solved for contrast** — not a fixed
chroma band with only hue changing. Foreground text targets AA normal
text (≥4.5:1); border targets AA non-text / UI components (≥3:1, WCAG
1.4.11). The wash background is a fill, not text, so it has no contrast
requirement — it's the same hue at low chroma, lightness ≈0.30, picked to
read as a raised tint over either ground.

| State     | Role       | Hue (rotated from)             | Chroma                                 | Hex       | vs `blue-deep` | vs `blue-mid` |
| --------- | ---------- | ------------------------------ | -------------------------------------- | --------- | -------------- | ------------- |
| `warning` | foreground | gold anchor, unrotated (H=82°) | 0.085 (gold's own)                     | `#c9a96e` | **8.10:1**     | **7.06:1**    |
| `fail`    | foreground | gold → H=20° (toward red)      | 0.15 (raised from gold's 0.085)        | `#db6368` | **5.18:1**     | **4.51:1**    |
| `pass`    | foreground | blue → H=150° (toward green)   | 0.12 (raised from blue-bright's 0.116) | `#83d494` | **10.20:1**    | **8.88:1**    |
| `running` | foreground | blue → H=225° (toward cyan)    | 0.12                                   | `#49c1ea` | **8.72:1**     | **7.60:1**    |
| `queued`  | foreground | gold → H=65°, chroma cut       | 0.035 (cut from gold's 0.085)          | `#a89482` | **6.24:1**     | **5.43:1**    |
| `skipped` | foreground | blue → H=280°, chroma cut      | 0.028 (cut from blue-bright's 0.116)   | `#a1a3b6` | **7.28:1**     | **6.34:1**    |

All six clear AA (4.5:1) on both grounds — `fail` sits closest to its
floor (5.18:1 / 4.51:1) because it's deliberately the deepest, most
saturated color in the scale; the other four carry more headroom because
their lightness was placed for separation from `fail` and from each
other, not minimized to the AA floor. See "Isoluminance" below for why
that placement changed.

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
`queued #362c22` · `skipped #2c2d37`. Border and background hexes above
are unchanged from the first version of this scale — the isoluminance bug
and its fix (below) affect only the foreground lightness placement.

## Isoluminance — a WCAG 1.4.1 failure, found in Phase A review (A1-FIX-1, BLOCKING)

The first derivation of `fail`/`pass`/`running`/`queued`/`skipped`
searched each state **independently** for the minimum lightness clearing
AA against both grounds. Independent floors converge: `pass` needed
L=0.615, `running` L=0.621, `skipped` L=0.629, `queued` L=0.631, `fail`
L=0.648 — a 0.033 spread. Every pairwise contrast between them was
1.00–1.01:1. That's not a rounding artifact; it means, for anyone who
can't use hue to distinguish them — colorblindness, a greyscale print, a
screenshot pasted into a ticket without color management — **pass and
fail rendered as literally the same color.** Measured with a
Viénot/Brettel-style dichromacy simulation (linear-RGB matrices, the same
family Chrome DevTools' vision-deficiency emulation uses):

| CVD type     | pass renders as | fail renders as | contrast between them |
| ------------ | --------------- | --------------- | --------------------- |
| protanopia   | `#acada6`       | `#b4b367`       | 1.03:1                |
| deuteranopia | `#a7a1ab`       | `#bac167`       | 1.31:1                |
| tritanopia   | `#89b3b6`       | `#d76666`       | 1.54:1                |

(Reproducible: `npm run check:status-contrast` recomputes every number on
this page from the committed `styles/tokens.css`, including this CVD
simulation — Viénot/Brettel-style linear-RGB matrices, the same family
Chrome DevTools' vision-deficiency emulation uses. Ratios here are for
the _fixed_ colors, `#83d494`/`#db6368`, recorded so the improvement is
checkable.
The original, isoluminant pair's CVD contrast was ~1.0:1 across all three
types — genuinely indistinguishable — matching the review's own
measurement almost exactly.)

**The fix, all three parts the review required:**

1. **Color is no longer the only channel, anywhere.** Every status now
   renders through `StatusBadge` (`src/components/status/StatusBadge.tsx`)
   — color, a distinct-_silhouette_ icon (not six colored circles: pass
   is a checkmark, fail an octagon-X, running a spinner, queued a clock,
   skipped a slash-circle, warning a triangle), and a text label, always
   together. This is the actual fix for WCAG 1.4.1 — it holds regardless
   of what the color values are, including under CVD or in greyscale.
   Every call site that used to paint an inline colored `<span>` (the
   style-guide page, the runs table) now goes through this component;
   there is no remaining place in the app that renders a status as color
   alone.
2. **Lightness is now placed for separation, not minimized to a floor.**
   `fail` stays at its own floor (0.648 — the deepest, most saturated
   color in the scale, appropriate for the state that most needs
   attention) and `pass` moves to 0.80, with `queued`/`skipped`/`running`
   spaced between (0.68 / 0.72 / 0.76). `pass` and `fail` are the
   deliberate extremes, per the review's instruction.
3. **Regression test:** `src/lib/color/contrast.test.ts` parses the
   actual committed `styles/tokens.css` (not a hardcoded copy of the hex
   values) and asserts every status foreground still clears AA on both
   grounds, that `pass`/`fail` clear 1.8:1 against each other, and that no
   pair falls back under 1.1:1. Verified to actually fail: reverted
   `pass` to its original isoluminant value locally and confirmed the
   test caught it (`expected 1.001 to be greater than or equal to 1.8`)
   before restoring the fix.

New pairwise contrast, normal vision (all six meaningfully separated;
`pass`/`fail` roughly doubled from ~1.0:1 to the value below):

|             | fail | queued | skipped | running | pass     |
| ----------- | ---- | ------ | ------- | ------- | -------- |
| **fail**    | —    | 1.20   | 1.41    | 1.68    | **1.97** |
| **queued**  |      | —      | 1.17    | 1.40    | 1.64     |
| **skipped** |      |        | —       | 1.20    | 1.40     |
| **running** |      |        |         | —       | 1.17     |

**Honest limit, stated plainly:** pass/fail contrast under deuteranopia
simulation for the _fixed_ colors is still only ~1.3:1 — lightness
separation alone cannot fully solve a red/green pair for red-green
colorblindness, because deuteranopia collapses exactly that hue
distinction regardless of lightness. This is exactly why part 1 (icon +
label, not color, on every status) is the real fix and part 2 (lightness
spread) is a secondary improvement for full-color viewers, not a claim
that color alone is now sufficient. If the intent is to be rigorously
CVD-safe through color alone, that requires abandoning a red/green pair
entirely (e.g. blue/orange), which is a larger palette change than this
review asked for — flagging it rather than deciding it unilaterally.

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

**Bundle budget.** Wiring `TooltipProvider` and `Toaster` into the root
layout (needed so any route can trigger a toast or tooltip) put that JS on
every route, not just ones using them. Measured floor moved from ~186 KB
(A1, no shadcn) to ~253 KB (`/_not-found`, which imports none of the
themed components) here, then to ~435-437 KB once A7's real shell
(Sidebar/Command/DropdownMenu/Field) existed. After a fourth guessed
number in a row turned out wrong, the Phase A review replaced the fixed
budget with a per-route ratchet — see README's "Bundle budget" section and
`scripts/check-bundle-budget.mjs`.

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
