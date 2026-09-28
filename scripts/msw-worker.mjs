/**
 * Puts MSW's service worker script in public/ when mocking is on, and
 * removes it when it's off. Called from next.config.ts, which Next loads
 * for every `next dev` and `next build` (bare or via npm), so the file
 * always matches the flag the build is made with.
 *
 * Copied from the installed msw package rather than committed, so the
 * worker can never be a different version from the msw runtime bundled
 * into the page (MSW checks that the two match). docs/DEPLOYMENT.md,
 * "Service worker updates", has the rest of the update strategy.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.join(import.meta.dirname, "..");
const TARGET = path.join(ROOT, "public", "mockServiceWorker.js");

export function syncMswWorker(mocking) {
  if (!mocking) {
    if (existsSync(TARGET)) rmSync(TARGET);
    return;
  }
  const require = createRequire(import.meta.url);
  const source = path.join(
    path.dirname(require.resolve("msw/package.json")),
    "lib",
    "mockServiceWorker.js",
  );
  // Idempotent: Next may load the config more than once per build.
  if (
    !existsSync(TARGET) ||
    readFileSync(TARGET, "utf8") !== readFileSync(source, "utf8")
  ) {
    copyFileSync(source, TARGET);
  }
}
