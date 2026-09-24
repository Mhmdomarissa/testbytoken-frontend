# Development-only things in a production build

Input to the deploy work. Every item that exists for development, testing
or the pre-backend demo, what a production build (`next build && next
start`) does with it today, and a recommendation. Nothing here has been
changed. Each fix is its own behaviour PR.

Found by reading the code (every `NODE_ENV` and `NEXT_PUBLIC_` use, every
route, `public/`, and each dev affordance in the UI), not by guessing.

## Read this first: production has no mocks

`MockingProvider` starts the MSW worker **only when
`NODE_ENV === "development"`**. A production build therefore talks to
`NEXT_PUBLIC_API_BASE_URL`, which is empty by default, so it talks to the
Next server itself. **There is no backend yet**, so every data screen, the
sign-in, the landing demo and the public proof page fail in a production
build.

That decides what "deploy" means before any of the list below matters:

| Option                                                                               | What it takes                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. A demo deployment that runs on the mocks** (recommended until a backend exists) | Gate `MockingProvider` on an explicit `NEXT_PUBLIC_API_MOCKING=on` instead of `NODE_ENV`. Its own comment already asks for this. The demo build sets it; a real production build never does. A visible "Demo - simulated data" marker in the shell and on the proof page whenever it's on, so no screen can be mistaken for a real result. |
| **B. Deploy against a real backend**                                                 | Not possible yet.                                                                                                                                                                                                                                                                                                                          |

Everything below assumes option A for the demo deployment, and says what
changes when a real backend exists.

## The list

