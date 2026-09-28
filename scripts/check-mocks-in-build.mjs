#!/usr/bin/env node
/**
 * Inspects a production build for the mock layer (docs/PHASE_DEPLOY.md D1,
 * docs/DEV_ONLY_IN_PRODUCTION.md decision 2).
 *
 *   node scripts/check-mocks-in-build.mjs absent   # flag off: none of it ships
 *   node scripts/check-mocks-in-build.mjs present  # flag on: all of it ships
 *
 * "absent" is the guarantee that matters: a build made without
 * NEXT_PUBLIC_API_MOCKING=on must not contain the mock handlers, the mock
 * sign-in path, or the non-httpOnly session cookie code - not merely leave
 * them unused. The mock cookie reaching a real-backend build is the failure
 * this exists to prevent.
 *
 * "present" is the other half: the gate must not be tree-shaken out of a
 * demo build either, or the demo deploys with no mocks and every screen
 * fails (which is what a production build did before D1).
 *
 * It reads what the build actually wrote (.next/static, .next/server, and
 * public/), not the source: a string in a source file proves nothing about
 * the output.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SCANNED = [".next/static", ".next/server"].map((d) => path.join(ROOT, d));
const TEXT_FILE = /\.(js|mjs|cjs|html|rsc|json|txt|body|meta)$/;

/**
 * Each marker is a string only the named part of the mock layer produces.
 * Chosen to be distinctive in minified output (string literals survive
 * minification; identifiers don't).
 */
const MARKERS = [
  // The handlers and their fixtures (src/mocks/handlers, src/mocks/data.ts).
  { part: "mock handlers", text: "run_live_stall_1" },
  { part: "mock handlers", text: "suite_checkout" },
  // MSW's browser runtime: the message it sends its worker to start
  // mocking. (Not "mockServiceWorker.js": the proxy's matcher names that
  // file to exclude it, in every build.)
  { part: "MSW browser runtime", text: "MOCK_ACTIVATE" },
  // The mock sign-in path: the button that stands in for the email link.
  { part: "mock sign-in", text: "Continue to the demo" },
  // The non-httpOnly session cookie (src/mocks/session-cookie-workaround.ts).
  { part: "non-httpOnly mock cookie", text: "demo_user" },
];

const WORKER = path.join(ROOT, "public", "mockServiceWorker.js");

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return TEXT_FILE.test(name) ? [p] : [];
  });
}

const mode = process.argv[2];
if (mode !== "absent" && mode !== "present") {
  console.error("usage: check-mocks-in-build.mjs absent|present");
  process.exit(2);
}
if (!existsSync(path.join(ROOT, ".next", "static"))) {
  console.error('No build output in .next. Run "next build" first.');
  process.exit(2);
}

const output = SCANNED.flatMap(files).map((f) => ({
  rel: path.relative(ROOT, f),
  text: readFileSync(f, "utf8"),
}));

let failed = false;
console.log(`Mock layer in the build output, expected ${mode}:\n`);
for (const { part, text } of MARKERS) {
  const hits = output.filter((f) => f.text.includes(text)).map((f) => f.rel);
  const ok = mode === "absent" ? hits.length === 0 : hits.length > 0;
  failed ||= !ok;
  console.log(
    `  [${ok ? "ok  " : "FAIL"}] ${part}: "${text}" ${
      hits.length ? `in ${hits.length} file(s), e.g. ${hits[0]}` : "not found"
    }`,
  );
}
const workerThere = existsSync(WORKER);
const workerOk = mode === "absent" ? !workerThere : workerThere;
failed ||= !workerOk;
console.log(
  `  [${workerOk ? "ok  " : "FAIL"}] service worker script: public/mockServiceWorker.js ${
    workerThere ? "exists" : "does not exist"
  }`,
);

if (failed) {
  console.error(
    mode === "absent"
      ? "\nThe mock layer reached a build made with mocking off."
      : "\nThe mock layer is missing from a build made with mocking on - the demo would have no backend at all.",
  );
  process.exit(1);
}
console.log(`\nAll ${MARKERS.length + 1} checks passed.`);
