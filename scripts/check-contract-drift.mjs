#!/usr/bin/env node
/**
 * CI gate: regenerate openapi.json from the Zod schemas and fail if it
 * differs from the committed file. Keeps the spec from ever falling
 * behind the code that backs it.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..");
const committedPath = path.join(repoRoot, "openapi.json");
const scratchDir = mkdtempSync(path.join(tmpdir(), "contract-drift-"));
const generatedPath = path.join(scratchDir, "openapi.json");

const committed = readFileSync(committedPath, "utf8");

execSync(`npx tsx scripts/generate-openapi.ts "${generatedPath}"`, {
  cwd: repoRoot,
  stdio: "inherit",
});
const generated = readFileSync(generatedPath, "utf8");
rmSync(scratchDir, { recursive: true, force: true });

if (committed !== generated) {
  console.error(
    "\nopenapi.json is out of date with the Zod schemas in src/lib/contract/.\n" +
      'Run "npm run generate:openapi" and commit the result.\n',
  );
  process.exit(1);
}

console.log("openapi.json matches the Zod schemas.");
