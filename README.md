# Test by Token — frontend

Frontend for Test by Token, a testing-as-a-service product: a customer
describes a test in plain English against a URL, a real browser runs it, and
they get back an auditable proof (steps, screenshots, pass/fail, a hash, a
compute cost). There is no backend yet — the API contract this repository
defines is the primary deliverable for Phase A. See `docs/PHASE_A.md` and
(once written) `docs/API_CONTRACT.md`.

## Stack

- **Next.js 16.3.5** (App Router), pinned exactly — do not float this version.
  Next.js 16 made non-trivial breaking changes (Turbopack is now the default
  and recommended builder for both `next dev` and `next build`; `next build`
  no longer prints per-route bundle sizes; `next lint` is removed in favor of
  the ESLint CLI). If you bump this version, re-read
  `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  (or the equivalent for whatever version you're moving to) before assuming
  prior Next.js knowledge still applies.
- TypeScript, `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- Tailwind v4 (CSS-first config, no `tailwind.config.*` file).
- ESLint (flat config) + Prettier. `react/no-danger` is an error — see
  `CLAUDE.md` for why.
- Vitest + Testing Library for unit tests.
- Node.js 26.x (see `.nvmrc`).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                  | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Dev server                                            |
| `npm run build`         | Production build                                      |
| `npm run typecheck`     | `tsc --noEmit`                                        |
| `npm run lint`          | ESLint                                                |
| `npm run format`        | Prettier, write mode                                  |
| `npm run format:check`  | Prettier, check mode (used in CI)                     |
| `npm run test`          | Vitest                                                |
| `npm run bundle-budget` | Per-route gzipped JS budget check (run after `build`) |

## CI

Every PR runs seven required checks (`.github/workflows/ci.yml`): `typecheck`,
`lint`, `format`, `unit`, `build`, `bundle-budget`, `contract-drift`. All are
wired to fail on any warning, not just errors. `main` is protected: PRs
required, all seven checks must be green, no force-push.

### Bundle budget — a per-route ratchet, not a guessed number

`scripts/check-bundle-budget.mjs` reconstructs the old Next.js "First Load
JS" metric per route (Next 16 removed it from build output — see the
script's header comment for why and how).

This used to be a single guessed KB-per-route ceiling. That number moved
four times across Phase A (150 → 220 → 300 → 460 KB) as more of the real
app came into existence, invalidated by the next real measurement every
time. Per the Phase A review, it's now a **ratchet**:
`scripts/bundle-budget-baseline.json` (committed) records each route's own
current measured size as its ceiling. CI fails if a route's build exceeds
_its own_ recorded baseline, or if a route has no baseline entry at all
(new routes must be added deliberately). Nothing is compared to another
route's number or to a guessed target — every regression is visible
without pretending anyone can predict the right figure in advance.

**Deliberately increasing a route's budget:** run
`npm run bundle-budget -- --write`, inspect the diff to
`bundle-budget-baseline.json`, commit it, and say why in the PR body.

**The public proof page** (`/p/[token]`, not built yet) gets its own
separate, tight budget once it exists — it's opened cold, often on a
phone, by someone who didn't run the test, and shouldn't pay for the
console's dependencies. See `PUBLIC_ROUTE_BUDGET_BYTES` in the script:
intentionally unset, because there's no honest number to write for a
route that doesn't exist yet.

## Mocking (no backend exists)

`npm run dev` works today with no backend: MSW intercepts every endpoint in
`docs/API_CONTRACT.md` and serves fixtures from `src/mocks/data.ts` -
the contract's reference implementation, not a stub. Fixtures deliberately
include the ugly cases real data produces: a failed run with a real
failure message (`run_fail_1`), a 64-step run (`run_long_1`), a module
where nothing is uniquely locatable (`mod_settings`), very long and
unicode element labels, a target with no run history at all
(`tgt_empty`), and a page title containing `<img src=x onerror=alert(1)>`,
covered by a passing test (`src/mocks/xss-safety.test.tsx`) proving it
renders as inert text, never markup.

