#!/usr/bin/env node
/**
 * Post-build guard for the zod locale-trim workaround
 * (scripts/zod-locale-trim-loader.cjs): the production client bundle must
 * still contain zod's ENGLISH default messages and must NOT contain another
 * locale's. Fails if the trim silently stopped working (bundle grows -
 * the byte budget would also notice) or if it went too far (no English).
 * Delete together with the loader.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const STATIC_DIR = path.join(import.meta.dirname, "..", ".next", "static");
if (!existsSync(STATIC_DIR)) {
  console.error(`No build output at ${STATIC_DIR}. Run "next build" first.`);
  process.exit(1);
}

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* jsFiles(p);
    else if (p.endsWith(".js")) yield p;
  }
}

const ENGLISH = "Invalid input: expected";
const OTHER_LOCALES = [
  "Ungültige Eingabe",
  "Entrada inválida",
  "Entrée invalide",
];

let english = false;
const leaked = new Set();
for (const file of jsFiles(STATIC_DIR)) {
  const text = readFileSync(file, "utf8");
  if (text.includes(ENGLISH)) english = true;
  for (const phrase of OTHER_LOCALES)
    if (text.includes(phrase)) leaked.add(phrase);
}

let failed = false;
if (!english) {
  console.error(
    `zod trim went too far: "${ENGLISH}" (English default messages) is not in the bundle.`,
  );
  failed = true;
}
if (leaked.size > 0) {
  console.error(
    `zod trim is not in effect: other locales are in the bundle (${[...leaked].join(", ")}). Turbopack fixed upstream? Or the loader stopped matching.`,
  );
  failed = true;
}
if (failed) process.exit(1);
console.log("zod trim OK - English messages present, other locales absent.");
