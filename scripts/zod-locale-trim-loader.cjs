/**
 * TEMPORARY WORKAROUND - added 2026-09-21 (Next 16.3.5, zod 4.6.5).
 * Delete when Turbopack tree-shakes namespace re-exports.
 *
 * What it is for: `import { z } from "zod"` drags ALL ~63 of zod's locale
 * files (190 KB raw, ~45 KB gzip on every console route) into the client
 * bundle, because zod re-exports them as `export * as locales` from
 * `v4/classic/external.js` and `v4/core/index.js` and Turbopack does not
 * shake namespace re-exports. We only ever use English, which zod pulls in
 * on its own from `v4/classic/schemas.js` - that import is NOT touched, so
 * default validation messages are still English (e2e/zod-messages.spec.ts
 * and scripts/check-zod-trim.mjs both assert it).
 *
 * It also drops `toJSONSchema` / `fromJSONSchema` (~50 KB raw) which the
 * client never calls; OpenAPI generation runs in Node (tsx) on untouched
 * zod, not through Turbopack.
 *
 * Upstream, tracked:
 *   - Next.js https://github.com/vercel/next.js/issues/88643 (Turbopack)
 *   - zod     https://github.com/colinhacks/zod/issues/6050
 *
 * It edits third-party source by pattern, so it FAILS THE BUILD LOUDLY if a
 * pattern is not found (a zod upgrade moved the lines): the answer is then
 * to re-check whether upstream fixed it and delete this, not to loosen it.
 * CLAUDE.md ("Workarounds with an expiry") says to re-check on every zod or
 * Next upgrade.
 */
const LOCALES = /^export \* as locales from .*\n/m;
const TO_JSON_SCHEMA = /^export \{ toJSONSchema \} from .*\n/m;
const FROM_JSON_SCHEMA = /^export \{ fromJSONSchema \} from .*\n/m;

/** Which lines to remove from which zod file. Exported for the test. */
function patternsFor(file) {
  const normalised = file.replace(/\\/g, "/");
  if (normalised.endsWith("/zod/v4/classic/external.js"))
    return [LOCALES, TO_JSON_SCHEMA, FROM_JSON_SCHEMA];
  if (normalised.endsWith("/zod/v4/core/index.js")) return [LOCALES];
  return null;
}

function trim(source, file) {
  const patterns = patternsFor(file);
  if (patterns === null) {
    throw new Error(
      `zod-locale-trim-loader: applied to an unexpected file ${file}. ` +
        "Fix the rule's path condition in next.config.ts.",
    );
  }
  let out = String(source);
  for (const pattern of patterns) {
    if (!pattern.test(out)) {
      throw new Error(
        `zod-locale-trim-loader: expected line ${pattern} not found in ${file}. ` +
          "zod changed - check whether Next/zod fixed the locale tree-shaking " +
          "(vercel/next.js#88643, colinhacks/zod#6050) and delete this loader " +
          "if so; otherwise update the patterns and re-measure.",
      );
    }
    out = out.replace(pattern, "");
  }
  return out;
}

module.exports = function zodLocaleTrimLoader(source) {
  return trim(source, this.resourcePath);
};
module.exports.trim = trim;
