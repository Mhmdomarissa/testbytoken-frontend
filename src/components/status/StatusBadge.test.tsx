import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { StatusBadge, type Status } from "./StatusBadge";

/**
 * Regression guard for a real bug caught by an actual browser screenshot
 * (not a unit test) during the pre-Phase-B review's `timed_out` work:
 * `status` values are snake_case (`timed_out`, matching the contract
 * enum), but the CSS custom properties they key into use hyphens
 * (`--status-timed-out-fg` in styles/tokens.css). The component used to
 * build the var() name directly from `status`, producing
 * `var(--status-timed_out-fg)` - a property that doesn't exist. That
 * fails silently: `color` just inherits (this badge's text still looked
 * like *something*, in the parent's default color) and
 * `background-color`/`border-color` fall back to transparent/currentColor
 * - no error, no crash, just a `timed_out` badge quietly missing its own
 * color, background, and border. Any status with an underscore in its
 * name would hit this; `timed_out` is currently the only one.
 */
const ALL_STATUSES: Status[] = [
  "pass",
  "fail",
  "running",
  "skipped",
  "warning",
  "queued",
  "timed_out",
];

describe("StatusBadge", () => {
  it.each(ALL_STATUSES)(
    "%s's inline style references the hyphenated CSS custom property, not the raw status name",
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const span = container.querySelector("span");
      const cssName = status.replace(/_/g, "-");

      expect(span?.style.color).toBe(`var(--status-${cssName}-fg)`);
      expect(span?.style.backgroundColor).toBe(`var(--status-${cssName}-bg)`);
      expect(span?.style.borderColor).toBe(`var(--status-${cssName}-border)`);

      // The specific failure mode this guards: an underscore surviving
      // into the custom property name, which silently resolves to nothing.
      expect(span?.style.color).not.toContain("_");
    },
  );
});

/**
 * A stronger version of the same guard, requested after the fix above:
 * every status should resolve to a CSS custom property that is actually
 * *defined*, with a real, non-empty value - not just a string that looks
 * like the right shape.
 *
 * This can't be checked via `getComputedStyle` the way it would in a real
 * browser: verified empirically that jsdom's CSS engine does not resolve
 * `var()` at all, for either an existing or a nonexistent custom
 * property - `getComputedStyle(el).color` returns the literal string
 * `"var(--whatever)"` either way, so a "compute it and check it's
 * non-empty" test would pass even for a completely broken reference and
 * catch nothing. The strongest check actually available in this test
 * environment is the one below: parse the real, committed
 * `styles/tokens.css` (not a hardcoded copy) for every `--status-*-fg`
 * property it defines, and assert that every `Status` value's generated
 * CSS name is one of them, with an actual non-empty color behind it. This
 * fails in CI - no screenshot needed - for exactly the bug class that
 * shipped: a status whose generated name doesn't match anything real in
 * the stylesheet.
 */
describe("StatusBadge CSS custom properties resolve to real, defined tokens", () => {
  const tokensCss = readFileSync(
    path.join(import.meta.dirname, "../../../styles/tokens.css"),
    "utf8",
  );

  function definedValue(propertyName: string): string | undefined {
    const direct = tokensCss.match(
      new RegExp(`--${propertyName}:\\s*(#[0-9a-fA-F]{6})`),
    );
    if (direct?.[1]) return direct[1];
    // `--status-warning-fg: var(--color-gold);` - follow one level of
    // indirection to the real value, the same way a browser would.
    const indirect = tokensCss.match(
      new RegExp(`--${propertyName}:\\s*var\\(\\s*--([\\w-]+)\\s*\\)`),
    );
    return indirect?.[1] ? definedValue(indirect[1]) : undefined;
  }

  // Extracts the property name out of a rendered `"var(--x)"` string -
  // reads the *actual* name the component asked for, not a name this test
  // computes independently (which would pass even if the component
  // regressed to the raw, underscored `status` value: this test would
  // then be checking a name nobody asked for).
  function propertyNameFrom(varReference: string | undefined): string {
    const match = varReference?.match(/^var\(--(.+)\)$/);
    if (!match?.[1]) {
      throw new Error(`Not a var() reference: ${varReference}`);
    }
    return match[1];
  }

  it.each(ALL_STATUSES)(
    "%s's rendered fg/bg/border custom properties are all defined in styles/tokens.css with real values",
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const span = container.querySelector("span");
      const rendered = {
        fg: span?.style.color,
        bg: span?.style.backgroundColor,
        border: span?.style.borderColor,
      };

      for (const [suffix, varReference] of Object.entries(rendered)) {
        const propertyName = propertyNameFrom(varReference);
        const value = definedValue(propertyName);
        expect(
          value,
          `--${propertyName} (rendered for ${suffix}) should be defined in tokens.css`,
        ).not.toBeUndefined();
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    },
  );
});
