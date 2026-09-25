# CLAUDE.md

Read this before touching anything. These rules do not get "improved" -
if one seems wrong for what you're building, stop and raise it instead of
working around it. Context: `docs/PHASE_A.md` (the build brief) and, once
written, `docs/API_CONTRACT.md` and `docs/DESIGN_SYSTEM_APP.md`.

Next.js-version-specific behavior (Turbopack defaults, removed metrics,
route typing, etc.) lives in `AGENTS.md`, which the framework itself
maintains - read it before assuming prior Next.js knowledge still applies.

## Design

UI v2 (`docs/PHASE_UI_V2.md`, owner decision, 2026-09-24) replaced the
original design rules. **Reversed, by name** - don't restore any of these:

- ~~Dark only, no light mode~~ → **light and dark themes.** The system
  setting by default; the console's toggle overrides it and is remembered;
  no flash on load. The landing, the proof page and sign-in follow the
  system through CSS only - no theming JavaScript on public routes.
- ~~Border radius 0 everywhere~~ → **6 px controls** (buttons, inputs,
  chips), **10 px inner panels**, **14 px cards**. Fully round only for
  counts and avatars.
- ~~The palette is fixed; never introduce a new hue~~ → the palette is the
  **semantic token set** in `styles/tokens.css` (surfaces, lines, ink,
  gold, status). New hex values arrive only by changing a token there,
  measured in both themes by `src/lib/color/contrast.test.ts`.
- ~~No grey tokens; text hierarchy from warm-white at varying opacity~~ →
  solid tokens `--ink`, `--ink-muted`, `--ink-faint` (and the neutral
  status grey), each measured on every surface in both themes.
- ~~Cormorant Garamond for headings~~ → Cormorant for **page titles and
  empty-state titles only**. Section headings, labels and every number are
  Montserrat, and numbers are always `tabular-nums`.

The rules now:

