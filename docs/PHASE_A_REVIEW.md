# Phase A — Review and Corrections

Read this alongside `docs/PHASE_A.md`. Phase A is accepted with the corrections
below. Do these before starting Phase B. Items marked **BLOCKING** must be
resolved before any product screen is built.

---

## 1. Design tokens — verified, with one defect

### What was verified independently

All twelve claimed contrast ratios were recomputed from the hex values and match
to two decimal places. Every state clears WCAG AA (4.5:1) against both
`blue-deep` and `blue-mid`. Claimed OKLCH hues match measured hues within 2°.
No correction needed to any of those numbers. This part of the work was good.

### A1-FIX-1 — BLOCKING — the six states are isoluminant

Because every state was binary-searched to the same minimum contrast against the
background, they all converged on the same lightness:

| state   | hex       | OKLCH L |
| ------- | --------- | ------- |
| pass    | `#48995d` | 0.616   |
| running | `#0095bc` | 0.623   |
| skipped | `#85889a` | 0.630   |
| queued  | `#998674` | 0.632   |
| fail    | `#db6368` | 0.648   |

Contrast of each state **against the others** is therefore 1.00–1.01:1 for every
pair. Measured colour-vision-deficiency simulation of the pass/fail pair:

| CVD type     | pass renders | fail renders | contrast between them |
| ------------ | ------------ | ------------ | --------------------- |
| deuteranopia | `#88885f`    | `#949463`    | **1.16:1**            |
| protanopia   | `#93935d`    | `#797969`    | 1.38:1                |
| tritanopia   | `#7a7af0`    | `#acac00`    | 1.47:1                |

For roughly 6% of male users, pass and fail are the same colour. In greyscale —
printed reports, screenshots pasted into tickets, which is a normal way this
product's output gets consumed — they are identical for everyone.

This is a WCAG 2.1 **1.4.1 Use of Color** failure, not a stylistic preference.
The brief required AA; AA includes 1.4.1, and contrast-against-background alone
does not satisfy it.

Required fix, all three parts:

1. **Every state gets a non-colour channel.** A distinct glyph per state
   (distinct in _silhouette_, not just colour — do not use six circles in six
   colours), and a text label in the status pill. A state rendered as colour
   alone is a bug anywhere it appears, including tables, charts, timelines, and
   the run summary.
2. **Pull the lightnesses apart.** Re-solve so the states span a meaningful L
   range rather than clustering at ~0.62. Keep AA against both grounds as a
   floor — it is a constraint to satisfy, not a target to optimise to. `pass`
   and `fail` specifically should be the furthest apart pair.
3. **Add a regression test.** Assert minimum pairwise contrast between
   `pass` and `fail` in the token file, so a future token edit cannot silently
   collapse them again.

Record the new measured ratios — both against grounds and pairwise between
states — in `docs/DESIGN_SYSTEM_APP.md`.

### A1-FIX-2 — minor — correct the method section

`docs/DESIGN_SYSTEM_APP.md` describes the derivation as hue rotation with
lightness re-solved for contrast. For `fail` that is not accurate: chroma moved
from gold's 0.0854 to 0.1508, nearly double. That is a defensible choice, but
`queued` and `skipped` disclosed their chroma cuts and `fail` did not. Either
disclose the chroma change per state, or state the method as "hue and chroma
re-derived, lightness solved for contrast." The method section should be true.

### Accepted as reported

- System monospace stack for code/locator/hash rendering. Correct call. The
  two-font rule in `CLAUDE.md` was about display and body type; update that rule
  to say so explicitly so the next person doesn't read it as a violation.
- No light theme. Correct — one brand identity, don't invent a second.

---

## 2. Bundle budget — replace the number with a ratchet

You were right to refuse a fourth guessed number. Don't ask for one.

Replace the fixed budget with:

- **Global ceiling = current measured first-load JS, frozen.** CI fails on any
  increase. A PR that deliberately raises it must say why in the PR body and
  bump the committed number in the same commit. This makes every regression
  visible without pretending we can predict the right figure in advance.
