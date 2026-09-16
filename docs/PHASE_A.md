# Phase A — Foundation and contract · work brief for the coding agent

You are starting a **new, empty repository** for the Test by Token frontend.
Read this whole brief before writing anything.

---

## 0. What this project is, and the one unusual thing about it

**Test by Token** is a testing-as-a-service product. A customer pastes a URL,
describes a test in plain English, a real browser runs it, and they get back an
**auditable proof** — every step, screenshots, pass/fail, a timestamp, a
tamper-evident hash, and a compute cost in "test-tokens". There is a Python
engine that crawls an application, generates a test suite and executes it in
Selenium. That engine is not in this repository.

**The unusual thing:** there is no backend API yet, and there is no spec for one.
The backend team will build their API **to match what we produce here**. That
inverts the normal direction and it changes what matters:

- The API contract is not internal plumbing. **It is the primary deliverable**,
  and it will be read and implemented by people who are not us.
- Everything must run today, with no backend in existence, against mocks that
  are the contract's reference implementation.
- **Design the contract to be cheap for them to implement.** A contract shaped
  for UI convenience rather than for what the engine can actually do will get
  trimmed or ignored. Where you have a choice, choose the shape that maps
  closely onto what a crawl/generate/run engine naturally produces.

Full plan for context, but this brief is what you execute:
the four-phase build plan shared separately. Phase A is foundation only —
**no product screens in this phase.**

---

## 1. Hard rules — these go in `CLAUDE.md` and never get overridden

Write `CLAUDE.md` at the repo root as task 2, before any component exists. It
must state at least the following, because a skill or a later session will
otherwise "improve" one of them.

**Design**
- Border radius is **0 everywhere**. No exceptions, including shadcn defaults.
- The palette in section 3 is fixed. **Do not introduce new hues.** New state
  colours are derived in OKLCH from the existing gold/blue anchors.
- **No grey tokens.** Text hierarchy comes from `rgba(248, 244, 238, α)` at
  varying opacity on dark grounds.
- Fonts are Cormorant Garamond (headings) and Montserrat (UI). Nothing else.
- Motion is colour transitions only. No entrance animations, no parallax.

**Security — this product renders text from websites we do not control**
- Step messages, page titles, element labels and error text all originate from
  the customer's application under test. Treat every one as hostile input.
- **`dangerouslySetInnerHTML` is banned repository-wide**, enforced by an ESLint
  rule from the first commit. Do not grant exceptions.
- Any HTML that comes from the engine (e.g. a generated run report) is rendered
  only in a sandboxed iframe **without** `allow-same-origin`, or from a separate
  origin. Never inlined.
- Strict CSP, no `unsafe-inline`.
- **There is no password field for the customer's application anywhere in this
  product.** Not in a form, not in a modal, not "temporarily". This is a product
  guarantee, not a preference. Our own app's login is a separate thing and is
  fine.

**Architecture**
- **The browser talks to the backend API directly.** Next route handlers exist
  for exactly three things: the auth cookie exchange, public proof pages, and OG
  image generation. Do not proxy API calls through Next. Do not build a BFF.
- Every network response is parsed by its Zod schema. No `as` casts at the
  boundary.
- Auth token lives in an **httpOnly cookie**, never `localStorage`.

**Process**
- Small, reviewable commits, one concern each, explaining *why*.
- Do not push to `main`. Branch, PR, CI green.
- If a task turns out materially bigger than described here, stop and report
  rather than improvising.

---

## 2. Tasks, in order

### A1 — Repository, scaffold, CI

The repository exists and is empty. In one PR:

1. Scaffold Next.js (current major, App Router) + TypeScript + Tailwind v4.
   Pin the exact Next version `create-next-app` installs and record it in the
   README — do not float it.
2. `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`,
   `noImplicitOverride: true`.
3. ESLint + Prettier. **The `dangerouslySetInnerHTML` ban is configured now**,
   not later (`react/no-danger` as an error).
4. CI on every PR, every job failing the build — no warnings:
   - `typecheck` — `tsc --noEmit`
   - `lint` — ESLint, including the ban above
   - `format` — Prettier check
   - `unit` — Vitest (can be near-empty at this stage, wire the job)
   - `build` — production build must succeed
   - `bundle-budget` — route JS over 150 KB gzipped fails
5. Branch protection on `main`: PR required, CI green required, no force push.

