# CLAUDE.md

Read this before touching anything. These rules do not get "improved" -
if one seems wrong for what you're building, stop and raise it instead of
working around it. Context: `docs/PHASE_A.md` (the build brief) and, once
written, `docs/API_CONTRACT.md` and `docs/DESIGN_SYSTEM_APP.md`.

Next.js-version-specific behavior (Turbopack defaults, removed metrics,
route typing, etc.) lives in `AGENTS.md`, which the framework itself
maintains - read it before assuming prior Next.js knowledge still applies.

## Design

- Border radius is **0 everywhere**. No exceptions, including shadcn
  defaults - override the theme, don't add a rounded corner "just this
  once."
- The palette is fixed (`styles/tokens.css`). **Never introduce a new hue.**
  If a new UI state needs a color, derive it in OKLCH from the existing
  gold/blue anchors.
- **No grey tokens.** Text hierarchy on dark grounds comes from
  `rgba(248, 244, 238, α)` at varying opacity, not a grey scale.
- Fonts: Cormorant Garamond for headings, Montserrat for UI/body. Nothing
  else, ever — this governs _display and body type_. It does not cover
  code-like content (locators, ids, hashes, step output): that's the
  platform's system monospace stack, no added webfont, confirmed correct
  in the Phase A review. Don't read the absence of a third named
  typeface here as a violation when you see `font-mono` in use.
- Motion is color transitions only. No entrance animations, no parallax.

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
- A shadcn component fights zero-radius theming hard enough that "fixing"
  it means a workaround rather than a real theme override.
- The API contract is growing endpoints that look expensive for a small
  backend team to implement - cheaper beats more elegant here.
- You're building a product screen before Phase A's foundation work
  (tokens, contract, mocks, shell) is done.
