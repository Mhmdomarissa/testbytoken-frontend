#!/usr/bin/env node
/**
 * Bundle budget gate for CI.
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
 * PROVISIONAL BUDGET: on this Next 16 + Turbopack + React 19 baseline, a
 * completely empty route cost ~186 KB gzipped before shadcn/Base UI existed
 * (A1). The brief's original 150 KB/route figure is below that floor and
 * would fail on every route unconditionally.
 *
 * A4 added `TooltipProvider` and `Toaster` at the root layout, so every
 * route - not just ones using tooltips/toasts - now pays for that JS too.
 * That moved the real floor to ~253 KB (measured on `/_not-found`, which
 * imports none of the themed components). 300 KB is set here as
 * floor-plus-headroom for actual per-route component usage, still a
 * placeholder pending sign-off - see the Phase A report. Change this
 * constant once a real number is agreed.
 */
import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const BUDGET_BYTES = 300 * 1024; // provisional - see comment above
const NEXT_DIR = path.join(process.cwd(), ".next");
const APP_DIR = path.join(NEXT_DIR, "server", "app");

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
  return routeDir === "." ? "/" : `/${routeDir}`;
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

let failed = false;
console.log(
  `Bundle budget: ${(BUDGET_BYTES / 1024).toFixed(0)} KB gzipped per route\n`,
);
for (const { route, totalBytes, fileCount } of results) {
  const kb = (totalBytes / 1024).toFixed(1);
  const over = totalBytes > BUDGET_BYTES;
  if (over) failed = true;
  const marker = over ? "FAIL" : "ok  ";
  console.log(
    `  [${marker}] ${route.padEnd(24)} ${kb.padStart(8)} KB  (${fileCount} files)`,
  );
}

if (failed) {
  console.error("\nOne or more routes exceed the bundle budget.");
  process.exit(1);
}

console.log("\nAll routes within budget.");
