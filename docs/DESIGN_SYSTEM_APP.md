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
   state. See below for how these seven colors were derived and verified —
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

| State       | Role       | Hue (rotated from)                                        | Chroma                                 | Hex       | vs `blue-deep` | vs `blue-mid` |
| ----------- | ---------- | --------------------------------------------------------- | -------------------------------------- | --------- | -------------- | ------------- |
| `warning`   | foreground | gold anchor, unrotated (H=82°)                            | 0.085 (gold's own)                     | `#c9a96e` | **8.10:1**     | **7.06:1**    |
| `fail`      | foreground | gold → H=20° (toward red)                                 | 0.15 (raised from gold's 0.085)        | `#db6368` | **5.18:1**     | **4.51:1**    |
| `timed_out` | foreground | new hue, H=48° (between `fail`'s 20° and `warning`'s 82°) | 0.13                                   | `#d57a49` | **5.79:1**     | **5.05:1**    |
| `pass`      | foreground | blue → H=150° (toward green)                              | 0.12 (raised from blue-bright's 0.116) | `#83d494` | **10.20:1**    | **8.88:1**    |
| `running`   | foreground | blue → H=225° (toward cyan)                               | 0.12                                   | `#4ec5ee` | **9.10:1**     | **7.93:1**    |
| `queued`    | foreground | gold → H=65°, chroma cut                                  | 0.035 (cut from gold's 0.085)          | `#ab9785` | **6.47:1**     | **5.64:1**    |
| `skipped`   | foreground | blue → H=280°, chroma cut                                 | 0.028 (cut from blue-bright's 0.116)   | `#a1a3b5` | **7.27:1**     | **6.33:1**    |

`timed_out` was added later than the other six — while building the
mock's stateful lifecycle simulation surfaced a run outcome (the engine
going silent) the original five-value run-status enum had no way to
represent (see `docs/API_CONTRACT.md`'s run-status note). It went through
the same derivation and the same AA/isoluminance process as the other
six, not a shortcut: a genuinely new hue (not `fail`'s red, not
`warning`'s gold — the midpoint amber reads as "expired", not "wrong"),
its own icon (`ClockAlertIcon`, not `fail`'s `OctagonXIcon`), and its own
ladder position (see "Isoluminance" below).

All seven clear AA (4.5:1) on both grounds — `fail` sits closest to its
floor (5.18:1 / 4.51:1) because it's deliberately the deepest, most
saturated color in the scale, anchoring one end of the isoluminance
ladder below; the others carry more headroom because their lightness was
placed for pairwise separation, not minimized to the AA floor. See
"Isoluminance" below for why that placement changed, twice.

Borders (non-text, AA ≥3:1) — same hues, lower lightness:

| State       | Hex       | vs `blue-deep` | vs `blue-mid` |
| ----------- | --------- | -------------- | ------------- |
| `warning`   | `#85682d` | 3.47:1         | 3.02:1        |
| `fail`      | `#b04c50` | 3.45:1         | 3.01:1        |
| `timed_out` | `#a25a31` | 3.49:1         | 3.04:1        |
| `pass`      | `#387949` | 3.45:1         | 3.01:1        |
| `running`   | `#007695` | 3.48:1         | 3.03:1        |
| `queued`    | `#796a5b` | 3.48:1         | 3.03:1        |
| `skipped`   | `#6a6b7a` | 3.45:1         | 3.01:1        |

Backgrounds (wash fills, L=0.30, no contrast requirement — for badge/row
tinting, always paired with the matching foreground for the actual text):
`warning #3a2b0d` · `fail #472021` · `timed_out #432515` ·
`pass #1a3520` · `running #0a3341` · `queued #362c22` ·
`skipped #2c2d37`. Border and background hexes for the original six are
unchanged from the first version of this scale — every fix below (the
BLOCKING one and the pre-Phase-B follow-up) touches only foreground
lightness placement, never hue, chroma, border, or background.

## Isoluminance — a WCAG 1.4.1 failure, found in Phase A review (A1-FIX-1, BLOCKING), then found again pre-Phase-B

The first derivation of `fail`/`pass`/`running`/`queued`/`skipped`
searched each state **independently** for the minimum lightness clearing
AA against both grounds. Independent floors converge: `pass` needed
L=0.615, `running` L=0.621, `skipped` L=0.629, `queued` L=0.631, `fail`
L=0.648 — a 0.033 spread. Every pairwise contrast between them was
1.00–1.01:1. That's not a rounding artifact; it means, for anyone who
can't use hue to distinguish them — colorblindness, a greyscale print, a
screenshot pasted into a ticket without color management — **pass and
fail rendered as literally the same color.**

**The BLOCKING fix (A1-FIX-1), all three parts the review required:**

1. **Color is no longer the only channel, anywhere.** Every status
   renders through `StatusBadge` (`src/components/status/StatusBadge.tsx`)
   — color, a distinct-_silhouette_ icon, and a text label, always
   together. This is the actual fix for WCAG 1.4.1 — it holds regardless
   of what the color values are, including under CVD or in greyscale.
   There is no remaining place in the app that renders a status as color
   alone.
2. **Lightness placed for separation, not minimized to a floor** — first
   pass: just `pass` and `fail` moved to the deliberate extremes of the
   scale (0.80 / 0.648).
3. **Regression test:** `src/lib/color/contrast.test.ts`, parsing the
   actual committed `styles/tokens.css`. Verified to actually fail:
   reverted `pass` to its original isoluminant value locally and
   confirmed the test caught it (`expected 1.001 to be greater than or
equal to 1.8`) before restoring the fix.

**What the first fix missed, caught in the pre-Phase-B follow-up
review:** widening the regression test to check every pair, not just
`pass`/`fail`, showed `warning`/`running` at 1.08:1, `pass`/`running` at
1.17:1, and `queued`/`skipped` at 1.17:1 — fixing the pair everyone was
looking at had left the others clustered almost exactly where the
original bug left them. `warning` also hadn't been in the pairwise test
at all (an omission, not a deliberate exclusion).

**The re-fix — every status placed on one ladder, not just the two
extremes:** WCAG contrast is `(L+0.05)/(L'+0.05)`, so evenly spacing raw
lightness does **not** evenly space the resulting contrast ratios —
gaps higher up the scale produce smaller ratios than the same gap lower
down. Correct approach: hold `fail` and `pass` fixed as the two ends
(`fail` is at its AA floor against `blue-mid`; `pass` is deliberately
kept out of pastel territory — an earlier attempt at L≈0.90 looked
washed out), then space every status in between so that `(L+0.05)`
increases by an equal **ratio**, not an equal difference, at each step.
Solved in OKLCH (same hue and chroma as before for `queued`/`skipped`/
`warning`/`running` — only lightness moved) plus `timed_out`'s new hue.
The resulting ladder (darkest to lightest): `fail` → `timed_out` →
`queued` → `skipped` → `warning` → `running` → `pass`.

Full pairwise contrast, normal vision:

|               | fail | timed_out | queued | skipped | warning | running | pass     |
| ------------- | ---- | --------- | ------ | ------- | ------- | ------- | -------- |
| **fail**      | —    | 1.12      | 1.25   | 1.40    | 1.56    | 1.76    | **1.97** |
| **timed_out** |      | —         | 1.12   | 1.26    | 1.40    | 1.57    | 1.76     |
| **queued**    |      |           | —      | 1.12    | 1.25    | 1.41    | 1.58     |
| **skipped**   |      |           |        | —       | 1.11    | 1.25    | 1.40     |
| **warning**   |      |           |        |         | —       | 1.12    | 1.26     |
| **running**   |      |           |        |         |         | —       | 1.12     |

Worst case is `skipped`/`warning` at 1.11:1 — up from the pre-fix
~1.08:1 floor, but not dramatically higher, because **this is
mathematically close to the ceiling**: with `fail` and `pass` held at
their justified extremes, evenly ratio-spacing five more stops between
them puts a hard cap of ~1.11–1.12:1 on the worst adjacent pair. Getting
materially past that would require either moving `fail` off its AA floor
or moving `pass` into the pastel range already rejected on its own
merits — i.e., lightness has a real, low ceiling as a 7-way
differentiator here. `src/lib/color/contrast.test.ts` now asserts
≥1.1:1 across all 21 pairs (was 5 pairs, and didn't include `warning`),
with that ceiling stated in the test's own comment so a future reader
doesn't try to "just fix" it further without re-deriving the whole
palette.

### CVD simulation — model corrected

The pre-Phase-B review flagged a real problem here too: the originally
reported protanopia contrast for pass/fail (1.03:1) didn't reconcile
with an independent calculation (~2.5–2.8:1). Both numbers were computed
correctly _for the model each used_ — the bug was in
`scripts/check-status-contrast.mjs`'s choice of model, mislabeled as
"the same family Chrome DevTools' vision-deficiency emulation uses."
That label was false: DevTools' emulation uses **Machado, Oliveira &
Fluck (2009)**, a different (also legitimate, also widely published)
dichromacy simulation from the older Viénot/Brettel-style matrices this
script actually had. Re-run against the correct Machado 2009 matrices
(now in the script), the same pass/fail pair reconciles with the
reviewer's independent number:

| CVD type     | pass renders as | fail renders as | contrast between them |
| ------------ | --------------- | --------------- | --------------------- |
| protanopia   | `#d5c790`       | `#7f7a67`       | **2.54:1**            |
| deuteranopia | `#c9bf98`       | `#9d9265`       | 1.69:1                |
| tritanopia   | `#76d1c3`       | `#ee5066`       | 1.95:1                |

(Reproducible: `npm run check:status-contrast`, which now uses the
Machado 2009 matrices and reports all seven statuses, not just
pass/fail. `pass`/`fail` hex values themselves didn't change in this
round — only the four other statuses moved, and only the CVD _model_
was corrected — so these numbers are strictly more accurate than what
was reported before, not just different.)

**Honest limit, stated plainly, still:** even at the corrected 2.54:1,
protanopia is the weakest of the three — a real, if smaller, gap than
first thought. Lightness separation alone still cannot fully solve a
red/green pair for red-green colorblindness the way it can for a
neutral pair, because these deficiencies compress exactly the hue
distinction pass/fail relies on. This is exactly why icon + label (not
color) is the real, model-independent fix, and the lightness ladder
above is a secondary improvement for full-color viewers on top of it —
not a claim that color alone is now sufficient. Abandoning a red/green
pair entirely (e.g. blue/orange) would close this gap further but is a
larger palette change than either review asked for — flagging it rather
than deciding it unilaterally.

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

## Status chips — Phase B, B2

The Phase A finding stood into Phase B: foreground lightness cannot carry
seven states on this background at a usable separation. Text-on-page
needs 4.5:1 against the page for every status, all seven sharing one
narrow lightness band; the worst adjacent pair tops out around
~1.11–1.12:1 — a real improvement over the original bug's ~1.0:1, but
not by much, and not a ceiling any amount of further token-tweaking can
raise (see "Isoluminance" above).

**A filled chip changes which contrast pair the color has to win.**
Instead of status-colored text sitting on the page background, every
`StatusBadge` now renders a solid fill with the label and icon drawn in
a single fixed ink (`--color-blue-deep` — an existing anchor, not a new
color) on top of it. That splits one hard constraint into two easier
ones:

- The **fill** only needs 3:1 against the page (AA non-text, WCAG
  1.4.11) — not 4.5:1.
- The **label/icon** only need 4.5:1 against their _own fill_ — not
  against the page.

Solving for lightness against a fixed dark ink instead of against the
page background moves the usable range from ~[0.25, 0.54] to
~[0.235, 0.91] — measured, not estimated, from the actual constraint
each approach imposes (see the derivation below). Same method as the
`-fg` ladder otherwise: equal **contrast-ratio** steps (not equal
lightness steps — WCAG contrast is `(L+0.05)/(L'+0.05)`, so those are
not the same thing), same hue per status for continuity with the rest
of the app, chroma re-solved to fit the new lightness (reduced at the
lighter end to stay in sRGB gamut — `pass` and `running` most visibly).

| State       | Fill hex  | Ink-on-fill (≥4.5:1) | Fill vs `blue-deep` (≥3:1) | Fill vs `blue-mid` (≥3:1) |
| ----------- | --------- | -------------------- | -------------------------- | ------------------------- |
| `fail`      | `#d75f64` | **4.93:1**           | **4.93:1**                 | **4.30:1**                |
| `timed_out` | `#d87e4c` | **6.05:1**           | **6.05:1**                 | **5.27:1**                |
| `queued`    | `#b6a28f` | **7.38:1**           | **7.38:1**                 | **6.43:1**                |
| `skipped`   | `#b4b6c9` | **9.04:1**           | **9.04:1**                 | **7.88:1**                |
| `warning`   | `#e6c58a` | **10.98:1**          | **10.98:1**                | **9.57:1**                |
| `running`   | `#afe7fe` | **13.54:1**          | **13.54:1**                | **11.80:1**               |
| `pass`      | `#d7ffdd` | **16.61:1**          | **16.61:1**                | **14.47:1**               |

All seven clear both requirements with real margin, and `fail` sits
closest to the floor. Note that the "ink-on-fill" and "fill vs `blue-deep`"
columns are the same number by construction — the ink _is_ `blue-deep` —
so they are one check reported twice, not two independent ones; the
independent check is the `blue-mid` column.

Full pairwise fill-to-fill contrast:

|               | fail | timed_out | queued | skipped | warning | running | pass     |
| ------------- | ---- | --------- | ------ | ------- | ------- | ------- | -------- |
| **fail**      | —    | 1.23      | 1.50   | 1.83    | 2.23    | 2.75    | **3.37** |
| **timed_out** |      | —         | 1.22   | 1.49    | 1.81    | 2.24    | 2.74     |
| **queued**    |      |           | —      | 1.22    | 1.49    | 1.83    | 2.25     |
| **skipped**   |      |           |        | —       | 1.21    | 1.50    | 1.84     |
| **warning**   |      |           |        |         | —       | 1.23    | 1.51     |
| **running**   |      |           |        |         |         | —       | 1.23     |

Worst case is `skipped`/`warning` at **1.21:1** — every adjacent pair
lands at ~1.21–1.24:1, which is the ladder's common contrast-ratio step
(equal-ratio spacing makes every adjacent pair equal by construction,
the same property as the `-fg` ladder). That is a real, measured
improvement over the old ladder's ~1.11–1.12:1 worst case — not
dramatic in absolute terms (both are "barely above 1:1" on their own),
but it roughly **doubles the perceptual margin above 1.0** (0.11 → 0.21)
that a fully colorblind or greyscale viewer gets from lightness alone,
before the icon and label — always present, always distinct-silhouette
and literal text — do the actual, model-independent job of
distinguishing the seven states. `src/components/status/StatusBadge.test.tsx`
asserts all of the above against the real, committed `styles/tokens.css`
(both the wiring — a rendered chip's CSS variable resolves to a real,
defined value — and the numbers — ink-on-fill ≥4.5:1, fill-vs-page
≥3:1, and every pairwise fill combination ≥1.18:1).

### Chips under color-vision deficiency

Same Machado, Oliveira & Fluck (2009) matrices as the foreground analysis
above (`npm run check:status-contrast` reproduces every number). Contrast
is between the two _simulated fills_ — what a dichromat sees of two chips
side by side. The pairs that carry meaning, and the pairs adjacent in the
ladder that don't (nobody confuses `skipped` and `warning` at a glance,
and the icon and label carry it either way):

| Pair                  | Normal | Protanopia | Deuteranopia | Tritanopia |
| --------------------- | ------ | ---------- | ------------ | ---------- |
| `pass` vs `fail`      | 3.37   | 4.27       | **2.93**     | 3.35       |
| `running` vs `fail`   | 2.75   | 3.58       | 2.34         | 2.76       |
| `pass` vs `timed_out` | 2.74   | 3.29       | 2.46         | 2.76       |
| `warning` vs `fail`   | 2.23   | 2.61       | 2.04         | 2.21       |

`pass` vs `fail` under deuteranopia across the three schemes this
project has had: **1.17:1** (the original per-state-minimum foreground
tokens — isoluminant, the WCAG 1.4.1 bug), **1.69:1** (the Phase A
re-derived foreground ladder), **2.93:1** (chips). An independent
recomputation put the chip figure at 2.97; the ~0.04 difference is
consistent with matrix/rounding precision and changes no conclusion.

Adjacent-pair contrast in the ladder stays at ~1.21–1.24 however far the
range widens (a 3.4× wider span over six steps buys ~22% per step — the
sixth-root effect), and that is fine: adjacent pairs are the wrong thing
to optimise. The distinctions that matter — pass/fail, running/fail —
went from 1.00:1 to 3.37:1 and 2.75:1 in normal vision.

**Why not push the range further?** The floor (~0.235) has real margin
above the mathematical minimum for 3:1-vs-page (~0.149) so `fail` isn't
sitting exactly on the line; the ceiling (~0.91) stops short of 1.0 so
`pass` still reads as pale green, not white — an earlier Phase A attempt
at a similarly light `pass` foreground (L≈0.90 in that ladder) was
rejected on its own merits as washed out, and the same taste judgment
applies here. Both ends have room to move if a future review wants more
separation still; this is a deliberate, stated choice, not the absolute
ceiling of what's achievable.

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
