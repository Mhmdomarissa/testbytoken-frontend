# Phase B — The Spine

Phase A built the foundation. Phase B builds the one flow that makes this a
product: a person points at a web application, describes a test in plain
English, watches a real browser execute it, and walks away with a result they
can hand to someone else.

Everything else — suites, history, settings, usage, team management, onboarding
— is Phase C. If you find yourself building those, stop.

Read `docs/PHASE_A.md` and `docs/PHASE_A_REVIEW.md` first. Every hard rule in
`CLAUDE.md` still applies.

---

## 0. Context you need before you start

**There is still no backend.** The contract you wrote in Phase A has not been
reviewed by anyone who will implement it. That is a known, accepted risk, and it
shapes how Phase B must be built: **every call to the API goes through a single
typed data layer.** No component fetches. No inline URL strings. When the
contract changes — and it will — the blast radius must be one directory.

**This brief was written without reading your `API_CONTRACT.md`.** It describes
the flow the product needs. Where it names an endpoint or field that doesn't
match what you actually specified, your contract wins — but tell me which ones
diverged and why, because a divergence may mean the contract is missing
something the UI genuinely needs.

**The product's whole claim is honesty.** The engine this frontend will
eventually drive had a defect where skipped steps were reported as passes. That
bug was fixed at the engine level. It can be reintroduced at the UI level, very
easily, by anyone who reaches for an optimistic update. Read §1.3 carefully.

---

## 1. Rules to add to `CLAUDE.md` before writing any component

### 1.1 The UI never invents a status

The interface displays exactly what the backend has reported, and nothing else.

- No optimistic status updates. A step is not "passing" because it started. A
  run is not "passed" because the last event was a pass. Render `running` until
  something says otherwise.
- No inferred aggregates. If the backend sends a run-level verdict, display it.
  Do not compute a verdict client-side from the steps you happen to have
  received — you may not have all of them.
- Unknown status values render as unknown, visibly, and do not crash. A backend
  that adds a status you've never seen must produce a visible "unrecognised
  state" chip, not a blank cell and not a default-to-pass.
- Connection loss is a state, not an absence. If the event stream drops mid-run,
  the UI says the stream dropped. It does not freeze on the last known state and
  let the user believe that's current.

The rule in one line: **if you are about to render a status the server did not
send you, you are writing the bug this product exists to fix.**

### 1.2 Pass rate never ships alone

A pass rate without a coverage figure is a misleading number — it hides how many
flows were never attempted. Wherever a pass rate appears, coverage appears
beside it: in tables, cards, the run header, the proof page, tooltips, and any
generated OG image.

Enforce it structurally, not by discipline: build one component that takes both
values and renders the pair. Do not expose a pass-rate-only component. If
someone needs just the number, they can still only get it through the pair.

### 1.3 Ungrounded and skipped work is shown, never hidden

If the engine could not ground a flow — no locator, ambiguous element, login
never cleared — that is a first-class result the user must see, with the reason.
Skipped and ungrounded items are not filtered out of lists, not collapsed by
default, and not excluded from counts without the exclusion being stated on
screen.

### 1.4 Everything from a tested site is hostile

Page titles, element labels, headings, error text, URLs — all of it is scraped
from a site we do not control and rendered in our app. `react/no-danger` is
already `error`. In addition:

- Long strings truncate and never break layout.
- Text that looks like markup renders as text.
- URLs from scraped content are never made into clickable links without an
  explicit host allowlist check, and never target `_blank` without
  `rel="noopener noreferrer"`.
- The engine's own generated HTML report renders only in a sandboxed iframe
  without `allow-same-origin`, or from a different origin. There is no third
  option.

### 1.5 No password field. Ever.

The customer never types their application's password into our UI. Authenticated
testing works by handing the customer an interactive browser session where they
sign in themselves, including MFA and SSO. If you find yourself building a
credential form, you have misread the product.

---

## 2. Tasks

### B1 — The data layer

One directory that owns all backend communication.

- Typed client generated from or validated against the Phase A schemas. Every
  response Zod-parsed at the boundary. No `as` casts.
- Query hooks per resource with consistent cache keys, stale times chosen
  deliberately per resource (an inventory is stable; a run is not), and
  documented invalidation.
- One error normaliser. Network failure, 4xx, 5xx, schema-parse failure and
  timeout all arrive at the UI as the same shape, distinguishable by kind. A
  schema-parse failure in particular must be loud in development — that is the
  contract drifting — and handled gracefully in production.
- **The SSE client, which is the hard part.** It must handle: reconnection with
  backoff; resuming from the last received event id; out-of-order arrival;
  duplicate events; and a stream that goes quiet without closing. Events are
  applied to a reducer keyed by step id so that duplicates are idempotent and
  late arrivals don't overwrite newer state. Write unit tests for the reducer
  against a deliberately hostile event sequence — shuffled, duplicated, gapped.

Cookie auth, sibling-subdomain deployment, per the Phase A contract.

### B2 — Status presentation, reworked

The Phase A finding stands: foreground lightness cannot carry seven states on
this background — the ceiling is ~1.08–1.21:1 adjacent and that is invisible.

Build filled status chips instead. The fill only needs contrast against its own
label, not against the page, which opens the usable range substantially. Each
chip carries fill, icon and text label. Verify:

- Label-on-fill clears AA for every state.
- Chip fill clears 3:1 against the page background (AA non-text).
- Pairwise fill contrast is materially better than the old ladder — measure it
  and record the numbers.
- The widened pairwise test from Phase A is updated to test what chips actually
  use, not the old foreground tokens.

Then the honesty primitives from §1.2 and §1.3: the pass-rate-plus-coverage
pair component, and a result-reason component that renders why something was
skipped or ungrounded.

