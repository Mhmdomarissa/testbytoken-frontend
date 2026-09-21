#!/usr/bin/env node
/**
 * Bundle budget gate for CI - a per-route RATCHET, not a fixed number.
 *
 * Next.js 16 removed the "First Load JS" column from `next build` output
 * (the team found it unreliable for RSC architectures - see the "Removed
 * metrics" section of the v16 upgrade guide). There is no first-party
 * equivalent to check against a budget, so this script reconstructs the
 * same figure from build artifacts: for each app route it unions the
 * route's own entry chunks (from `page_client-reference-manifest.js`
 * `entryJSFiles`) with the shared runtime/polyfill chunks every route
 * loads (from that route's `build-manifest.json`), gzips each chunk once,
 * and sums the unique files. This is the same computation Next itself used
 * to run internally; it is an approximation, not an official metric.
 *
 * It parses the Turbopack manifest shape (`entryJSFiles`) specifically -
 * Turbopack is Next 16's default and recommended builder for both `next dev`
 * and `next build`. A `next build --webpack` output uses a different
 * manifest shape and will not parse here.
 *
 * HISTORY - why this is a ratchet and not a fixed number: this script used
 * to enforce a single guessed KB-per-route ceiling. That number moved four
 * times (150 -> 220 -> 300 -> 460 KB) across Phase A as more of the real
 * app came into existence, each time invalidated by the next real
 * measurement - a strong signal that guessing the "right" number in
 * advance doesn't work here. Per the Phase A review (§2): replace the
 * guess with a ratchet. `bundle-budget-baseline.json` (committed) records
 * each route's own current measured size as ITS ceiling. This script fails
 * if any route's build now exceeds ITS OWN recorded baseline - every
 * regression is visible, and nothing is ever compared to another route's
 * number or to a guessed target.
 *
 * A route with no baseline entry (new route) also fails, deliberately -
 * run `node scripts/check-bundle-budget.mjs --write` to measure it and add
 * it to the baseline, and say why in the PR body if you're deliberately
 * accepting a larger number for an existing route (the baseline diff makes
 * the size of that decision visible in review).
 *
 * PUBLIC PROOF PAGE: the review calls for a separate, tight budget for the
 * public proof page (`/p/[token]`) specifically, well below the app
 * shell's cost - it's opened cold, often on a phone, by someone who didn't
 * run the test. That route doesn't exist yet (Phase A built no product
 * screens), so there is nothing to measure and no honest number to write
 * here - see PUBLIC_ROUTE_BUDGET_BYTES below. Set it for real, from a real
 * measurement, when that route is built; don't invent a number now.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const NEXT_DIR = path.join(REPO_ROOT, ".next");
const APP_DIR = path.join(NEXT_DIR, "server", "app");
const BASELINE_PATH = path.join(
  import.meta.dirname,
  "bundle-budget-baseline.json",
);

/**
 * Deliberately tight cap for any public, unauthenticated proof route
 * (path starting with "/p/"), enforced separately from - and well below -
 * the ratcheted app-shell baselines below. NOT SET: there is no such
 * route yet to measure honestly. When one exists, measure it, then set
 * this to a real, deliberately tight number and explain the choice here.
 */
const PUBLIC_ROUTE_PREFIX = "/p/";
const PUBLIC_ROUTE_BUDGET_BYTES = null;

/**
 * Measured, not guessed (pre-Phase-B review, item 4). This was 8 KB, a
 * hedge added when CI (Ubuntu, a floating Node minor version) first
 * failed every route by +0.4-2.2 KB against a baseline written locally
 * (macOS, a specific Node patch). A follow-up PR pinned CI to that exact
 * same .nvmrc version, which raised the question: was Node-version drift
 * the actual cause, making this tolerance redundant? Tested directly by
 * setting it to 0 and pushing - CI run 35565089141 still failed every
 * route, by +0.4 to +1.7 KB, always CI-higher than local, never lower.
 * That rules out Node-version float as the cause (it's now pinned
 * identically on both sides) and confirms this is genuine macOS/Ubuntu
 * build non-determinism (not root-caused further - plausibly the native
 * zlib linked into each platform's Node binary producing slightly
 * different gzip output for identical input, or filesystem
 * directory-iteration order affecting Turbopack's chunk concatenation).
 * 4 KB is ~2.3x the largest single-route drift actually observed
 * (1.7 KB on /runs) - enough margin to absorb this specific noise
 * without hiding a real regression, which for an added dependency or
 * component is easily an order of magnitude bigger than 4 KB.
 */
const TOLERANCE_BYTES = 4 * 1024;

const WRITE_MODE = process.argv.includes("--write");

if (!existsSync(APP_DIR)) {
  console.error(`No build output found at ${APP_DIR}. Run "next build" first.`);
  process.exit(1);
}

