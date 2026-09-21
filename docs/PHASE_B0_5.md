# B0.5 — Contract Revision and §1.1 Close-out

This is an unplanned step, inserted because the Phase B §4 report found that five
of the seven remaining screens have no contract to build against. Building them
anyway would mean inventing endpoints and then building six screens on top of
fiction.

Do this before B3.

Two parts: close out what's broken in the merged/pending work (§A), then revise
the contract (§B).

---

## A. Close-out — fold into PR #12 before merging

Do not merge #12 as-is. `StatusBadge` currently throws on an unknown status,
which is a crash, and the §1 rules never made it into `CLAUDE.md`.

### A1 — The §1.1 decision: tolerant at the boundary, explicit in display

You asked for this call. Here it is, with the reasoning, because the reasoning
generalises.

**A strict schema that rejects is a schema that hides data.** Right now an
unknown step status makes Zod fail, which makes `useJobEvents` drop the frame,
which makes the step vanish from the UI with no trace in production. That is
strictly worse than the bug this product exists to fix: the engine used to
mislabel a result, and our client silently deletes it. Failing closed is not the
safe option when the product's claim is that nothing is hidden.

So:

- **Status fields parse tolerantly.** Known values map to the enum; an
  unrecognised value resolves to a sentinel carrying the raw string, rather than
  failing the parse. Apply this to step status, run status, job event status and
  `done.status` — the inconsistency between closed enums and bare strings is
  itself a contract bug (see B5 below), but the client must survive either.
- **Never drop a frame because of an unknown status.** Unknown data is displayed
  as unknown. Missing data is not displayed at all, and that is the failure mode
  the rule forbids.
- **`StatusBadge` gains an explicit unrecognised state** — visually distinct,
  carrying the raw value, escaped and truncated. Not a fallback to neutral grey
  that reads like a legitimate state, and never a throw.
- **Loud in development, graceful in production.** An unrecognised status is a
  dev-time console error because it means the contract moved. In production it
  renders.
- **A whole response must not fail to load over one unknown enum value.** An
  unknown run status shows the run with an unrecognised status, not an error page.

Tests: an unknown value at each of the four sites, asserting it renders visibly
and nothing is dropped.

### A2 — The other close-outs

- Add the §1.1–1.5 rules to `CLAUDE.md`. This was in the brief and was skipped.
- Swap `runs/page.tsx` to the `PassRateCoverage` pair component. A pass-rate
  column sitting next to a coverage column is not the pair component, and §1.2
  is enforced structurally or not at all.
- Add a test for the progress ordering guard. It's the one mutation that
  survived, so it's currently unprotected.
- Get `useJobEvents` in front of a real browser. It has never run. jsdom has no
  `EventSource`, so this belongs in Playwright against the mock, not in a unit
  test: assert live arrival, resume via `?since=`, and that a dropped connection
  surfaces as a visible state rather than a frozen one.

### A3 — On the chip numbers

Verified independently; all fourteen match exactly. Two corrections, both in
your favour:

