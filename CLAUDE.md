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
  else, ever.
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

## Process

- Small, reviewable commits, one concern each, and explain _why_ in the
  message - not what the diff already shows.
- Never push to `main`. Branch, open a PR, wait for CI green, merge.
- If a task turns out materially bigger than its description, stop and
  report rather than improvising a smaller version of it.

## Stop and ask, don't guess, when:

- A change would weaken any rule above.
- You find yourself wanting to proxy API calls through a Next route
  handler for anything beyond the three listed above.
- A shadcn component fights zero-radius theming hard enough that "fixing"
  it means a workaround rather than a real theme override.
- The API contract is growing endpoints that look expensive for a small
  backend team to implement - cheaper beats more elegant here.
- You're building a product screen before Phase A's foundation work
  (tokens, contract, mocks, shell) is done.
