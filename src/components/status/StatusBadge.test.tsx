import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { StatusBadge, type Status } from "./StatusBadge";

/**
 * UI v2 (section 1.3) narrowed the status-colour guarantee rather than
 * dropping it: colour is no longer asked to separate every status. What
 * separates them is structural, and asserted here against what the
 * component actually renders:
 *   - every status has its OWN icon silhouette and its OWN label;
 *   - the quiet chip is the status tint + the status colour on the icon
 *     only + the label in the normal text colour;
 *   - the filled chip (one verdict per page) is the status colour + the
 *     measured on-status label ink;
 *   - every custom property it references is defined in the committed
 *     styles/tokens.css, in both themes.
 * The contrast numbers for all of those pairs live in
 * src/lib/color/contrast.test.ts.
 */

const ALL_STATUSES: Status[] = [
  "pass",
  "fail",
  "running",
  "skipped",
  "cancelled",
  "warning",
  "queued",
  "timed_out",
];

const tokensCss = readFileSync(
  path.join(import.meta.dirname, "../../../styles/tokens.css"),
  "utf8",
);

function chip(status: Status, variant?: "quiet" | "filled") {
  const { container } = render(
    <StatusBadge status={status} variant={variant} />,
  );
  const span = container.querySelector("span")!;
  const svg = span.querySelector("svg")!;
  return { span, svg };
}

/** lucide renders `class="lucide lucide-<icon-name> ..."`. */
function iconName(svg: SVGElement): string {
  const name = [...svg.classList].find(
    (c) => c.startsWith("lucide-") && c !== "lucide",
  );
  if (!name) throw new Error("no lucide icon class on the chip's svg");
  return name;
}

function propertyName(varRef: string): string {
  const m = varRef.match(/^var\(--(.+)\)$/);
  if (!m?.[1]) throw new Error(`Not a var() reference: ${varRef}`);
  return m[1];
}

describe("every status is told apart by icon and label, not colour", () => {
  it("every status has a unique icon silhouette", () => {
    const icons = ALL_STATUSES.map((s) => iconName(chip(s).svg));
    expect(new Set(icons).size).toBe(ALL_STATUSES.length);
  });

  it("every status has a unique label", () => {
    const labels = ALL_STATUSES.map((s) => chip(s).span.textContent);
    expect(new Set(labels).size).toBe(ALL_STATUSES.length);
  });
});

describe("quiet chip (the default)", () => {
  it.each(ALL_STATUSES)(
    "%s: tint ground, normal-text label, status colour on the icon only",
    (status) => {
      const css = status.replace(/_/g, "-");
      const { span, svg } = chip(status);
      expect(span.dataset.variant).toBe("quiet");
      expect(span.style.backgroundColor).toBe(`var(--status-${css}-tint)`);
      expect(span.style.color).toBe("var(--ink)");
      expect(svg.style.color).toBe(`var(--status-${css}-fg)`);
    },
  );
});

describe("filled chip (the page's one verdict)", () => {
  it.each(ALL_STATUSES)(
    "%s: status colour ground, on-status label ink",
    (status) => {
      const css = status.replace(/_/g, "-");
      const { span } = chip(status, "filled");
      expect(span.dataset.variant).toBe("filled");
      expect(span.style.backgroundColor).toBe(`var(--status-${css}-fg)`);
      expect(span.style.color).toBe("var(--status-on)");
    },
  );
});

describe("every custom property a chip renders is a real light-dark() token", () => {
  it.each(ALL_STATUSES)("%s", (status) => {
    const quiet = chip(status);
    const filled = chip(status, "filled");
    const refs = [
      quiet.span.style.backgroundColor,
      quiet.span.style.color,
      quiet.svg.style.color,
      filled.span.style.backgroundColor,
      filled.span.style.color,
    ];
    for (const ref of refs) {
      const name = propertyName(ref);
      // Snake_case status names must have been hyphenated, or the
      // property silently resolves to nothing.
      expect(name).not.toContain("_");
      expect(tokensCss).toMatch(
        new RegExp(
          `--${name}:\\s*light-dark\\(\\s*#[0-9a-fA-F]{6}\\s*,\\s*#[0-9a-fA-F]{6}\\s*\\)`,
        ),
      );
    }
  });
});

describe("unrecognised status", () => {
  it("stays visibly different: a dashed outline carrying the raw value, no tint", () => {
    const { container } = render(
      <StatusBadge status={"exploded" as unknown as Status} />,
    );
    const span = container.querySelector("[data-unrecognised-status]");
    expect(span).not.toBeNull();
    expect(span!.className).toContain("border-dashed");
    expect(span!.textContent).toContain("exploded");
    expect((span as HTMLElement).style.backgroundColor).toBe("");
  });
});
