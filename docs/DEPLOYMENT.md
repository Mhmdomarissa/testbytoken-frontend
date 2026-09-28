# Deployment: the mock-backed demo

How a build decides whether it runs on the mocks, how that is enforced, and
how the demo's service worker is kept up to date. The why is in
`docs/PHASE_DEPLOY.md` (D1) and `docs/DEV_ONLY_IN_PRODUCTION.md`.

## The flag

`NEXT_PUBLIC_API_MOCKING` decides, **at build time**, whether the app runs
on the MSW mocks.

| Value              | Build                                                                |
| ------------------ | -------------------------------------------------------------------- |
| unset, `""`, `off` | **Real build (the default).** No mock code in the output.            |
| `on`               | **Mock-backed demo.** MSW answers every API request, in the browser. |
| anything else      | **Fails.** A typo like `true` must not silently pick either side.    |

- `next dev` runs with it on: `.env.development` (committed, no secrets)
  sets it, because there is no backend.
- A production build is off unless the environment sets it. The demo
  deployment sets it; nothing else does.
- **On together with `NEXT_PUBLIC_API_BASE_URL` fails the build.** A demo
  never calls a real API, and a build that looks connected to one must not
  ship mocks.

Both failures happen before anything compiles: `next.config.ts` calls
`resolveMocking()` (`scripts/mocking-env.mjs`, unit-tested in
`src/lib/mocking-env.test.ts`).

## How the mocks stay out of a real build

`next.config.ts` always defines the variable, as `"on"` or `"off"`, so it is
inlined as a constant everywhere. Every gate is written out as
`process.env.NEXT_PUBLIC_API_MOCKING === "on"` **in the file that uses it**,
not imported from a shared module. Next inlines the variable only at the use
site; a constant exported from another module is not propagated, and the
first attempt at D1 (a shared `MOCKING` export) shipped the whole mock layer
in a flag-off build. Where the gate guards a dynamic `import()` of mock code,
the condition is written directly around the import, so the build can see
that the import is dead and emit no chunk for it.

With mocking off, the output contains none of:

- the MSW runtime, handlers and fixtures (`MockingProvider`'s import is dead);
- the mock sign-in button, "Continue to the demo", and its literal token;
- the non-httpOnly `session` cookie code
  (`src/mocks/session-cookie-workaround.ts`);
- `public/mockServiceWorker.js`: `next.config.ts` (loaded by every
  `next dev` and `next build`, bare or via npm) writes it from the
  installed msw when mocking is on and deletes it when off
  (`scripts/msw-worker.mjs`). It is not committed.

The mock-only screens return 404: `/style-guide`, `/dev/zod-messages` and
`/dev/job-events`. The runs list hides "Simulate error" and "View a target
with none". The OG image route fetches `GET /p/{token}` from the API instead
of reading the mock store.

**Proof, not promise:** `scripts/check-mocks-in-build.mjs absent` scans
`.next/static`, `.next/server` and `public/` of a real build for a marker
from each part above, and fails if any is there. The CI job `mocks-in-build`
runs it on a flag-off build. It also runs `present` on a flag-on build, so
the gate can't be tree-shaken out of the demo either.

## Checking a production build locally

```sh
npm run build && node scripts/check-mocks-in-build.mjs absent
NEXT_PUBLIC_API_MOCKING=on npm run build && node scripts/check-mocks-in-build.mjs present
npm run test:e2e:prod   # the whole e2e suite against `next build && next start`, mocking on
```

`test:e2e:prod` never reuses a running dev server. It builds and starts the
demo itself, so the service worker is exercised as it will be deployed.
That includes `e2e/cold-start.spec.ts`, which checks the worker is ready
before the first request.

## Service worker updates

The worker can't serve stale handlers, by construction:

- **The handlers aren't in the worker.** MSW's worker is a relay: for each
  request it asks the page that made it to resolve the response, using the
  handlers in that page's own JavaScript. Those ship in content-hashed
  chunks, so a redeploy's new handlers arrive with the new page. A worker
  left over from an earlier deploy has no handlers of its own to be stale.
- **The worker script changes only when msw is upgraded.** It is generated
  from the installed msw at build time, so the worker and the page's msw
  runtime are always the same version within a build. MSW checks the
  pairing on start (`INTEGRITY_CHECK_REQUEST`).
- **An updated script takes over at once.** MSW calls
  `navigator.serviceWorker.register()` on every page load. That makes the
  browser check the script, and browsers bypass the HTTP cache for a
  worker's own script. The worker calls `skipWaiting()` on install and
  `clients.claim()` on activate. `/mockServiceWorker.js` is served with
  `Cache-Control: no-cache` (`next.config.ts`), so no CDN in between can hold
  an old copy either.
- **Pages are never served by it.** The worker passes navigation requests
  through, so HTML always comes from the server. It only mocks for pages
  that started the MSW client (`MOCK_ACTIVATE`), and passes everything else
  through.

The one window: a tab left open across a deploy keeps its old page and old
worker. They are a consistent pair and keep working until the tab reloads.

**When a real backend replaces the demo on the same origin:** browsers that
visited the demo keep the old worker registered. It is harmless, because no
page activates it any more, so it passes every request through. It is also
dead weight, so at that point add a one-time
`navigator.serviceWorker.getRegistrations()` clean-up for
`mockServiceWorker.js`, or deploy the real product on a different origin.

## Vercel settings for the demo (the owner sets these)

- **Environment variable:** `NEXT_PUBLIC_API_MOCKING=on`, for Production
  and Preview.
- **Do not set** `NEXT_PUBLIC_API_BASE_URL`. The build fails if both are
  set.
- **Build command:** the default. `next build` and `npm run build` are
  equivalent here: the worker file is written by the config itself.
- Nothing Vercel-specific is used. The same build runs under
  `next build && next start` anywhere.
