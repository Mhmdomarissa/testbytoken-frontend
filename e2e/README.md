# e2e notes

## Known flakes

### "You're offline. Reconnecting…" in the failure snapshot

**Symptom:** a test times out waiting for server data that never arrives (a
scan's failure panel, a plan's steps), and the page snapshot in
`test-results/…/error-context.md` shows the banner **"You're offline.
Reconnecting…"**.

**Cause:** the browser reported itself offline (`navigator.onLine === false`)
for a moment, most likely because the machine's network dropped. React
Query's default `networkMode: "online"` pauses every fetch while the browser
is offline, and `OfflineBanner` says so. That is the intended product
behaviour, not a bug. No test takes the browser offline, so the trigger is
outside the suite.

**Evidence (2026-09-24):** in three full local passes (291 runs), 2 tests
failed 31 s apart, `targets.spec.ts:152` (timeout scan) and
`xss-safety.spec.ts:51`. Both snapshots show the banner. A scratch test that
calls `context.setOffline(true)` mid-scan reproduces the same failure
exactly, and the panel appears as soon as the browser is back online.

**If it shows up in CI** rather than on a local machine, raise it again. A
CI runner shouldn't lose its network, so that would point somewhere else.
