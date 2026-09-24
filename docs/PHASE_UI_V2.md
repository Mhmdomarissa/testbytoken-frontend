# UI v2: from correct to impressive

The product works and the product is honest. It does not yet look like
something a customer would pay for. This phase fixes that. **Deploy is on hold
until the owner signs off on the result.**

The owner has seen a visual direction (a design canvas with the dashboard in
dark and light, run detail, components and a phone view). This brief is the
written spec of that direction, complete enough to build from without seeing
it. Where this brief and your judgment disagree, say so in the PR. Don't
silently pick one.

---

## 0. What is wrong today, in one paragraph

Every surface is the same navy, so nothing has depth. Cards are outlines on the
page colour, which reads as a wireframe. The overview is four link cards and
60% empty space; a dashboard should tell you what happened. Status chips are
saturated pastel blocks that fight the navy and gold. There is no logomark,
only a wordmark. Zero radius everywhere plus the serif makes the app feel like a
legal document rather than a tool. Long pages scroll forever: run detail stacks
the result, steps, the engine report and sharing into one column. Loading,
empty and error states exist but look like afterthoughts.

---

## 1. Decisions the owner has made. These reverse earlier rules.

Update `CLAUDE.md` and `docs/DESIGN_SYSTEM_APP.md` in the first PR so the
written rules match.

1. **Light and dark themes.** This replaces "dark only, no toggle".
   - The theme follows the system by default.
   - A toggle in the top bar and in the user menu overrides it, and the choice
     is remembered.
   - No flash of the wrong theme on load.
   - The public proof page and the landing page follow the system through CSS
     `prefers-color-scheme` only, with **zero client JS for theming**. That
     keeps the proof page's budget intact.
2. **Radius.** This replaces "zero border-radius".
   - 6 px on controls (buttons, inputs, chips).
   - 10 px on inner panels.
   - 14 px on cards.
   - Pills (fully round) only for counts and avatars.
3. **Status chips go quiet.** The default chip is a tinted background, a
   coloured dot and an uppercase label. A **filled** chip is used once per page,
   for the page's own verdict. The unrecognised chip stays visibly different
   (dashed outline, raw value shown).
4. **Four surface steps** (page, sidebar, card, raised) instead of one navy.
   Light theme uses soft shadows. Dark theme uses a 1 px inner highlight plus a
   deep, low shadow.
5. **Gold is reserved** for the brand mark, the primary action, focus and the
   active nav item. **It is never a status colour.**
6. **A logomark**: a gold ring, a thinner inner ring at 45% opacity, and a check
   stroke (a "token" that was checked). The same SVG produces the favicon, app
   icons, the sidebar mark and the OG image mark.
7. **Typography stays** Cormorant Garamond for page titles and empty-state
   titles only, and Montserrat for everything else.
   - All numbers use Montserrat `tabular-nums`, never the serif (L1, now
     enforced everywhere).
   - Use the existing monospace for ids, selectors and URLs.

### Tokens (semantic names; implement as CSS variables under `:root` and `.dark`, shadcn convention)

| token | dark | light |
|---|---|---|
| bg | `#0A1120` | `#F6F5F1` |
| sidebar | `#0D1628` | `#FFFFFF` |
| card | `#111C31` | `#FFFFFF` |
| raised | `#16233C` | `#F2F0EA` |
| border | `#1F2C44` | `#E6E2D8` |
| text | `#EDF1F7` | `#0E1726` |
| muted | `#97A3B6` | `#566173` |
| faint | `#8290A6` | `#626C7B` |
| gold (mark, lines) | `#D4B27A` | `#9A7434` |
| gold-text (links) | `#D4B27A` | `#7A5A22` |
| gold-fill (primary button) | `#D4B27A` | `#C9A96E` |
| on-gold | `#0A1120` | `#0E1726` |

Status colours are a foreground plus a tinted background. In dark the tint is
the foreground at 13% alpha over card; in light it is a solid tint.

| status | dark fg | light fg / bg |
|---|---|---|
| passed | `#5CC98F` | `#17784A` / `#E4F3EA` |
| failed | `#F0747A` | `#B3262F` / `#FBE8E9` |
| running | `#6FA8FF` | `#1F5FC4` / `#E6EEFB` |
| skipped / cancelled | `#A3AEC0` | `#556070` / `#ECEEF2` |
| warning / timed out / ungrounded | `#E7B45A` | `#8A5A00` / `#FBF0DA` |

I measured these before handing them over: every text token is at least 4.5:1
on bg, card and raised, and every chip label is at least 4.5:1 on its own tint.
Measure them again yourself with the existing contrast test, extended to both
themes. Passed and failed are close in lightness (1.36:1 dark, 1.18:1 light).
That is acceptable **only** because the dot, icon and label always travel with
the colour, which is already a rule. Record the CVD numbers for both themes as
before.