### B3 — Targets and scan

- Register a target (a URL, a name). Validate the URL client-side; the server
  enforces the real guardrail.
- List targets with their last scan state.
- Trigger a scan; show it progressing through the lifecycle mock's real timing.
- Scan failure is a designed state, not a toast: a site that can't be reached,
  or refuses us, needs a screen that says which and what to do.

### B4 — Inventory inspect

The crawled element inventory, browsable. This screen is where a user finds out
whether the system actually understands their app.

- Elements grouped by page or flow, searchable.
- Each element shows what the system knows: role, label, and — required by the
  Phase A contract — whether it is uniquely locatable.
- **Elements that are not uniquely locatable are surfaced prominently**, because
  those are precisely the ones that will produce unreliable tests. This screen
  earns its keep by making that visible before a test is written, not after it
  fails.
- Empty inventory (a scan that found nothing) is a real, designed state.

### B5 — Compose and plan review

The core interaction, and the product's integrity made visible.

- A plain-English input for what to test.
- The system returns a **proposed plan**: an ordered list of steps, each bound to
  a real element from the inventory.
- **The user sees the plan before anything executes.** They can remove steps,
  reorder them, and cancel. Nothing runs until they say run.
- Every step displays which inventory element it is bound to. A step the system
  could not ground is shown as ungrounded, in place, with the reason — not
  silently dropped from the plan.
- If the proposed plan contains a write action and the account is on the
  read-only tier, that step is shown blocked, with why.

This screen is not a loading spinner around a model call. It is the gate where a
person confirms what a machine proposed. Build it that way.

### B6 — Interactive login handoff

For targets that need authentication: a flow that hands the customer a live
browser session to sign in themselves, waits for them to finish, and confirms
the session was captured.

States: not started, session ready, waiting for the customer, completed,
expired, failed. No password field, no credential storage in our app, nothing
about their credentials in our logs or error messages.

Coordinate with the contract on how session readiness is reported. If it isn't
specified, specify it and say so.

### B7 — Watching a run

- Live step-by-step results over SSE, appearing as they arrive.
- Current step highlighted; completed steps in their real terminal status.
- The four lifecycle scenarios from Phase A all render correctly: clean
  progression, failure partway with a real message, stall then `timed_out`, and
  stream disconnect with recovery.
- A long run doesn't degrade — virtualise the step list if it gets long.
- Cancel, if the contract supports it. If it doesn't, flag that it should.

### B8 — Run result

- Verdict, pass rate **and** coverage, duration, target, timestamp.
- Every step with its status, reason, and screenshot where present. Screenshots
  are session-scoped here and load through the authenticated path.
- Failed steps expand to the detail that makes the failure diagnosable.
- The engine's generated HTML report embeds in a sandboxed iframe per §1.4.
- The action that creates a shareable proof lives here.

### B9 — The proof page

Public, opened cold by someone who did not run the test and may be on a phone.

- **Does not import the app shell.** Its own minimal layout. It has its own tight
  bundle budget — set it now that the route exists, per the Phase C entry
  criterion you added.
- Screenshots use proof-scoped signed URLs. A revoked proof renders nothing —
  verify that, don't assume it.
- Server-rendered, fast, and readable without JavaScript where feasible.
- Shows verdict, pass rate, coverage, steps, timestamp, and what was *not*
  covered. A proof that hides the gaps is not a proof.
- OG image for link previews — and per §1.2, it carries coverage too.
- No authenticated user data leaks onto this page. Check what you're rendering.

### B10 — Verification

Not a checkbox at the end; the thing that makes the rest true.

- Every screen driven in a real browser, every state reached deliberately —
  including the ugly ones. Loading, empty, error, offline, permission-denied,
  and the hostile-content fixture.
- All four lifecycle scenarios exercised end to end through the UI.
- The SSE reducer tested against shuffled, duplicated and gapped event streams.
- Playwright covers the spine: register target → scan → compose → review plan →
  run → result → proof.
- Axe or equivalent on every route, plus a real keyboard-only pass through the
  compose-and-run flow. Automated a11y tooling will not catch a focus trap; you
  have to try it.
- The XSS fixture rendered on every screen that displays scraped text, not just
  the one from Phase A.

---

## 3. Sequencing

B1 and B2 first — everything else depends on them. Then B3/B4 together, then
B5, B6, B7, B8 in order, since each is the previous one's output. B9 can be
built any time after B8's data shape is settled. B10 runs continuously, not at
the end.

Small PRs. One screen per PR where possible. Do not open a single PR containing
the whole console.

---

## 4. What to report back

Per screen: what you built, which states exist, what you drove in a browser.

Specifically:

1. **Contract divergences.** Every place this brief named something your
   `API_CONTRACT.md` doesn't have, or has differently. This is the most valuable
   thing in your report — it's the list of things nobody has checked.
2. **Chip contrast numbers.** Measured, both label-on-fill and fill-on-page,
   pairwise across all states. I will check these.
3. **The SSE reducer's behaviour** under the hostile sequences, with the tests.
4. **Anything in this brief that turned out to be wrong.** You have been right
   about this three times now. Keep doing it.

---

## 5. Stop and ask

- Any contract change that isn't additive — if the UI needs a field that doesn't
  exist, say so rather than inventing an endpoint and building against a fiction.
- Anything that would put a credential anywhere near our UI, API or logs.
- Anything that would render untrusted HTML outside a sandboxed iframe.
- Any pressure to show a pass rate without coverage, including from me.
- If a screen seems to require optimistic status updates to feel responsive:
  stop. That tension is real and the answer is better loading states, not
  guessing at results.

Phase C is suites, history, settings, usage, team and onboarding. Not now.
