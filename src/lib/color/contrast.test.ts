import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio } from "./contrast";

/**
 * Regression test for the Phase A review's A1-FIX-1 (BLOCKING): every
 * status foreground was independently binary-searched to the minimum
 * lightness clearing AA, so they converged within 0.03 of each other and
 * became ~1.0:1 against one another - a WCAG 1.4.1 failure (pass and fail
 * were the same color for ~6% of male users, and identical in
 * greyscale). Parses the actual committed styles/tokens.css - not a
 * hardcoded copy of the hex values - so a future edit that quietly
 * re-clusters the lightnesses fails this test, not just a design review.
 */

const tokensPath = path.join(import.meta.dirname, "../../../styles/tokens.css");
const tokensCss = readFileSync(tokensPath, "utf8");

function tokenHex(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1])
    throw new Error(`Token --${name} not found in styles/tokens.css`);
  return match[1];
}

const BLUE_DEEP = tokenHex("color-blue-deep");
const BLUE_MID = tokenHex("color-blue-mid");
const STATUSES = ["pass", "fail", "running", "queued", "skipped"] as const;

describe("status color tokens", () => {
  it.each(STATUSES)(
    "%s foreground still clears AA (4.5:1) on both grounds",
    (status) => {
      const fg = tokenHex(`status-${status}-fg`);
      expect(contrastRatio(fg, BLUE_DEEP)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fg, BLUE_MID)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("pass and fail are not isoluminant - minimum 1.8:1 against each other", () => {
    const pass = tokenHex("status-pass-fg");
    const fail = tokenHex("status-fail-fg");
    const ratio = contrastRatio(pass, fail);
    // Measured ~1.97:1 at time of writing; 1.8 leaves headroom for minor
    // token tweaks without being so loose it'd pass at the old ~1.0:1.
    expect(ratio).toBeGreaterThanOrEqual(1.8);
  });

  it("no two statuses collapse back to near-1:1 (the original bug)", () => {
    for (let i = 0; i < STATUSES.length; i++) {
      for (let j = i + 1; j < STATUSES.length; j++) {
        const a = tokenHex(`status-${STATUSES[i]}-fg`);
        const b = tokenHex(`status-${STATUSES[j]}-fg`);
        expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(1.1);
      }
    }
  });
});