---

## 2. Rules that do not change

Everything in `CLAUDE.md` §1 still applies, in both themes:

- The UI never invents a status.
- Pass rate never ships without coverage.
- Ungrounded and skipped work is never hidden.
- Scraped content is hostile.
- There is no password field.

Also unchanged:

- `sandbox=""` on the engine report.
- The route-boundary test.
- Measured contrast.
- Reduced-motion stills.
- Nothing counts up.
- Marks draw only when the server's event arrives.
- The bundle ratchet with CI bytes.
- The two-PR limit.
- Unmodified e2e on visual PRs.
- Full unfiltered output for any number you report (RTK exclusions).

---

## 3. Work packages, in order, one PR each unless noted

### V0 · Tokens and theme infrastructure

- Semantic tokens for both themes (table above). Every component consumes
  tokens; no raw hex in components.
- Theme provider: `next-themes` is **approved** (small, standard with shadcn).
  - Use the class strategy.
  - Default to system.
  - Avoid a flash on load: its script, or a cookie read on the server.
    Explain which one you chose and why.
- The contrast test covers both themes, plus the chip-on-tint pairs.
- Update `CLAUDE.md` and `DESIGN_SYSTEM_APP.md` with §1.
- Expect every page to change colour in this PR. Screenshots of 4
  representative pages in both themes.

### V1 · The shell

- **Sidebar**: the shadcn `Sidebar` component.
  - It collapses to a 68 px icon rail (⌘B) and becomes a `Sheet` on mobile.
  - Top: the logomark, the "Test by Token" wordmark and the workspace name.
  - Nav with icons: Overview, Targets, Runs, Suites, Proofs (only if a proofs
    list exists in the contract; otherwise leave it out and log the gap), then
    Usage under an "Account" label.
  - Counts beside nav items (e.g. targets: 3, runs: "1 live") only when the
    server provides them.
  - Bottom: an engine status card (dot, "Engine ready", last check), then the
    user button opening a `DropdownMenu` (theme, sign out).
- **Top bar**:
  - The sidebar toggle.
  - Breadcrumbs (workspace › page › entity).
  - A search button that opens the existing CommandPalette and shows ⌘K.
  - The theme toggle.
  - A primary "New test" button that goes to compose.
