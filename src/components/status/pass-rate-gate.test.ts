// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * "No pass rate for an unfinished run", held as a class rather than per
 * screen: a RUN's pass rate reaches the screen only through RunPassRate,
 * which renders nothing numeric unless the status is terminal and the
 * server sent a value. The runs list once rendered "100% pass" on four
 * running runs by calling PassRateCoverage directly - this keeps any new
 * surface from doing the same.
 *
 * The allowed direct users each have a reason it's safe:
 *   - RunPassRate itself (the gate).
 *   - ProofView: a proof exists only for a finished run; its verdict
 *     vocabulary has no queued/running member (ProofVerdictSchema).
 *   - The style guide: a static specimen, not a run.
 * And no component computes a percentage from pass_rate by hand.
 */

const SRC = path.join(import.meta.dirname, "..", "..");

const ALLOWED_DIRECT_USERS = new Set([
  "components/status/RunPassRate.tsx",
  "components/status/PassRateCoverage.tsx",
  "app/(public)/p/[token]/ProofView.tsx",
  "app/(console)/style-guide/page.tsx",
]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const files = sourceFiles(SRC).map((f) => ({
  rel: path.relative(SRC, f).split(path.sep).join("/"),
  text: fs.readFileSync(f, "utf8"),
}));

describe("a run's pass rate only reaches the screen through RunPassRate", () => {
  it("only the gate, the proof page and the style guide render PassRateCoverage directly", () => {
    const direct = files
      .filter((f) => /<PassRateCoverage\b/.test(f.text))
      .map((f) => f.rel)
      .filter((rel) => !ALLOWED_DIRECT_USERS.has(rel));
    expect(direct).toEqual([]);
  });

  it("every run surface that shows a pass rate goes through the gate", () => {
    const gated = files
      .filter((f) => /<RunPassRate\b/.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(gated).toEqual(
      [
        "app/(console)/(app)/runs/[id]/page.tsx",
        "app/(console)/(app)/runs/page.tsx",
        "app/(public)/_landing/demo.tsx",
      ].sort(),
    );
  });

  it("no component turns pass_rate into a percentage by hand", () => {
    // The OG image renders to a PNG server-side and is fed only a finished
    // proof's snapshot; it's checked separately by its own test below.
    const handRolled = files
      .filter((f) => !f.rel.startsWith("mocks/"))
      .filter((f) => f.rel !== "components/status/PassRateCoverage.tsx")
      .filter((f) => f.rel !== "app/(public)/p/[token]/opengraph-image.tsx")
      .filter((f) => /pass_rate\s*\*\s*100|passRate\s*\*\s*100/.test(f.text))
      .map((f) => f.rel);
    expect(handRolled).toEqual([]);
  });

  it("the OG image only ever renders a proof's (finished) pass rate", () => {
    const og = files.find(
      (f) => f.rel === "app/(public)/p/[token]/opengraph-image.tsx",
    )!;
    expect(og.text).toMatch(/snapshot\.pass_rate/);
    expect(og.text).not.toMatch(/run\.pass_rate|RunSummary|RunDetail/);
  });
});
