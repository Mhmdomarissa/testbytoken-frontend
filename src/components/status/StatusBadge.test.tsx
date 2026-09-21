import { describe, expect, it } from "vitest";
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
