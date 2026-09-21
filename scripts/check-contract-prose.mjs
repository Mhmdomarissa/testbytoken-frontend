#!/usr/bin/env node
/**
 * Fails if any of the contract's OpenAPI prose is present in the built
 * client bundle.
 *
 * The contract's descriptions are written for the backend team (rationale,
 * cost notes, MUST/SHOULD language). They live next to the fields they
 * document so they can't drift from them, and they are stripped from every
 * bundle at build time by scripts/openapi-strip-loader.cjs, so a page that
 * imports a schema doesn't ship a paragraph about how the engine should
 * implement it. Measured before the strip: ~5 KB gzip on EVERY route,
 * including the public proof page, which is opened cold on a phone.
 *
 * This check is what makes that structural rather than hoped-for: it takes
 * every description out of the COMMITTED openapi.json and asserts none of
 * them appears in .next/static. New prose is covered automatically - if a
 * future edit defeats the loader (a new pattern it doesn't understand),
 * this fails on the PR that did it, instead of the bundle quietly growing.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const STATIC_DIR = path.join(ROOT, ".next", "static");
const MIN_LENGTH = 40; // shorter descriptions ("Not found.") can legitimately coincide with UI strings

if (!existsSync(STATIC_DIR)) {
  console.error(`No build output at ${STATIC_DIR}. Run "next build" first.`);
  process.exit(1);
}

const descriptions = new Set();
(function collect(node) {
  if (Array.isArray(node)) return node.forEach(collect);
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (
        key === "description" &&
        typeof value === "string" &&
        value.length >= MIN_LENGTH
      ) {
        descriptions.add(value);
      } else collect(value);
    }
  }
})(JSON.parse(readFileSync(path.join(ROOT, "openapi.json"), "utf8")));

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* jsFiles(full);
    else if (name.endsWith(".js")) yield full;
  }
}

// A description can be split across string-concatenation fragments in
// source, but the bundle holds the JOINED string or nothing. Match on a
// distinctive prefix + suffix so escaping/quote-style can't hide it.
const probes = [...descriptions].map((d) => ({
  d,
  head: d.slice(0, 30),
  tail: d.slice(-30),
}));

const leaked = new Map();
for (const file of jsFiles(STATIC_DIR)) {
  const text = readFileSync(file, "utf8");
  for (const { d, head, tail } of probes) {
    if (text.includes(head) || text.includes(tail)) {
      leaked.set(d, path.relative(ROOT, file));
    }
  }
}

console.log(
  `Contract prose in the client bundle: checked ${probes.length} descriptions from openapi.json against ${STATIC_DIR}\n`,
);
if (leaked.size > 0) {
  console.error(
    `FAIL - ${leaked.size} description(s) are shipping to the browser:\n`,
  );
  for (const [d, file] of [...leaked].slice(0, 8)) {
    console.error(`  in ${file}:\n    "${d.slice(0, 90)}..."\n`);
  }
  if (leaked.size > 8) console.error(`  ...and ${leaked.size - 8} more.`);
  console.error(
    "\nThe strip loader (scripts/openapi-strip-loader.cjs) didn't remove these. " +
      "Either a new pattern needs teaching to it, or it isn't being applied (next.config.ts).",
  );
  process.exit(1);
}
console.log("OK - none of it ships.");
