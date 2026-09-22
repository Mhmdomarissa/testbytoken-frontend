# Landing Page and Polish Pass

Two pieces of work. **L** builds a public landing page. **P** is a craft pass
over the product screens. Do L first; it's additive and isolated. P touches
screens that already work, so it carries more risk and gets its own PRs.

Suggested order: L → deploy (`docs/PHASE_DEPLOY.md`) → P. Once the deploy is
live, every PR gets a preview URL, which makes reviewing a visual pass far
easier than running it locally each time.

---

## 0. The source file, and what it is and isn't authoritative for

`index.html` (attached separately to the repo) is a standalone static page with
inline CSS and a small vanilla-JS block. Read it directly — it is the spec.

**It is the source of truth for:** copy (exactly, word for word — do not
paraphrase or "improve" it), section order and structure, layout proportions,
the interaction vocabulary (eyebrow labels, hover treatments, ghost-outline
buttons, quick-pick buttons), and the information architecture.

**It is NOT the source of truth for:** colour, typography, motion, or anything
else visual. Those come from this project's existing design system. See §L1.

---

## 1. Rules that do not bend

Everything already in `CLAUDE.md` still applies. These are the ones this
particular work is most likely to break:

**The design system is the app's, not the source file's.** The source uses
ink-on-white with a yellow accent and Montserrat alone. This product is
`blue-deep`/`gold`, Cormorant Garamond plus Montserrat, dark only. A visitor
must not be able to tell where the marketing page ends and the product begins.
Zero border-radius throughout — that's shared between both and stays.

**No pass rate without coverage.** The source's report card shows
`steps_passed / steps_total` and nothing else. That is precisely the number this
product exists to not show. Any result rendered anywhere on the landing page
uses `PassRateCoverage`, same as everywhere else. There is no marketing
exemption from this rule.

**No new styling system.** Use whatever this project already uses. Do not
introduce a second one alongside it.

**Do not copy the source's global resets.** `*`, `html`, `body`, `a`, `button`
selectors are safe in a standalone file and would bleed into every existing page
here. Scope all of this page's styles to this page.

**Bundle ratchet applies.** New routes need baselines from CI bytes. If a route
already has a committed baseline and this work changes it, that's a deliberate
rise to be justified, not a number to quietly refresh.

**Accessibility is not negotiable for polish.** Every measured contrast ratio
stays measured. Status stays icon-plus-label, never colour alone. The
route-change focus work from B10 must not regress — the test from
`focus-on-navigation.spec.ts` must still pass, and any new route must be covered
by it.

**`prefers-reduced-motion` is respected everywhere.** Any motion added in P has
a reduced-motion path that is not merely "slightly faster."

---

# Part L — The landing page

### L1 — Translate, don't transplant

Build the page's structure, copy and interaction patterns from `index.html`;
render all of it in this app's design language.

The mapping to work out deliberately (and to write down in the PR):

- The source's yellow accent carries emphasis, hover states and the eyebrow
  rules. `gold` is this app's equivalent. Check the contrast of every use.
- The source is light-first. This app is dark-only. Do not add a light theme,
  and do not add a theme toggle.
- Headings in the source are uppercase Montserrat. This app has Cormorant
  Garamond for display type. Decide where each font belongs and say why —
  this is the main judgment call in L, and it's the one that decides whether
  the page reads as the same product.
- Keep the eyebrow motif (small rule plus tracked-out uppercase label). It's a
  strong recurring device and it already suits this brand.

### L2 — Where it lives

- `/` — the landing page becomes the homepage. It is public and unauthenticated.
- It cannot go in `(console)`; that group carries the providers. Put it where the
  structural test permits and where it pays the least. If the existing
  `(public)` tier fits, use it. If it needs its own, say so and why.
- The existing structural test must cover it. If it doesn't automatically, extend
  the test rather than exempting the route.
- Signed-in visitors hitting `/` should reach the console, not the marketing
  page. Confirm what currently happens and handle it deliberately.

### L3 — The hero launcher

