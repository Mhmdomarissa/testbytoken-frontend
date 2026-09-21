import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio } from "./contrast";

/**
 * Regression test for the Phase A review's A1-FIX-1 (BLOCKING) and the
 * follow-up review pass before Phase B: every status foreground was
 * independently binary-searched to the minimum lightness clearing AA, so
 * they converged within 0.03 of each other and became ~1.0:1 against one
 * another - a WCAG 1.4.1 failure (pass and fail were the same color for
 * ~6% of male users, and identical in greyscale). The first fix only
 * widened pass/fail specifically; the follow-up review caught that other
 * pairs (warning/running, pass/running, queued/skipped) were *still*
 * only ~1.05-1.17:1 - fixing the pair everyone was looking at isn't the
 * same as fixing the scale. This test now covers every pair among all
 * SEVEN statuses (including `warning`, missed the first time, and
 * `timed_out`, added after this test already existed). Parses the actual
 * committed styles/tokens.css - not a hardcoded copy of the hex values -
 * so a future edit that quietly re-clusters the lightnesses fails this
 * test, not just a design review.
 */

const tokensPath = path.join(import.meta.dirname, "../../../styles/tokens.css");
const tokensCss = readFileSync(tokensPath, "utf8");

function tokenHex(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (match?.[1]) return match[1];
  // Handles `--status-warning-fg: var(--color-gold);` - warning is the one
  // status that deliberately stays the literal accent color rather than
  // its own derived hex (it already sits at the right ladder rung).
  const varMatch = tokensCss.match(
    new RegExp(`--${name}:\\s*var\\(\\s*--([\\w-]+)\\s*\\)`),
  );
  if (varMatch?.[1]) return tokenHex(varMatch[1]);
  throw new Error(`Token --${name} not found in styles/tokens.css`);
}

const BLUE_DEEP = tokenHex("color-blue-deep");
const BLUE_MID = tokenHex("color-blue-mid");
const STATUSES = [
  "pass",
  "fail",
  "running",
  "queued",
  "skipped",
  "warning",
  "timed_out",
] as const;

// Status names match the contract's enum values (snake_case, e.g.
// `timed_out`); CSS custom property names use hyphens.
function fgToken(status: string): string {
  return tokenHex(`status-${status.replace(/_/g, "-")}-fg`);
}

describe("status color tokens", () => {
  it.each(STATUSES)(
    "%s foreground still clears AA (4.5:1) on both grounds",
    (status) => {
      const fg = fgToken(status);
      expect(contrastRatio(fg, BLUE_DEEP)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fg, BLUE_MID)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("pass and fail are not isoluminant - minimum 1.8:1 against each other", () => {
    const pass = fgToken("pass");
    const fail = fgToken("fail");
    const ratio = contrastRatio(pass, fail);
    // Measured ~1.97:1 at time of writing; 1.8 leaves headroom for minor
    // token tweaks without being so loose it'd pass at the old ~1.0:1.
    expect(ratio).toBeGreaterThanOrEqual(1.8);
  });

  it("no two statuses collapse back to near-1:1, across every pair of all seven", () => {
    // fail and pass anchor the two ends of the ladder (see tokens.css);
    // with those fixed, ~1.11-1.12:1 is the mathematical ceiling for the
    // worst-case adjacent pair across seven statuses sharing this AA-safe
    // luminance range - 1.1 leaves a small but real margin under that
    // ceiling (measured worst case: skipped/warning at ~1.114:1) without
    // being so loose it'd pass at the pre-fix ~1.0:1. Getting materially
    // higher than this would mean moving fail off its AA floor or pass
    // into pastel territory - see DESIGN_SYSTEM_APP.md. This is exactly
    // why color is a secondary channel: lightness alone cannot cleanly
    // separate seven categories in a dark-ground AA-constrained range,
    // so every status also carries a distinct-silhouette icon and a text
    // label (StatusBadge) - that is the primary fix, not this ladder.
    STATUSES.forEach((statusA, i) => {
      STATUSES.slice(i + 1).forEach((statusB) => {
        expect(
          contrastRatio(fgToken(statusA), fgToken(statusB)),
        ).toBeGreaterThanOrEqual(1.1);
      });
    });
  });
});
