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

**Deliberately increasing a route's budget:** gzip output isn't perfectly
platform-invariant (a systematic macOS-vs-Ubuntu offset, not
run-to-run noise — see `TOLERANCE_BYTES` in the script), so the
committed baseline has to be measured on CI, not a contributor's
machine. Run `npm run bundle-budget -- --write` locally first to see the
size of your own diff, then open the PR, let CI's `bundle-budget` job
run, and copy the exact byte counts it prints (every line includes them,
not just the rounded KB) into `bundle-budget-baseline.json` — commit
those numbers, and say why in the PR body.

**The public proof page** (`/p/[token]`, not built yet) gets its own
separate, tight budget once it exists — it's opened cold, often on a
phone, by someone who didn't run the test, and shouldn't pay for the
console's dependencies. See `PUBLIC_ROUTE_BUDGET_BYTES` in the script:
intentionally unset, because there's no honest number to write for a
route that doesn't exist yet.

**Phase C entry criterion:** before `/p/[token]` ships, measure it and
set `PUBLIC_ROUTE_BUDGET_BYTES` to a real, deliberately tight number (not
the app-shell ratchet default) in the same PR that builds the route -
not as a follow-up. Until then `npm run bundle-budget` only warns on
that route, it doesn't fail; that warning is a placeholder for this
criterion, not a substitute for it.

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
component. The four proof-of-primitive pages above still use Phase A's
minimal `src/hooks/useResource.ts` (no caching, one fetch per mount) -
Phase B's real screens use the data layer below instead; `useResource`
is not being extended further and goes away once nothing uses it.

**Known mock-only limitation:** Service Workers cannot set cookies via a
`Set-Cookie` response header (a browser/spec restriction, not an MSW bug).
The mock's own `/auth/verify` and `/auth/logout` handlers set it anyway,
correctly, because that's what a real backend's response will do; the
sign-in/sign-out pages additionally set/clear the cookie via
`document.cookie` as a mock-only workaround
(`src/mocks/session-cookie-workaround.ts`). This entire file should be
deleted once a real backend exists.

## Data layer (`src/lib/api/`)

Phase B, B1: one directory owns all backend communication. No component
fetches, no inline URL strings — every resource goes through a query or
mutation hook here, and every response is Zod-parsed at the boundary
(`client.ts`). No `as` casts.

- **`client.ts`** — `apiGet`/`apiPost`/`apiPatch`/`apiDelete`, each taking
  a Zod schema and returning parsed, typed data. `credentials: "include"`
  on every request (cookie auth, sibling-subdomain deployment, per
  `docs/API_CONTRACT.md`) and a 15s timeout by default.
- **`errors.ts`** — every failure (`network`, `http`, `parse`, `timeout`)
  normalises to one `ApiError` shape, so a component handles "something
  went wrong" once while still able to branch on `kind` (a 404 is not a
  dropped connection). A schema-parse failure — our contract drifting
  from what the server actually sent — is loud (`console.error`) in
  development and quiet in production.
- **`QueryProvider.tsx`** — [TanStack Query](https://tanstack.com/query)
  for cache keys, per-resource stale times, and invalidation, rather than
  hand-rolling a cache layer for what's already a well-tested one. Only
  `network`/`timeout` errors and 5xx retry (twice, exponential backoff);
  a 4xx or a schema-parse failure retrying gets the same wrong answer
  back. One `QueryClient` per component-tree instance, not a module
  singleton — the safe pattern for the App Router.
- **`keys.ts`** — every query key in one place, so a mutation for one
  resource can invalidate another's cache without reaching into its
  internals.
- **`queries/*.ts`** — one file per resource (`workspaces`, `targets`,
  `scans`, `inspect`, `suites`, `runs`, `proofs`). Stale times are chosen
  per resource, not defaulted: a finished `proof` is immutable
  (`staleTime: Infinity`); a `run` or `scan` in progress has none
  (`staleTime: 0`, plus a conditional `refetchInterval` that stops once
  the status is terminal); `targets`/`suites` change rarely (60s). Each
  hook's comment says why. (`usage` and suite-authoring endpoints beyond
  what the spine needs are Phase C and intentionally not here yet.)
- **`sse/jobEventsReducer.ts`** — the pure `(state, event) => state`
  reducer `GET /jobs/{id}/events` folds into. Keyed by `Step.index`, with
  a per-key "last-applied event id" so a shuffled/duplicated/late
  arrival can never overwrite newer state — verified by
  `jobEventsReducer.test.ts` against exactly those hostile sequences
  (shuffled, duplicated, gapped-then-backfilled), not just the happy
  path.
- **`sse/useJobEvents.ts`** — the `EventSource` client: reconnects with
  exponential backoff + full jitter (capped at 30s), resumes via an
  explicit `?since=<last-seen-id>` on every (re)connection (not
  `EventSource`'s native `Last-Event-ID` header, which some proxies
  strip), and deliberately does **not** treat a quiet-but-open stream as
  a failure — Phase A's `LIVE_STALL_TIMELINE` goes quiet for a real 15s
  before resolving, and forcing a reconnect on an idle timer would
  misreport a healthy, slow run as a dropped connection. `lastEventAt` is
  exposed instead, for a consumer to render its own staleness affordance.
  Not unit-tested itself (jsdom has no `EventSource`) — verified by
  driving it in a real browser once B7 wires it into a screen.

## What is not here yet

No backend exists — only the mock above. Phase A is foundation only: no
product screens. See `docs/PHASE_A.md` for the full four-phase plan and
`CLAUDE.md` for the rules that govern everything built here.