The source's launcher posts to a `/plan` and `/run` endpoint belonging to a
different backend, with a response shape this project's contract does not use.
Do not reproduce that.

**Wire it to the existing mock, through the real contract and the real data
layer** — the same client, schemas and components the console uses. A visitor
types a URL and an intent, and watches a real (mocked) test run, on the landing
page. That is this product's original pitch and it is the most compelling thing
that can be on this page.

Conditions:

- It uses `PassRateCoverage` and the real status chips. No bespoke result
  rendering.
- Everything it displays came from the mock. Nothing is invented client-side.
- Read-only. The landing page cannot trigger a write action, by construction.
- The input is untrusted and rendered back to the user. Same hostile-content
  rules as everywhere else.
- It is visibly a demonstration. The deploy brief requires a demo banner; make
  sure the launcher reads as consistent with that rather than contradicting it.

If wiring it properly turns out to be more than a contained piece of work, stop
and report rather than stubbing it silently.

### L4 — Responsive

The source has no breakpoints at all — fixed hero height, fixed four-column
grids. Add real ones. Phone first for the hero and the launcher, since that's
where this link will most often be opened.

### L5 — Images

External Unsplash URLs. Add the host to `remotePatterns` rather than vendoring
them. Check every image has meaningful `alt` text, and that none of them carry
a real company, client or product name.

---

# Part P — Polish pass

Craft, not redesign. Every screen already works and every rule it follows was
hard-won. The goal is that using it feels considered, not that it looks
different.

**One screen per PR.** If a PR changes what a screen *says* or *reports* rather
than how it feels, it has gone too far.

### P1 — Motion, used sparingly and for meaning

`CLAUDE.md` says minimal motion. That rule stays for decoration and relaxes for
meaning. Motion that shows a state changing is information; motion that exists to
look modern is noise.

Worth doing:

- **Steps arriving during a live run.** This is the screen where the product is
  most obviously doing something, and where nothing currently conveys that.
- **The plan appearing after compose.** The emotional peak of the product — a
  machine just proposed something and a person is about to judge it. It should
  land, not blink into existence.
- **Status transitions** — queued → running → terminal. A chip changing state
  should be legible as a change.
- **Skeleton to content**, so loading resolves rather than swaps.

**CSS transitions and animations only. Do not add an animation library.** The
bundle ratchet is not negotiable and a motion dependency would eat it in one
commit. Every motion respects `prefers-reduced-motion`.

### P2 — Interaction states

Every interactive element should have a deliberate rest, hover, active, focus
and disabled state. Focus states in particular must be visible and attractive
rather than the browser default — they're load-bearing here given the keyboard
work in B10, and they're currently the least-designed thing in the app.

### P3 — Empty, loading and error states

These are the first thing a new user sees and they're usually the last thing
anyone designs. A new account has no targets, no runs, no suites. Those screens
should explain what to do next, not just report that there's nothing.

Same for errors: a failed scan already says which kind of failure it was — make
the screen help the person act on that.

### P4 — Rhythm and hierarchy

Consistent application of the spacing scale. Clear typographic hierarchy on
dense screens — the inventory and run-detail views carry the most information
and are the most likely to read as undifferentiated. Nothing here should require
new tokens; if it does, that's a signal the existing scale has a gap worth
discussing rather than working around.

### P5 — The two screens that matter most

If time is limited, spend it on **compose/plan-review** and **run-watch**. Those
are what get demonstrated, and they're where the product's claims are visible.
The rest can be merely clean.

---

## Report back

For L: the font and colour mapping decisions and why; where the route lives and
how the structural test covers it; what the launcher is wired to and what it
renders; bundle numbers from CI.

For P, per PR: what changed, what it looks like before and after, confirmation
that contrast, focus and reduced-motion still hold, and the bundle delta.

For both: anything in this brief that turned out to be wrong.

## Stop and ask

- Before adding any dependency, especially for motion.
- If the landing page's design can't be reconciled with the app's tokens without
  changing the tokens.
- If any polish change would require weakening an accessibility guarantee or an
  honesty primitive. It won't — but if it looks like it does, that's a
  conversation, not a judgment call.