- **One hard per-route budget that does matter:** the public proof page. It is
  opened cold, often on a phone, by people who did not run the test — a
  stakeholder following a shared link. Give it its own tight budget,
  substantially below the app shell's, and enforce it separately. It should not
  be paying for the console's dependencies.
- Leave every other route uncapped for now. Add per-route budgets in Phase C
  when there are real routes with real weights to measure.

---

## 3. The two open decisions — decided

There is no backend team to sign these off. These are now the frontend's
position, written into the contract as requirements. If a backend implementer
later objects, they can counter with a reason; until then these are the spec.

### SSE authentication — cookie, with a deployment constraint

Cookie auth for SSE is correct. But `EventSource` does not send credentials
cross-origin without `withCredentials` plus matching CORS credential headers,
and the architecture guardrail says the browser talks to the backend directly.

So the decision has a constraint attached: **the API must be served from a
sibling subdomain of the app** (e.g. `app.<domain>` and `api.<domain>`, cookie
scoped to the parent domain) so the auth cookie is same-site and `EventSource`
works without special handling.

Write this into `docs/API_CONTRACT.md` as a deployment requirement, not a
suggestion. It is cheap to satisfy if known up front and expensive to retrofit.
Do not solve it by putting a token in the SSE URL.

### Screenshot URLs — two classes, no tokens in URLs

Never place an auth token in a URL. URLs leak via referrer headers, server logs,
browser history, and copy-paste into tickets.

Two classes:

- **Session-scoped screenshots** (inside the authenticated app): served from an
  authenticated endpoint, authorised by the session cookie like any other API
  call.
- **Proof-scoped screenshots** (on a public proof page): the proof token is
  already the capability that grants access to that page. Screenshots on it are
  signed against that same proof token, scoped to that one run, and revoked when
  the proof is revoked. A proof link that still renders after revocation is a
  bug.

Both go in `docs/API_CONTRACT.md` with the authorisation rule stated per
endpoint, so the implementer cannot get it wrong by omission.

---

## 4. Not confirmed in the report — answer explicitly

These were required by the brief and the report did not mention them. Confirm
each with the file path and the passing test, or say it wasn't done:

1. **The stored-XSS fixture.** Does the fixture with
   `<img src=x onerror=alert(1)>` as a page title exist, and is there a passing
   test asserting it renders inert? Give the test name.
2. **`react/no-danger`.** Is it set to `error` (not `warn`), repo-wide, and does
   lint fail the build on it? Paste the rule from the ESLint config.
3. **`contract-drift`.** Does the CI job exist, does it regenerate
   `openapi.json` from the Zod schemas and diff it against the committed file,
   and does it fail the build on a difference? Has it been proven to fail — i.e.
   did you deliberately introduce a drift and watch it go red?

A CI check that has never been seen to fail is not yet a CI check.

---

## 5. MSW — Phase B prerequisite

Handlers-plus-fixtures was the right scope for Phase A. But the console flow is
entirely about state transitions over time — a scan that progresses, a run that
emits step results, states that move queued → running → pass/fail. A mock layer
that returns static payloads cannot exercise any of that, which means the
console would be built against a mock that can't reproduce the only behaviour
that matters.

Build the stateful lifecycle simulation **before** the console, not during it.
It needs to model: scan progressing to completion, run emitting ordered step
events over time, at least one run that fails partway, and at least one that
stalls and times out. The ugly cases are the point — a mock that only produces
happy paths will produce a UI that only handles happy paths.

---

## 6. Accepted without change

- No product screens built. Correct, and the thin route proofs are the right
  shape.
- `middleware.ts` → `proxy.ts`. Verified — the `middleware` file convention is
  deprecated in Next.js 16 and `proxy` is the current convention. Good catch.
- The four browser-only bugs found and fixed. This is the most encouraging part
  of the report: they were only findable by actually driving the app, and
  typechecking would never have surfaced them. Keep doing that — every phase
  should end with the app driven in a real browser, not just built.

---

## 7. Report back

For each item above: what you changed, or why you disagree. Disagreement with a
reason is fine and useful — the isoluminance fix in particular has a design cost
and if you see a better way to satisfy 1.4.1, say so rather than following this
literally.

Do not start Phase B until items marked BLOCKING are resolved and items in §4
are confirmed.