**Done when:** a PR runs all five checks and a deliberately broken type or an
added `dangerouslySetInnerHTML` both turn CI red.

*(Deploy/preview is deliberately not in this task — the hosting decision is
still open. Structure the workflow so adding a deploy job later is additive.)*

### A2 — `CLAUDE.md`

Write it from section 1 above, in your own words, complete. This is the file
every future session reads first. Keep it under two screens.

### A3 — Design tokens

This is the step that decides whether the product looks like the brand or like
every other shadcn app. Do it carefully.

**The approved palette — use exactly these values:**

| Token | Hex | Role |
|---|---|---|
| `blue-deep` | `#0a1628` | App background, nav, primary ground |
| `blue-mid` | `#0d2244` | Raised surfaces, panels, section alternation |
| `blue-light` | `#1a3a6b` | Hover states |
| `blue-bright` | `#1e4d8c` | Emphasis bands, selected states |
| `gold` | `#c9a96e` | The single accent — CTAs, links, labels, dividers |
| `warm-white` | `#f8f4ee` | Primary text on dark |
| `muted` | `#8a9ab5` | Secondary text |
| `footer-deep` | `#060e1b` | Deepest ground |

**Typography:**
- Headings — Cormorant Garamond, weight 300, negative tracking at large sizes.
- UI and body — Montserrat, 300–700. Uppercase labels at 600–700 with
  `0.14em`–`0.26em` tracking.
- Load via Google Fonts with real fallback stacks declared.

**What you must invent, and the constraint on it:**

The source design language is a *marketing website* system. It has no status
colours, no data density, no application shell. You are extending it, not
copying it. The constraint is explicit and must be honoured:

> *"If a new state color is needed (error, success), derive it with OKLCH from
> the existing gold/blue rather than introducing an unrelated color."*

So:

1. Derive a semantic scale in OKLCH from the gold and blue anchors:
   `pass`, `fail`, `running`, `skipped`, `warning`, `queued` — each with a
   foreground, a background wash and a border.
2. **Contrast-check every one against `blue-deep` and `blue-mid`** to WCAG AA.
   This is where derived colours usually fail. Record the measured ratios.
3. Build an application type scale — compressed, topping out ~28px, with 13–14px
   as the workhorse size. `font-variant-numeric: tabular-nums` on every figure.
   Monospace for locators, ids, hashes and step output.
4. Build a 4px-based density system: comfortable and compact table rows, form
   control heights.

All of it lives in one file, `styles/tokens.css`, as CSS custom properties.
Components reference tokens, never literals.

5. Write `docs/DESIGN_SYSTEM_APP.md`: what carried over from the marketing
   system, what deliberately did not and why, and how each derived colour was
   produced with its contrast ratio. Without this the next person guesses.

**Done when:** the token file is complete, every semantic colour has a recorded
contrast ratio at or above AA on both grounds, and the extension document
explains every departure.

### A4 — shadcn, themed properly

1. Install shadcn. Install the official skill: `npx skills add shadcn/ui`.
   Also install the Next.js skill: `npx skills add vercel/next.js`.
   (Note: `vercel-labs/next-skills` is deprecated — do not use that address.)
2. **Theme before building anything.** Radius token to 0. Replace the neutral
   scale with the opacity-based hierarchy. Wire the fonts. Map shadcn's semantic
   slots onto our tokens.
3. Prove the theme on: Button (all variants), Input, Select, Dialog, Table,
   Badge, Tabs, Toast, Tooltip, Skeleton.

**Done when:** a page showing those components reads as the brand — dark,
zero-radius, gold accent, serif headings — and nothing on it looks like default
shadcn.

### A5 — The API contract

The deliverable the backend team implements. Define each endpoint **once** as a
Zod schema; generate types, OpenAPI and mocks from it.

**Ground it in what the engine actually does.** The engine's real shape, from
the existing system:

- A **workspace** per user — boots an engine process, warms a browser, can be
  reset or torn down.
- A **scan** crawls a target and returns modules, pages and an element
  inventory. It may **park** waiting for the user to sign in themselves.
- **Inspect** opens one module and lists its elements with the locator the
  runner would use — and marks elements it cannot uniquely locate.
- A **run** executes scenarios and emits per-step results: action, target,
  assertion, status, message, duration, screenshot.
- Jobs emit **events over SSE**, resumable from a last-seen id.
- A **proof** is the finished artefact: steps, screenshots, hash, token cost.