async function findClientReferenceManifests(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findClientReferenceManifests(full)));
    } else if (entry.name === "page_client-reference-manifest.js") {
      found.push(full);
    }
  }
  return found;
}

function routeNameFor(manifestFile) {
  const routeDir = path.dirname(path.relative(APP_DIR, manifestFile));
  // Route groups (parenthesized segments, e.g. "(app)") don't appear in
  // the actual URL - strip them so the report shows the real route.
  const segments = routeDir.split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
  const cleaned = segments.join("/");
  return cleaned === "" || cleaned === "." ? "/" : `/${cleaned}`;
}

function parseEntryJSFiles(manifestFile) {
  const source = readFileSync(manifestFile, "utf8");
  const match = source.match(
    /globalThis\.__RSC_MANIFEST\["[^"]+"\]\s*=\s*(\{[\s\S]*\});?\s*$/,
  );
  if (!match) {
    throw new Error(`Could not parse RSC manifest: ${manifestFile}`);
  }
  const manifest = JSON.parse(match[1]);
  const files = new Set();
  for (const chunkList of Object.values(manifest.entryJSFiles ?? {})) {
    for (const file of chunkList) files.add(file);
  }
  return files;
}

function parseSharedFiles(routeDir) {
  const buildManifestPath = path.join(routeDir, "page", "build-manifest.json");
  if (!existsSync(buildManifestPath)) return new Set();
  const manifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
  return new Set([
    ...(manifest.rootMainFiles ?? []),
    ...(manifest.polyfillFiles ?? []),
  ]);
}

function gzippedSize(relativeFile) {
  const absolute = path.join(NEXT_DIR, relativeFile);
  if (!existsSync(absolute)) return 0;
  return gzipSync(readFileSync(absolute)).length;
}

const manifests = await findClientReferenceManifests(APP_DIR);
const results = [];

for (const manifestFile of manifests) {
  const route = routeNameFor(manifestFile);
  if (route === "/_global-error") continue;

  const routeDir = path.dirname(manifestFile);
  const files = new Set([
    ...parseEntryJSFiles(manifestFile),
    ...parseSharedFiles(routeDir),
  ]);

  const totalBytes = [...files].reduce(
    (sum, file) => sum + gzippedSize(file),
    0,
  );
  results.push({ route, totalBytes, fileCount: files.size });
}

results.sort((a, b) => a.route.localeCompare(b.route));

if (WRITE_MODE) {
  const baseline = Object.fromEntries(
    results.map((r) => [r.route, r.totalBytes]),
  );
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`Wrote ${BASELINE_PATH} with ${results.length} routes:\n`);
  for (const { route, totalBytes } of results) {
    console.log(`  ${route.padEnd(24)} ${(totalBytes / 1024).toFixed(1)} KB`);
  }
  console.log(
    "\nCommit this file. If any number here is a deliberate increase over",
  );
  console.log("what was previously committed, say why in the PR body.");
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : {};

let failed = false;
console.log(
  "Bundle budget: per-route ratchet against bundle-budget-baseline.json\n",
);

for (const { route, totalBytes, fileCount } of results) {
  const kb = (totalBytes / 1024).toFixed(1);
  const isPublicProof = route.startsWith(PUBLIC_ROUTE_PREFIX);
  const ceiling = isPublicProof ? PUBLIC_ROUTE_BUDGET_BYTES : baseline[route];

  if (isPublicProof && ceiling === null) {
    console.log(
      `  [WARN] ${route.padEnd(24)} ${kb.padStart(8)} KB  - public proof route with no set budget yet; see PUBLIC_ROUTE_BUDGET_BYTES`,
    );
    continue;
  }

  if (ceiling === undefined) {
    console.error(
      `  [FAIL] ${route.padEnd(24)} ${kb.padStart(8)} KB  - no baseline entry. Run with --write to add it.`,
    );
    failed = true;
    continue;
  }

  const over = totalBytes > ceiling + TOLERANCE_BYTES;
  if (over) failed = true;
  const marker = over ? "FAIL" : "ok  ";
  const ceilingKb = (ceiling / 1024).toFixed(1);
  console.log(
    `  [${marker}] ${route.padEnd(24)} ${kb.padStart(8)} KB  (baseline ${ceilingKb} KB ±${(TOLERANCE_BYTES / 1024).toFixed(0)} KB, ${fileCount} files)`,
  );
}

if (failed) {
  console.error(
    "\nOne or more routes exceed their baseline, or have no baseline yet.\n" +
      "If this is a deliberate increase: run with --write, commit the updated\n" +
      "bundle-budget-baseline.json, and explain why in the PR body.",
  );
  process.exit(1);
}

console.log("\nAll routes at or under their baseline.");
