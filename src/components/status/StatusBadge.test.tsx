import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { StatusBadge, type Status } from "./StatusBadge";
import { contrastRatio } from "@/lib/color/contrast";

const ALL_STATUSES: Status[] = [
  "pass",
  "fail",
  "running",
  "skipped",
  "warning",
  "queued",
  "timed_out",
];

const tokensCss = readFileSync(
  path.join(import.meta.dirname, "../../../styles/tokens.css"),
  "utf8",
);

function tokenHex(name: string): string {
  const direct = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (direct?.[1]) return direct[1];
  // e.g. `--status-warning-fg: var(--color-gold);` - follow one level of
  // indirection to the real value, the same way a browser would.
  const indirect = tokensCss.match(
    new RegExp(`--${name}:\\s*var\\(\\s*--([\\w-]+)\\s*\\)`),
  );
  if (indirect?.[1]) return tokenHex(indirect[1]);
  throw new Error(`Token --${name} not found in styles/tokens.css`);
}

/** Status names are snake_case (matching the contract enum); CSS custom property names use hyphens. */
function chipFillToken(status: string): string {
  return tokenHex(`status-${status.replace(/_/g, "-")}-chip-fill`);
}

const BLUE_DEEP = tokenHex("color-blue-deep"); // the page ground, and the chip's fixed label/icon ink
const BLUE_MID = tokenHex("color-blue-mid");

describe("StatusBadge", () => {
  it.each(ALL_STATUSES)(
    "%s's inline style references the hyphenated chip-fill custom property, not the raw status name",
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const span = container.querySelector("span");
      const cssName = status.replace(/_/g, "-");

      expect(span?.style.backgroundColor).toBe(
        `var(--status-${cssName}-chip-fill)`,
      );
      // The specific failure mode this guards (caught once already, for
      // `timed_out`, via an actual browser screenshot, not a unit test):
      // an underscore surviving into the custom property name, which
      // silently resolves to nothing.
      expect(span?.style.backgroundColor).not.toContain("_");
    },
  );

  it("always uses the fixed ink color for label and icon, not a per-status color", () => {
    // The whole point of a filled chip (Phase B, B2): the label/icon
    // color no longer varies per status and no longer has to clear
    // contrast against the page - only against its own fill, tested
    // below. A single fixed class, not an inline style, so there's no
    // var() name to get wrong per status here.
    const { container } = render(<StatusBadge status="pass" />);
    expect(container.querySelector("span")?.className).toContain(
      "text-(--color-blue-deep)",
    );
  });
});

/**
 * Ties the component's actual rendered output to the real, committed
 * styles/tokens.css - not a hardcoded copy of hex values - so a future
 * edit that quietly breaks the wiring (a renamed token, a typo) fails
 * here, not just in a design review. Extracts the property name from
 * what StatusBadge actually rendered (not an independently recomputed
 * name), the same pattern proven to catch the underscore/hyphen bug
 * above.
 */
describe("StatusBadge CSS custom properties resolve to real, defined tokens", () => {
  function propertyNameFrom(varReference: string | undefined): string {
    const match = varReference?.match(/^var\(--(.+)\)$/);
    if (!match?.[1]) throw new Error(`Not a var() reference: ${varReference}`);
    return match[1];
  }

  it.each(ALL_STATUSES)(
    "%s's rendered chip-fill custom property is defined in styles/tokens.css with a real value",
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const span = container.querySelector("span");
      const propertyName = propertyNameFrom(span?.style.backgroundColor);
      const value = tokenHex(propertyName);
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    },
  );
});

/**
 * Phase B, B2's own required measurements - not just "a chip renders",
 * but that the chip system actually delivers the accessibility
 * improvement it exists for. Per B2:
 *   - "Label-on-fill clears AA for every state."
 *   - "Chip fill clears 3:1 against the page background (AA non-text)."
 *   - "Pairwise fill contrast is materially better than the old ladder -
 *      measure it and record the numbers."
 * All three below read the actual committed styles/tokens.css, not
 * hardcoded hex values, matching the pattern of every other contrast
 * regression test in this codebase (src/lib/color/contrast.test.ts).
 */
describe("status chip accessibility (Phase B, B2)", () => {
  it.each(ALL_STATUSES)(
    "%s: label (blue-deep ink) on its chip fill clears AA (4.5:1)",
    (status) => {
      expect(
        contrastRatio(chipFillToken(status), BLUE_DEEP),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(ALL_STATUSES)(
    "%s: chip fill clears AA non-text (3:1) against both page grounds",
    (status) => {
      const fill = chipFillToken(status);
      expect(contrastRatio(fill, BLUE_DEEP)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(fill, BLUE_MID)).toBeGreaterThanOrEqual(3);
    },
  );

  it("every pair of chip fills clears a materially higher floor than the old foreground ladder's ~1.11-1.12:1", () => {
    // Not a re-assertion of the old >=1.1 floor with a rounding error's
    // worth of headroom - the chip fills should be visibly, measurably
    // better separated, per B2's explicit ask to "measure it and record
    // the numbers." 1.18 sits just under the ~1.20-1.24:1 actually
    // measured (see tokens.css's chip-fill comment for the exact
    // per-pair numbers), leaving headroom for minor token tweaks without
    // being loose enough to pass at the old ladder's ceiling.
    const CHIP_FILL_FLOOR = 1.18;
    ALL_STATUSES.forEach((statusA, i) => {
      ALL_STATUSES.slice(i + 1).forEach((statusB) => {
        const ratio = contrastRatio(
          chipFillToken(statusA),
          chipFillToken(statusB),
        );
        expect(
          ratio,
          `${statusA} vs ${statusB} chip fill contrast`,
        ).toBeGreaterThanOrEqual(CHIP_FILL_FLOOR);
      });
    });
  });
});