**Stateful lifecycle simulation** (`src/mocks/lifecycle.ts`, added per the
Phase A review, §5 — a mock that only returns static payloads can't
exercise the state transitions a console actually depends on). Every
scan/run's current state is _computed_ from elapsed time since it
started, replayed against a fixed timeline, so polling and SSE always
agree:

- `POST /scans` progresses `queued` → `crawling` → `completed` in real
  time, not an instantly-finished fixture.
- `POST /runs` starts a genuinely `running` run that emits ordered step
  events over time, both via polling `GET /runs/{id}` and via
  `GET /jobs/{id}/events` (SSE).
- `run_live_fail_1` fails partway through, live, with the same real
  failure message pattern as the static `run_fail_1`.
- `run_live_stall_1` stops emitting step events after two steps - a real
  stall, indistinguishable from a healthy slow run until the timeout
  fires - then resolves to a new `timed_out` status (distinct from
  `failed`: a failure has a reason from a specific step, a timeout is the
  _absence_ of one). This is a contract change
  (`RunStatusSchema` gained a sixth value) surfaced by actually building
  the simulation, not decided in the abstract.

`src/mocks/lifecycle.test.ts` tests the computation directly at explicit
elapsed times (the stall scenario alone spans 15s of simulated time - far
too slow to wait out in a unit suite); `src/mocks/handlers.test.ts` proves
the HTTP/SSE wiring around it.

Handlers match wildcard paths (`*/runs/:id`, not `/runs/:id`) so they work
against both same-origin dev requests and whatever absolute backend origin
a later phase configures — `docs/API_CONTRACT.md`'s architecture rule is a
separate backend origin the browser calls directly, not a Next.js proxy.

`src/mocks/handlers.test.ts` exercises the mock over real HTTP (via MSW's
node server + `fetch`, not by calling handler functions directly) and
parses every response through its contract schema.

## Application shell

Sidebar (`src/components/shell/AppSidebar.tsx`), top bar with a command
palette (⌘K), a workspace/engine status pill, an offline/reconnecting
banner, and the auth guard (`src/proxy.ts` — `middleware.ts` is deprecated
in Next 16 in favor of this file). Sign in at `/sign-in` (magic link
against the mock; a "Continue (dev)" button stands in for clicking the
email link, since there's no real inbox).

The real deliverable is the state-primitive set every future screen
reuses: `ListSkeleton` (matches final layout, never a full-page spinner),
`EmptyState` (always carries the action that fills it), and `ErrorState`
(always retryable). `/targets`, `/runs`, `/suites`, and `/usage` are thin
proof-of-primitive pages, not product screens — each demonstrates its
loading, empty, and error state on demand (`/runs?target_id=tgt_empty`
for empty, `?simulate_error=true` for error, both real mock behavior, not
UI-only fakes).

**Data fetching is client-side only, deliberately.** CLAUDE.md's
architecture rule is that the browser talks to the backend directly, with
no Next proxy/BFF — fetching backend resources from a Server Component
would itself be exactly that, so every data-driven page here is a client
component (`src/hooks/useResource.ts`).

**Known mock-only limitation:** Service Workers cannot set cookies via a
`Set-Cookie` response header (a browser/spec restriction, not an MSW bug).
The mock's own `/auth/verify` and `/auth/logout` handlers set it anyway,
correctly, because that's what a real backend's response will do; the
sign-in/sign-out pages additionally set/clear the cookie via
`document.cookie` as a mock-only workaround
(`src/mocks/session-cookie-workaround.ts`). This entire file should be
deleted once a real backend exists.

## What is not here yet

No backend exists — only the mock above. Phase A is foundation only: no
product screens. See `docs/PHASE_A.md` for the full four-phase plan and
`CLAUDE.md` for the rules that govern everything built here.