- **Every colour is a token.** Components use tokens, never raw hex. The one
  exception is the OG image (satori can't read CSS variables):
  `og-palette.ts`, kept equal to the tokens by `og-palette.test.ts`.
- **Gold is reserved** for the brand mark, the primary action, focus and the
  active nav item. It is never a status colour. Gold as text uses
  `--gold-text` (`text-gold-text`), never the button fill.
- **Form controls** (inputs, selects, checkboxes) are outlined with
  `--line-input` (≥3:1 on every surface). `--line` is for dividers and card
  edges only.
- **Status chips.** Quiet by default: the status tint as ground, the status
  colour on the icon only, the label in normal text. **One filled chip per
  page**, for that page's own verdict. The unrecognised chip stays a dashed
  outline carrying the raw value.
- **Status colour is never the only channel.** Every status has its own icon
  silhouette and its own label (asserted). Only pass vs fail are guaranteed
  apart in lightness (≥1.5:1 in both themes); other pairs may sit close.
  Any colour-only mark (bars, edges, charts) gets a 2 px gap in the surface
  colour between segments, direct count labels or a legend with counts,
  and a text equivalent.
- Fonts: Cormorant Garamond and Montserrat. Nothing else, ever — this
  governs _display and body type_. It does not cover code-like content
  (locators, ids, hashes, step output): that's the platform's system
  monospace stack, no added webfont, confirmed correct in the Phase A
  review. Don't read the absence of a third named typeface here as a
  violation when you see `font-mono` in use.
- Motion shows a state changing, or it doesn't exist. No decoration, no
  parallax, no counting numbers up. Built only from the motion tokens and
  utilities, under the honesty rules and reduced-motion contract in
  `docs/DESIGN_SYSTEM_APP.md`, "Motion" (relaxed from "colour transitions
  only" in Part P).

## Security

This product renders text scraped from websites we do not control - step
messages, page titles, element labels, error text. All of it is hostile
input until proven otherwise.

- **`dangerouslySetInnerHTML` is banned repo-wide**, enforced by
  `react/no-danger` as an ESLint error. No exceptions, no inline disables.
- Any HTML the engine produces (e.g. a generated run report) renders only
  in a sandboxed iframe **without** `allow-same-origin`, or from a separate
  origin. Never inlined into our own DOM.
- Strict CSP. No `unsafe-inline`.
- **There is no password field for the customer's application under test,
  anywhere in this product** - not in a form, not in a modal, not
  temporarily. This is a product guarantee, not a style preference. Our own
  app's login is a separate concern and is fine.

## Architecture

- **The browser talks to the backend API directly.** Next.js route handlers
  exist for exactly three things: the auth cookie exchange, public proof
  pages, and OG image generation. Do not proxy API calls through Next. Do
  not build a BFF, ever, for any reason that seems convenient in the
  moment.
- Every network response is parsed through its Zod schema before use. No
  `as` casts at the API boundary.
- The auth token lives in an **httpOnly cookie**, never `localStorage`.

## Honesty (Phase B, `docs/PHASE_B.md` §1)

The product's whole claim is that nothing is hidden. The engine once
reported skipped steps as passes; that was fixed in the engine and can be
reintroduced in the UI by anyone who reaches for an optimistic update or a
convenient default.

**The UI never invents a status.** It displays exactly what the backend
reported, and nothing else.

- No optimistic status updates. A step is not "passing" because it
  started; a run is not "passed" because the last event was a pass. Render
  `running` until something says otherwise.
- No inferred aggregates. If the backend sends a run-level verdict,
  display it. Never compute one client-side from the steps received so
  far - you may not have all of them.
- **Unknown status values render as unknown, visibly** (an "unrecognised"
  chip carrying the raw value), never as a blank cell, never as a default
  that reads like a legitimate state, and never a throw. Every response is
  parsed through the tolerant twin of its contract schema
  (`src/lib/api/tolerant.ts`, applied once in `client.ts`): a strict
  schema that rejects an unfamiliar enum member hides data - one unknown
  step status used to fail the parse, drop the SSE frame, and make the
  step vanish. Failing closed is not the safe option here. Loud in
  development (console error), graceful in production. Anything not in
  `toBadgeStatus`'s table is unrecognised, not defaulted.
- **Connection loss is a state, not an absence.** If the event stream
  drops, the UI says so. It does not freeze on the last known state and
  let the user believe that is current.

One line: if you are about to render a status the server did not send you,
you are writing the bug this product exists to fix.

**Pass rate never ships alone.** Wherever a pass rate appears - tables,
cards, the run header, the proof page, tooltips, any OG image - coverage
appears beside it. Enforced structurally: use `PassRateCoverage`, which
requires both values. There is deliberately no pass-rate-only component;
do not write `Math.round(run.pass_rate * 100)` in a component.

**Ungrounded and skipped work is shown, never hidden.** If the engine
could not ground a flow (no locator, ambiguous element, login never
cleared) that is a first-class result with a reason (`ResultReason`).
Skipped and ungrounded items are not filtered from lists, not collapsed by
default, and not excluded from counts without the exclusion stated on
screen.

**Everything from a tested site is hostile.** Page titles, element
labels, headings, error text, URLs.

- Long strings truncate and never break layout.
- Text that looks like markup renders as text.
- URLs from scraped content are never made clickable without an explicit
  host-allowlist check, and never `target="_blank"` without
  `rel="noopener noreferrer"`.
- The engine's generated HTML report renders only in a sandboxed iframe
  without `allow-same-origin`, or from a different origin. No third
  option.

**No password field. Ever.** The customer never types their application's
password into our UI. Authenticated testing hands the customer an
interactive browser session where they sign in themselves (MFA and SSO
included). A credential form means the product has been misread.

## Workarounds with an expiry

- **`scripts/zod-locale-trim-loader.cjs`** (added 2026-09-21) strips zod's
  unused locales out of the client bundle to work around Turbopack not
  shaking `export * as` (vercel/next.js#88643, colinhacks/zod#6050). **On
  every zod or Next.js upgrade, re-check whether upstream fixed it, and if so
  delete the loader, its `next.config.ts` rule, `scripts/check-zod-trim.mjs`,
  its CI step, `e2e/zod-messages.spec.ts` and `dev/zod-messages`.** The
  loader fails the build loudly if zod's source no longer matches - that is
  a prompt to check upstream, not to loosen the pattern.
- **`/p/[token]`'s client-side fetch + zod parse** (`ProofView.tsx`, added
  Phase B B9, 2026-09-22) exists only because there is no backend yet - MSW
  intercepts in the browser's own JS context, not on the server, so this
  page has to fetch and parse client-side to see the mock at all. That's a
  pre-backend workaround, not the intended shape: this route is one of the
  three named in "Architecture" above where a Next-side handler is
  sanctioned, specifically so it can fetch and validate server-side and
  ship a static page with no client JS for data-fetching at all. **Once a
  real backend exists, rebuild this as a server component** doing a
  server-side fetch + parse, and drop `MockingProvider` from
  `(public)/layout.tsx` and its boundary-test leaf allowance along with it.
  Don't let "once a real backend exists" become never - it's not blocked
  on anything else once the backend is there.
- **`StepList`'s client-side scroll-windowing, reused as-is on the public
  proof page** (added Phase B B9, 2026-09-22): `StepList` is a client
  component (`useState`/`useEffect`) built for a live run that can have an
  unbounded number of steps. A proof's step list is small, fixed, and
  frozen - it never needs virtualization - so reusing the windowed
  component here is a convenience cost, not a requirement, independent of
  the fetch/zod cost above. When the fetch/parse rework above happens,
  reconsider whether the public page needs its own plain, non-windowed,
  server-renderable step list instead of pulling in `StepList` as-is.

## Parked

Built, measured, and deliberately not shipped. The work stays on its
branch; don't revive it without clearing the condition listed.

- **View transitions between screens** (branch `p3-view-transitions`,
  parked 2026-09-23). React's `<ViewTransition update="route">` in
  `ShellMain`/`PublicMain` crossfades route changes; reduced motion is an
  instant swap, and focus stays on `<main>` after the transition finishes
  (its own `e2e/view-transitions.spec.ts` passes). **Why parked:**
  `run.spec.ts`'s cancel test, unmodified, went from 5/5 in 32.6s on
  `main` to 4/5 in 43.8s with transitions - about 2.2s slower per flow,
  so the run finished before it could be cancelled. The animations alone
  account for ~0.3-0.5s per navigation, so most of that is unexplained.
  **Working theory, unconfirmed:** React holds back later updates until a
  running view transition finishes. If so, the screen could briefly show
  an older state than the server has reported - which this product can't
  afford (see "Honesty"). Route transitions are also decoration rather
  than meaning, so they don't earn that risk. **Worth revisiting when:**
  the 2.2s is explained by measurement (profile a live run-watch flow
  with and without the wrapper), it's shown that no server-reported state
  is delayed on screen during a transition, and the unmodified `run.spec`
  cancel test passes reliably (e.g. 20/20) at `main`'s speed.

## Process

- Small, reviewable commits, one concern each, and explain _why_ in the
  message - not what the diff already shows.
- Never push to `main`. Branch, open a PR, wait for CI green, merge.
- If a task turns out materially bigger than its description, stop and
  report rather than improvising a smaller version of it.

## Stop and ask, don't guess, when:

- Anything would put a credential anywhere near our UI, API, or logs.
- Anything would render untrusted HTML outside a sandboxed iframe.
- You are pressured to show a pass rate without coverage.
- A screen seems to need an optimistic status update to feel responsive:
  the answer is a better loading state, not guessing at results.
- A change to the contract is not additive - say the UI needs a field that
  does not exist rather than inventing an endpoint and building against a
  fiction.

- A change would weaken any rule above.
- You find yourself wanting to proxy API calls through a Next route
  handler for anything beyond the three listed above.
- A shadcn component fights the token theme (radius, colours, either
  theme) hard enough that "fixing" it means a workaround rather than a
  real theme override.
- The API contract is growing endpoints that look expensive for a small
  backend team to implement - cheaper beats more elegant here.
- You're building a product screen before Phase A's foundation work
  (tokens, contract, mocks, shell) is done.