| #   | Item                                                                                                                               | Where                                                                    | In a production build today                                                                                                   | Recommendation                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **"Simulate error"** link                                                                                                          | `/runs`, page-action position                                            | Visible. Links to `?simulate_error=true`, which only the mock honours, so against a real backend it does nothing.             | **Hide unless mocking is on.** It's a useful demo of the error state, but it's a test control, not a product action. The runs-list PR already moves it out of the page-action slot.                                                              |
| 2   | **"View a target with none"** link                                                                                                 | `/runs` description line                                                 | Visible. Filters to the fixture id `tgt_empty`, which only exists in the mock.                                                | **Hide unless mocking is on.** Same reasoning as #1.                                                                                                                                                                                             |
| 3   | **"Continue (dev - no backend yet)"** button                                                                                       | `/sign-in`, after "Send magic link"                                      | Visible. Calls `/auth/verify` with the literal token `"dev"`.                                                                 | **Keep only with mocking on, relabelled** ("Continue to the demo"). With a real backend it must not exist: the magic-link email is the only way in.                                                                                              |
| 4   | **`setMockSessionCookie()`**                                                                                                       | `src/mocks/session-cookie-workaround.ts`, called by sign-in and sign-out | Writes a **non-httpOnly** `session=demo_user` cookie from JavaScript. This is a mock-only stand-in for the real `Set-Cookie`. | **Mocking only, and delete it once a backend exists.** CLAUDE.md requires the auth token in an httpOnly cookie. This is safe only because the "token" is a fixed demo value that authorises nothing real. It must not survive into a real build. |
| 5   | **`/style-guide`**                                                                                                                 | console route                                                            | Built and reachable by any signed-in user. It has **no** production gate, unlike `/dev/*`.                                    | **Hide in production** (`notFound()` behind the same flag as the mocks), or move it under `/dev`. It's an internal reference, not a product page.                                                                                                |
| 6   | **`/dev/zod-messages`**                                                                                                            | console route                                                            | Returns 404 in production (`NODE_ENV` gate).                                                                                  | **Keep as is.** It's already gated, and it's scheduled for deletion with the zod locale workaround (CLAUDE.md "Workarounds with an expiry").                                                                                                     |
| 7   | **`/dev/job-events`**                                                                                                              | console route                                                            | Returns 404 in production (`NODE_ENV` gate).                                                                                  | **Keep as is.** It's already gated.                                                                                                                                                                                                              |
| 8   | **`public/mockServiceWorker.js`**                                                                                                  | static file                                                              | Served at `/mockServiceWorker.js` in every build. It's inert unless registered.                                               | **Keep for the demo deployment** (option A needs it). Exclude it from a real production build.                                                                                                                                                   |
| 9   | **Landing demo** (scenario picker, "Failing step" / "Unplannable")                                                                 | `/`                                                                      | Depends entirely on the mocks, so it breaks without them.                                                                     | **Keep. It's an intentional demo feature**, already labelled "a demonstration… simulated results - not your site". With option A it works as designed. With a real backend it needs a real sandboxed demo target, or it's removed.               |
| 10  | **`/p/share_demo`** baked-in proof token                                                                                           | fixture proof, linked from the landing's "Sample report"                 | Works only with mocks.                                                                                                        | **Keep for the demo.** Replace it with a real published sample proof once a backend exists.                                                                                                                                                      |
| 11  | **Engine report frame**                                                                                                            | run detail, "Engine report"                                              | Points at `https://api.testbytoken.example`, a fixture origin that doesn't resolve, so the frame is blank.                    | **Keep the frame. Mark it "not available in the demo" when mocking is on**, rather than showing an empty rectangle. The run-detail visual PR frames it better but must not fake its content.                                                     |
| 12  | **Mock screenshot placeholders** ("mock screenshot")                                                                               | step rows on run detail and the proof page                               | Every step shows the same placeholder image from `screenshots.testbytoken.example`.                                           | **Keep for the demo** (it's mock data, per your note). With a real backend these are the real screenshots.                                                                                                                                       |
| 13  | **"Engine ready" workspace pill**                                                                                                  | sidebar                                                                  | Its value comes from the mock's `/workspace` response.                                                                        | **Keep.** It's product UI and will reflect the real backend. With option A it's covered by the "Demo" marker.                                                                                                                                    |
| 14  | **Landing footer placeholders** (Security, Pricing, API docs, Trace verification, Status, Privacy Policy, Terms; IN/TW/GH squares) | `/` footer                                                               | Rendered as non-link text and inert squares.                                                                                  | **Before a public deploy: Privacy Policy and Terms need real pages** (legal, not design). The rest can stay as non-links or be removed. Audit item #18 already makes their opacity consistent.                                                   |
| 15  | **Unused create-next-app assets** (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`)                                | `public/`                                                                | Served, and referenced nowhere in `src/`.                                                                                     | **Delete.** They're scaffolding leftovers.                                                                                                                                                                                                       |
| 16  | **Next.js dev indicator** ("N" badge)                                                                                              | every page in `next dev`                                                 | Not present in production builds.                                                                                             | **Leave it** (your decision).                                                                                                                                                                                                                    |
| 17  | **Dev-only console errors** for unrecognised values                                                                                | `src/lib/api/errors.ts`, `useJobEvents.ts`                               | Silent in production by design (loud in dev, graceful in prod, per CLAUDE.md).                                                | **Keep as is.**                                                                                                                                                                                                                                  |

## Also for the deploy work (not dev-only, found while checking)

- **No Content-Security-Policy is set anywhere yet.** CLAUDE.md requires a
  strict CSP with no `unsafe-inline`. It needs to land with the deploy.
  Images come through `/_next/image` (`'self'`), so no third-party
  `img-src` is needed for the landing or sign-in photos.

## Decisions (accepted 2026-09-24) - requirements for the deploy work

The recommendations above are accepted. When the deploy work starts:

1. **`NEXT_PUBLIC_API_MOCKING` is off by default.** Mocking on together with
   a real `NEXT_PUBLIC_API_BASE_URL` **fails the build**. The two are never
   combined.
2. **Flag off means the mocks are not in the output at all.** The mock
   handlers, the mock sign-in path (item 3) and the non-httpOnly cookie code
   (item 4) are absent from the production build. A **test checks the
   production build output** for them, so a regression fails CI instead of
   shipping.
3. **The "Demo - simulated data" marker is one persistent banner
   component** on every screen, including the public proof pages (`/p/*`).
   This is the "D2 persistent banner" from the deploy brief. The brief isn't
   in this repo, so its exact wording and spec have to come from there.
4. **`/dev/zod-messages`** is covered as item 6. It's already 404 in
   production and is deleted together with the zod locale workaround.

## CSP - options report first, no implementation yet

Don't implement a CSP ahead of the deploy work. When deploy starts, the
first step is a report of the options for a decision, covering at least:

- **Nonce-based vs hash/static CSP.** A nonce needs a per-request value, so
  it forces dynamic rendering. The report says what that does to the public
  proof page's static rendering and to its `PUBLIC_ROUTE_BUDGET_BYTES` cap.
- **The MSW service worker** (`worker-src`, for the demo deployment only).
- **The `sandbox=""` engine-report iframe** (`frame-src` for the engine's
  origin; the sandbox attribute itself stays as it is).
- **The OG image route** (`/p/[token]/opengraph-image`).
- **The Unsplash photographs**, served through `/_next/image` (`img-src
'self'`), including the plain `<img>` on `/sign-in`, which uses the same
  optimizer URLs.