Model the contract on that. Endpoints to define:

```
auth        POST /auth/magic-link · POST /auth/verify · GET /auth/me · POST /auth/logout
workspace   POST /workspaces · GET /workspaces/{id} · POST /workspaces/{id}/reset
            DELETE /workspaces/{id}
scan        POST /scans · GET /scans/{id} · POST /scans/{id}/continue   (login handoff)
inspect     POST /inspect
runs        POST /runs · GET /runs (paginated, filtered) · GET /runs/{id}
            POST /runs/{id}/cancel
events      GET /jobs/{id}/events        (SSE, ?since= for resume)
suites      GET /suites · GET /suites/{id} · GET /suites/{id}/versions
targets     CRUD + environments (dev | test | staging | production)
proofs      GET /proofs/{id} · public GET /p/{token} · POST /proofs/{id}/share
usage       GET /usage · GET /usage/budget
```

**Two shapes that are not negotiable, because they encode what we learned:**

- Every run carries **both** `pass_rate` *and* `coverage`
  (`{generated, candidate}`). Pass rate alone is misleading — the engine
  correctly declines to generate tests for elements it cannot uniquely locate,
  so a green run can hide low coverage. The UI must never be able to show one
  without the other.
- Every element in an inventory carries whether it is **uniquely locatable**.
  That flag is what explains the coverage number to a customer.

**Two decisions to write into `API_CONTRACT.md` as requiring their agreement:**

- **SSE auth.** `EventSource` cannot send an `Authorization` header. Either the
  stream authenticates by cookie, or a short-lived token goes in the query
  string — and tokens in URLs end up in server logs. **Recommend cookie.**
- **Screenshot URLs.** A screenshot of a customer's authenticated application is
  not public data. Signed expiring URLs, or session-authenticated routes?

Then:

1. Generate `openapi.json` from the schemas (`zod-to-openapi`).
2. Add a CI job `contract-drift`: regenerate and **fail if it differs from the
   committed file**. The spec can then never fall behind the code.
3. Write `docs/API_CONTRACT.md` — every endpoint, marked **essential** or
   **nice-to-have**, so the backend team can push back early instead of silently
   skipping one.

**Done when:** `openapi.json` is committed, CI proves it matches the schemas,
and the markdown document is something you could hand to a stranger.

### A6 — MSW and fixtures

The mock is the contract's reference implementation, not a stub.

Handlers for every endpoint. Fixtures must include the ugly cases, because clean
fixtures produce a UI that breaks on real data:

- a run that fails, with a real failure message
- a run still streaming, so the SSE path is exercised in dev
- a 64-step run (long list, virtualisation)
- a module with **zero** locatable elements — the honest empty state
- very long element labels and unicode
- **a page title containing `<img src=x onerror=alert(1)>`** — this must render
  as inert text, and there should be a test asserting it
- an empty account with no runs at all

**Done when:** `npm run dev` gives a working application with no backend, and
the XSS fixture is covered by a passing test.

### A7 — The application shell

Sidebar, top bar, workspace/engine status pill, command palette (⌘K), auth
guard, route-level error boundaries, and the offline/reconnecting banner.

Plus the state primitives every screen will reuse: skeletons that match final
layout (never a full-page spinner), empty states that contain the action that
fills them, error states with a retry.

**Done when:** you can sign in against the mock, move around the shell, and
every route renders a loading, empty and error state on demand.

---

## 3. What to report back

1. A short walkthrough of the design tokens — especially **how you derived each
   semantic colour and its measured contrast ratio**. This is the part I will
   review hardest.
2. `openapi.json` and `API_CONTRACT.md`, and anything in the endpoint list above
   you think is wrong, expensive, or missing.
3. Anything in this brief that turned out to be wrong. It was written without
   access to a running backend; if something does not fit, say so plainly rather
   than working around it silently.
4. What you chose not to do, and why.

## 4. Stop and ask rather than guessing

- Any change that weakens a rule in section 1.
- If you find yourself wanting to proxy API calls through Next route handlers.
- If a shadcn component cannot be themed to zero-radius without fighting it —
  that is worth a conversation, not a workaround.
- If the contract starts growing endpoints that feel expensive for a small team
  to implement. Cheaper is better than more elegant here.
- **No product screens in Phase A.** If you are building the console, you have
  gone too far.
