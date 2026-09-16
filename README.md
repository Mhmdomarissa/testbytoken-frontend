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

Every PR runs six required checks (`.github/workflows/ci.yml`): `typecheck`,
`lint`, `format`, `unit`, `build`, `bundle-budget`. All are wired to fail on
any warning, not just errors. `main` is protected: PRs required, all six
checks must be green, no force-push.

### Bundle budget — read before changing the number

`scripts/check-bundle-budget.mjs` reconstructs the old Next.js "First Load
JS" metric per route (Next 16 removed it from build output — see the script's
header comment for why and how). On this Next 16 + Turbopack + React 19
baseline, an empty route cost ~186 KB gzipped before shadcn existed — pure
framework runtime. Wiring shadcn's `TooltipProvider`/`Toaster` into the root
layout (A4) moved that floor to **~253 KB, measured on `/_not-found`**,
which imports none of the themed components — that JS now loads on every
route because the providers wrap the whole app. The budget is currently set
to **300 KB gzipped/route as a provisional placeholder**, not the 150 KB
originally proposed in `docs/PHASE_A.md`, because 150 KB is well below the
actual framework+UI floor and would fail unconditionally on every route.
This needs a real decision once actual screens exist — see the Phase A
report and `docs/DESIGN_SYSTEM_APP.md`'s "shadcn theme mapping" section.

## Mocking (no backend exists)

`npm run dev` works today with no backend: MSW intercepts every endpoint in
`docs/API_CONTRACT.md` and serves fixtures from `src/mocks/data.ts` -
the contract's reference implementation, not a stub. Fixtures deliberately
include the ugly cases real data produces: a failed run with a real
failure message (`run_fail_1`), a 64-step run (`run_long_1`), a still-
running job that streams live SSE events (`run_streaming_1`), a module
where nothing is uniquely locatable (`mod_settings`), very long and
unicode element labels, a target with no run history at all
(`tgt_empty`), and a page title containing `<img src=x onerror=alert(1)>`,
covered by a passing test (`src/mocks/xss-safety.test.tsx`) proving it
renders as inert text, never markup.

Handlers match wildcard paths (`*/runs/:id`, not `/runs/:id`) so they work
against both same-origin dev requests and whatever absolute backend origin
a later phase configures — `docs/API_CONTRACT.md`'s architecture rule is a
separate backend origin the browser calls directly, not a Next.js proxy.

`src/mocks/handlers.test.ts` exercises the mock over real HTTP (via MSW's
node server + `fetch`, not by calling handler functions directly) and
parses every response through its contract schema.

## What is not here yet

No backend exists — only the mock above. Phase A is foundation only: no
product screens. See `docs/PHASE_A.md` for the full four-phase plan and
`CLAUDE.md` for the rules that govern everything built here.
