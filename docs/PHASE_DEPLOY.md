# Deploy — Making It a URL

Phase B is complete. The product works end to end and nobody outside this repo
can see it. This step fixes that.

The goal is narrow and specific: **a link someone can open on their phone and
click through the whole flow** — sign in, register a target, scan it, compose a
test, approve a plan, watch it run, open the proof. That's it. Not production
hosting, not a real backend, not scaling.

---

## 0. What this deploy actually is

**A mock-backed demo.** There is no backend. MSW serves every response in the
browser, and it will keep doing so in production. That is deliberate, and it is
the single most important thing about this deploy, because everything below
follows from it.

Two consequences, both non-negotiable:

- **Nobody must be able to mistake this for a working product.** Not a
  colleague, not a stakeholder forwarded the link, not a search engine, not
  someone who finds it in a year.
- **No real data may ever enter it.** It has no persistence, no auth worth the
  name, and a service worker inventing responses. If anyone starts typing real
  customer URLs into it, that's a problem we created by being unclear.

---

## 1. Where

**Vercel.** Reasons, in order: it's the reference host for Next.js so the App
Router, route groups, the OG image route and server components all work without
configuration; preview deployments per pull request come free, which is the
highest-leverage thing in this whole step; and it costs nothing at this scale.

This is not a statement about where the product eventually lives. Once a real
backend exists — likely alongside the existing company infrastructure — that
decision gets made on its own merits. Nothing here forecloses it: the app is a
standard Next build with no Vercel-specific APIs, and it should stay that way.
**Do not introduce a Vercel-only primitive to solve a problem that has a
portable solution.**

---

## 2. Tasks

### D0 — Read `docs/DEV_ONLY_IN_PRODUCTION.md` first

That audit found that a production build currently contains **no mocks at all**:
the mock server starts only in development, so every screen, the landing demo
and the proof page break once built. Its 17 items and their accepted
recommendations are part of this brief. Where this brief and that document
disagree, say so rather than picking one silently.

### D1 — Make MSW work in a production build, and prove it

This is the part most likely to go wrong, because MSW is a development tool
being asked to do something it isn't primarily built for.

**Mocking is switched on by an explicit build flag, `NEXT_PUBLIC_API_MOCKING`.**

- Default **off**. The demo deployment sets it on; nothing else does.
- Flag on **and** a real API base URL configured → **the build fails**. The two
  are mutually exclusive, and a misconfigured deploy must not start.
- Flag off → the mock handlers, the mock sign-in and the non-httpOnly mock
  cookie code are **absent from the build output**, not merely unused. Add a
  test that inspects the production build output for them. The mock cookie
  reaching a real-backend build is the failure this prevents.
- The dev-only affordances ("Simulate error", "View a target with none",
  `/style-guide`, `/dev/zod-messages`) render only when the flag is on, as the
  dev-only document recommends.

Then:

- The service worker must be registered and intercepting in a production build,
  not just in `next dev`. Verify against `next build && next start` locally
  before deploying — a dev-only success proves nothing here.
- The mock gate must not be tree-shaken out of the production bundle, and the
  existing `MockingProvider` readiness race must still be handled. The cold-start
  test from B10 covers the race; make sure it runs against a production build.
- Service worker scope and caching need checking: a stale worker serving old
  handlers after a redeploy is a confusing failure mode. Decide the update
  strategy deliberately and write down what it is.
- If MSW cannot be made to work reliably in production, **stop and report it**
  rather than working around it — the alternative (a stubbed API route layer) is
  a real design decision, not an implementation detail.

### D2 — Make it unmistakably a demo

- **A persistent banner on every screen**, including the public proof page and
  the landing page: this is a demonstration, the data is fictional, there is no
  backend. Not a dismissible toast. Not a footnote. Something a person skimming
  cannot miss.
  - This banner **is** the "Demo – simulated data" marker from the dev-only
    document: one component, shown whenever `NEXT_PUBLIC_API_MOCKING` is on,
    never two banners.
  - Server-rendered, with no client JavaScript, so it costs the proof page's
    budget as little as possible. Report its byte cost on `/p/[token]`.
  - It must meet the measured-contrast rules like any other text.
- **`robots.txt` disallowing everything, plus `noindex` headers.** A demo of a
  testing product ranking in search results is its own small disaster.
- **Vercel deployment protection on the console routes.** The whole point of the
  proof page is that it's publicly reachable, so it can't sit behind auth — but
  the console can, and should. If protection can't be applied selectively, say so
  and we'll decide between a shared password and leaving it open.
- The demo's fixture data must contain **no real company, client or customer
  names or URLs**. Check what's actually in the fixtures rather than assuming;
  this rule has been violated before in the sibling repo.

### D3 — Security headers

These have existed as contract text and local config. Deploying is where they
become real, and where they can be verified from outside.

- Strict CSP. **None exists yet**, although `CLAUDE.md` requires one.
  **Report the options before implementing any of them**; the choice is made in
  review:
  - A nonce-based policy forces dynamic rendering in Next.js. State what that
    does to the proof page's static rendering, its speed and its bundle budget.
  - Compare it with a hash-based or static policy, and say what each gives up.
  - Cover the MSW service worker (`worker-src`), the `sandbox=""` engine-report
    iframe (the CSP must not silently undo the sandbox), the OG image route, the
    proof page's screenshots, and the Unsplash images served through the image
    optimiser, including the sign-in photo.
- `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options` (or
  `frame-ancestors`), HSTS.
- Verify the deployed headers with an external scanner, not by reading the
  config file. Report what it says.

### D4 — CI and preview deployments

- Every pull request gets its own preview URL. This was called out as the
  highest-value piece of infrastructure back in the original plan and it's
  finally buildable. It means every future change can be clicked through before
  it merges, by you or anyone else.
- Deploy to production only on merge to `main`, only when all checks pass.
- The existing CI jobs stay exactly as they are. Deploy is additive — if adding
  it requires changing an existing check, something is wrong.

### D5 — Verify from outside

Not from your machine, not from `localhost`, not from a build log.

- Walk the full spine on the deployed URL in a browser with no cache and no
  extensions.
- **Walk it on an actual phone**, on cellular rather than office wifi. The proof
  page's entire reason for having a tight bundle budget is this scenario, and it
  has never once been tested under it.
- Open a proof link in a private window with no session, and confirm it renders.
- Revoke it and confirm it stops rendering.
- Check the OG image by pasting the proof link into something that generates a
  preview — a messaging app is the honest test, since that's how it'll actually
  be shared.
- Confirm the console routes are protected and the proof route is not.

---

## 3. Report back

- The URL.
- Whether MSW works in production, and what it took.
- The build-output test proving the mocks are absent when the flag is off.
- The status of each of the 17 items in `docs/DEV_ONLY_IN_PRODUCTION.md`.
- The external header scan result.
- What broke between local and deployed. Something always does, and that list is
  the most useful part of this report — it's the difference between "works on my
  machine" and "works".
- Anything in this brief that turned out to be wrong.

---

## 4. Stop and ask

- If MSW can't be made to work in a production build.
- After the CSP options report, before implementing a policy.
- If deployment protection can't be applied to the console while leaving `/p/*`
  public.
- Before pointing a company-owned domain at this. A demo on a project URL is one
  thing; a demo on a company domain implies something it shouldn't.
- Before adding any Vercel-specific API or primitive.

The deliverable is one link that works. Everything else is in service of that.