You undersold the result. The pairs that carry meaning improved enormously —
`pass`/`fail` went from 1.00:1 to **3.37:1**, `running`/`fail` from 1.00:1 to
2.75:1. Under deuteranopia (the check you didn't run — I ran it), `pass`/`fail`
is **2.97:1**, up from 1.16:1 in the old foreground scheme. Chips worked.

Your sixth-root analysis is correct and mine was the overclaim: a 3.37× wider
span over six steps buys only ~22% per step, so adjacent pairs land at 1.21–1.24
no matter how the range widens. But adjacent pairs are the wrong thing to
optimise. `skipped` vs `warning` at 1.21:1 is fine — nobody confuses those at a
glance, and icon and label carry it. The distinctions that matter are far apart
now. Record the CVD figures in the design doc and consider this closed.

---

## B. Contract revision

The contract was written in Phase A from the engine's shape, before any screen
existed. Five screens now have no contract. Revise it once, deliberately, rather
than discovering each gap mid-screen.

Output: an updated `openapi.json` and `API_CONTRACT.md`, with every change
marked as **required**, and a short rationale per change aimed at whoever
implements the backend. This document is the thing that eventually gets handed
to a backend team, so write it for them.

### B1 — Step identity

Steps have only `index`. Add a stable `id`, unique within a run and not derived
from position. Reason: the reducer must key on something that survives
re-indexing; keying on `index` means a re-indexed run can merge two distinct
steps into one. Keep `index` for display ordering.

### B2 — Event ordering

The contract says event ids are "monotonically increasing" but not that they are
numeric, and the client currently assumes numeric strings and treats an
unparseable id as newest — failing open in the worst direction.

Pick one and specify it exactly: either a numeric monotonic sequence, or a
lexicographically-sortable id (ULID). State which, state that comparison is
total, and make the client comparison match. An ambiguous ordering key in an
event stream is a silent-corruption bug waiting for a different backend.

### B3 — Heartbeat

There is currently no way to distinguish a legitimately stalled run from a dead
connection. Your call to expose `lastEventAt` rather than reconnect on quiet was
the right judgment, but it's a workaround for a missing contract feature.

Specify a periodic heartbeat event on the stream with a stated interval, so
"nothing has happened for 30s" and "the connection died" are distinguishable
facts rather than an inference. Then the UI can say which, which §1.1 requires.

### B4 — Scan state and failure detail

- `Target` has no scan-state field and there is no scan list endpoint, so
  "targets with their last scan state" is unanswerable. Add either a
  `last_scan` summary on `Target` or a list endpoint — prefer the summary, since
  the list view needs one round trip, not N.
- `Scan.status: failed` carries no reason. Add a structured failure kind
  (unreachable, refused, timeout, blocked-by-guardrail, internal) plus a
  human-readable message. A screen that says "scan failed" and nothing else is
  not a product; the kind is what determines what the user does next.

### B5 — Status enum consistency

`JobEvent.status` and `done.status` are bare strings while `Step` and run
statuses are closed enums. Same concept, two representations. Unify them on one
enum, and state in the contract that clients must tolerate unknown members —
which is what makes A1 correct rather than defensive.

### B6 — Element role

The brief asked for "role, label"; `Element` has `locator_strategy` (which can
be `"role"`), which is a different thing — how we find it, not what it is. Add
the element's actual semantic role. B4's screen is about whether the system
understands the app, and the strategy used to locate something doesn't answer
that.

### B7 — The compose and plan surface (largest gap)

There is no compose endpoint, no plan object, no approve/remove/reorder, and no
tier or read-only concept. This is the product's differentiator — the gate where
a person sees what a machine proposed before it executes — and it has no API at
all.

Specify at minimum:

- Submit a plain-English intent against a target, returning a **plan**.
- A plan is an ordered list of steps, each either bound to a specific inventory
  element, or explicitly **ungrounded with a reason**. Ungrounded steps are part
  of the plan object, not omitted from it — the UI must show them.
- Each step declares whether it is a read or a write action.
- The plan is approved, with edits (removals, reordering), and the approved plan
  is what executes. A run references the plan it came from.
- An account tier or capability flag the UI can read to know whether write steps
  are permitted.

Design note worth stating in the contract: the plan must be inspectable _before_
execution and immutable _after_ approval. That is what makes the audit claim
true — a proof that can't say what was approved isn't a proof.

### B8 — Interactive login

Workspace states are `booting/ready/resetting/error/terminated`, which describe
the workspace, not the customer's sign-in. There is no session-ready or expired
state and no way to hand the customer a live browser session.

Specify the login-session resource: how it is created, how the customer reaches
it, how readiness and expiry are reported, and how the captured session is
referenced by a later run. No credential ever traverses our API — the contract
should say so explicitly, so an implementer doesn't add a convenience field.

### B9 — The engine's HTML report

No field or endpoint exposes it. Add one, and state its authorisation class
(session-scoped) and that it is untrusted content intended for sandboxed
rendering. If the contract doesn't say it's untrusted, someone will eventually
render it inline.

### B10 — Proof self-containment (most serious)

`Proof` has no `pass_rate`, `coverage`, `verdict` or `target`, and the public
page can't fetch the run because that needs auth. As specified, the proof page
cannot show what §1.2 requires, and cannot show what wasn't covered.

The fix is not "add a link to the run." **A proof must carry a frozen snapshot
of the result it attests to** — verdict, pass rate, coverage (both numerator and
denominator), target, timestamp, the step list with statuses and reasons, and
references to proof-scoped screenshots. Two reasons, both structural:

1. A proof that reads through to live data isn't a proof. Re-run the test and
   the "proof" silently changes. The whole value is that it attests to one
   moment.
2. The public page has no credentials, and giving it a path to authenticated
   data to work around that is how a data leak gets built.

Make the snapshot immutable at creation and revocable as a whole.

---

## C. Report back

- The revised `openapi.json` and `API_CONTRACT.md`, with each change marked
  required and briefly justified.
- Anything in §B you think is wrong, over-specified, or expensive to implement.
  You are the one who has read the contract end to end; I have not. If something
  here would be painful for a backend to build, say so now — the point of this
  document is to be implementable, not complete.
- Which screens are unblocked once it lands, and which still aren't.
- Confirmation of each A-item, with the tests.

Do not start B3 until the contract revision is committed. After that, B3 → B9
proceed as written in `docs/PHASE_B.md`, one screen per PR.

One correction to that brief: it cites `PHASE_A_REVIEW.md`; the file is
`phase-a-review.md`. My error, third time on filenames. Rename the file to
`PHASE_A_REVIEW.md` so the docs match each other.