- **Demo banner slot**: a full-width strip above everything, shown only when
  `NEXT_PUBLIC_API_MOCKING` is on (the deploy brief's D2). Build it now so the
  layout accounts for it.

### V2 · Overview becomes a dashboard

It has five parts, top to bottom:

1. **Title row**: "Overview", a supporting line, and a range switch
   (7 / 14 / 30 days).
2. **Four KPI cards**:
   - Runs in range, with a stacked verdict bar and "31 passed · 9 failed · 2
     cancelled".
   - The latest suite run: its filled verdict chip, pass rate and coverage as a
     pair, and the step counts.
   - Targets: the count, plus scanned and needs-attention chips.
   - Proofs shared: live and revoked.
3. **Runs per day**: a stacked bar chart by verdict, with a legend. Build it
   as **hand-written SVG**, not Recharts. One chart does not justify about
   100 KB of charting library under a zero-tolerance ratchet. If a second chart
   type is ever needed, ask.
4. **Needs attention**: failed runs, expired sign-in sessions and refused or
   failed scans, each with a one-line reason and a direct action.
5. **Recent runs**: a table with run name and id, target, status chip, a
   "pass · coverage" column, duration and started. A running row shows
   "Reported when finished" instead of a pass rate.

**Contract.** None of these numbers may be aggregated client-side from a
paginated runs list; a partial list would produce a confidently wrong
dashboard.

- Add an **additive** endpoint (e.g. `GET /overview?range=`) that returns:
  - per-day counts by verdict;
  - the latest suite-run summary, with pass rate and coverage together;
  - the targets summary;
  - the proofs summary;
  - the attention items.
- Mark it required in `API_CONTRACT.md`, add it to `openapi.json` and mock it
  with fixtures that agree with the existing run fixtures (see the run-detail
  75% issue).
- If the endpoint fails, the dashboard says so per card. It does not show
  zeros.

**New accounts** (no targets): the KPI area is replaced by the existing
four-step getting-started path, turned into a checklist. Each step shows done
or not done, and that state comes from server data.

### V3 · Run detail v2

This replaces the waiting run-detail branch. Carry its good parts over.

- **Header**:
  - The breadcrumb.
  - The title in the serif.
  - The run id as a mono chip, with a "Copy run id" button.
  - A meta row with icons: target, suite, started, duration.
  - "Share proof" as the primary action.
- **Result panel**, one card in four cells:
  1. The verdict: a filled chip plus a one-line reason ("Failed at step 11
     of 12: #confirm-button never became visible").
  2. Pass rate as a ring plus a number.
  3. Coverage as a ring plus "21 / 24".
  4. A step breakdown bar with counts, including "3 elements not covered".
  - Pass rate and coverage are the same size, and all numbers use
    Montserrat.
  - While the run is running, the pass-rate cell reads "reported when the run
    finishes".
- **Tabs** (shadcn `Tabs`, synced to `?tab=` so they can be linked): Steps ·
  Screenshots · Engine report · Proof.
  - **Steps**: a compact row per step with number, quiet chip, action (mono),
    target (mono, truncated) and duration. Rows that did not pass can expand to
    the reason, locator facts, "Copy selector", "View element in inventory" and
    the screenshot at failure. **Failed rows are expanded by default; skipped
    and ungrounded rows are always listed and never filtered out.**
  - **Engine report**: the framed sandbox with the caption "Engine report ·
    contains content from the tested site" and "Sandboxed · scripts off".
  - **Proof**: the share or revoke panel.
- Fold in the open review items from the waiting branch:
  - The unexplained e2e failure: identify it before this PR opens.
  - The serif-to-Montserrat fix for numbers.
  - The 75% fixture consistency.
  - The caption wording.
  - Unambiguous dates.

### V4 · Lists become data tables

Runs, targets and suites use the shadcn data-table pattern.
`@tanstack/react-table` is **approved**.

- Sortable columns and a status filter.
- Search, and cursor pagination that matches the contract.
- If filtering can only happen over what is loaded, say so on screen ("Showing
  50 loaded runs").
- Empty, loading (skeleton rows) and error states for every table.

### V5 · The states system

- **`Skeleton`** shaped like the real layout (KPI card, table row, step row),
  with a CSS sheen. With reduced motion the sheen stops and the skeleton stays
  still. Skeletons never use status colours.
- **Empty states**: an icon tile, a serif title, one or two sentences on what
  to do, a primary action and a secondary "how it works" link. Cover no
  targets, no runs, no suites, no proofs and an empty inventory.
- **Error states** by kind, using the contract's failure kinds (unreachable,
  refused, timeout, blocked by guardrail, internal). Each says what happened
  and gives numbered next steps, with the right buttons.
- **Toasts**: `sonner` is **approved** if the project doesn't already have a
  toast. A toast only confirms something the server accepted ("Run started ·
  the server accepted run_…", "Public link created · copied"). It never
  announces a result.

### V6 · Apply the system to the remaining screens

Compose and plan review, login handoff, inventory, suites, usage and sign-in,
one screen per PR as before. The shell and components carry most of the work;
each PR is mostly composition.

### V7 · Public surfaces

- Landing, proof page, OG image, and the 404 and 500 pages.
- Logomark everywhere.
- Light and dark via `prefers-color-scheme` only.
- The proof page stays inside its own hard cap; report its bytes.

### V8 · Motion pass (CSS only, tokens already exist)

- Content fades up by 4 px over 150 ms on route change.
- Cards lift one surface step on hover.
- The tab indicator slides.
- Step rows expand with a height transition.
- The sidebar width transitions when it collapses.
- Skeletons cross-fade into content.
- Every one of these has a reduced-motion still.
- View Transitions stay parked.

### V9 · Details that separate good from impressive

- One date formatter everywhere: "24 Sep 2026, 18:00", or relative time
  ("12 min ago") with the absolute time in a tooltip.
- Tooltips on every icon-only button.
- Copy-to-clipboard with a visible "Copied".
- A keyboard-shortcut sheet on `?`.
- Favicon and app icons from the logomark.
- Every touch target is at least 44 px on `pointer: coarse`.
- Consistent page padding (32 px desktop, 16 px phone) and section gaps
  (20 px).

---

## 4. How each PR reports

For every PR:

- Before and after screenshots in **dark, light and phone**.
- The contrast table for anything new, in both themes.
- Axe in both themes.
- e2e passes unmodified, or every changed test is disclosed with the reason.
- The bundle delta per route, with the cause of any rise.

Everything else stays as in earlier reports: say what you proved versus what
you inferred, and flag anything in this brief that turned out to be wrong.

---

## 5. Stop and ask

- Before any dependency not approved above. Approved: `next-themes`,
  `@tanstack/react-table`, `sonner`, and shadcn components added through its
  CLI. Recharts and motion libraries are **not** approved.
- Before any contract change that isn't additive.
- If a design choice here would weaken an honesty rule or an accessibility
  guarantee. It shouldn't; if it looks like it does, that's a conversation.
- If a token fails contrast once measured in place. Propose the nearest value
  that passes; don't ship the failing one.
