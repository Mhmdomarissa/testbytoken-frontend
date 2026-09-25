import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio } from "./contrast";

/**
 * Every colour pair that carries meaning, measured in BOTH themes against
 * the committed styles/tokens.css - parsed, not a hardcoded copy - so a
 * token edit that breaks a pair fails here, not in a design review.
 *
 * UI v2 (docs/PHASE_UI_V2.md, section 1) replaced the single dark palette
 * with light-dark() pairs, and narrowed the status-colour guarantee the
 * Phase A review introduced (it had spread seven statuses on a lightness
 * ladder, because colour was then the chip's main channel). Now:
 *   - a status's colour sits on its ICON only (non-text, 3:1), the label
 *     is normal text (4.5:1 on the tint), and every status has its own
 *     icon silhouette and label (asserted in StatusBadge.test.tsx);
 *   - pass vs fail keep a lightness floor of 1.5:1 in both themes;
 *   - other pairs may sit close - they are told apart by icon and label.
 * Numbers and colour-vision-deficiency simulations: docs/DESIGN_SYSTEM_APP.md.
 */

const tokensCss = readFileSync(
  path.join(import.meta.dirname, "../../../styles/tokens.css"),
  "utf8",
);

type Theme = "light" | "dark";
const THEMES: Theme[] = ["light", "dark"];

/** `--name: light-dark(#light, #dark)` -> the hex for one theme. */
function token(name: string, theme: Theme): string {
  const m = tokensCss.match(
    new RegExp(
      `--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{6})\\s*,\\s*(#[0-9a-fA-F]{6})\\s*\\)`,
    ),
  );
  if (!m?.[1] || !m[2])
    throw new Error(`--${name} is not a light-dark(#hex, #hex) pair`);
  return theme === "light" ? m[1] : m[2];
}

const SURFACES = ["page", "card", "raised"] as const;
const surface = (s: string, t: Theme) => token(`surface-${s}`, t);

const STATUSES = [
  "pass",
  "fail",
  "running",
  "queued",
  "skipped",
  "cancelled",
  "warning",
  "timed-out",
] as const;

describe.each(THEMES)("%s theme", (theme) => {
  describe("text (4.5:1)", () => {
    it.each(["ink", "ink-muted", "ink-faint", "gold-text", "danger-text"])(
      "%s on page, card and raised",
      (name) => {
        for (const s of SURFACES)
          expect(
            contrastRatio(token(name, theme), surface(s, theme)),
            `${name} on ${s}`,
          ).toBeGreaterThanOrEqual(4.5);
      },
    );

    it.each(["ink", "ink-muted", "ink-faint"])("%s on the sidebar", (name) => {
      expect(
        contrastRatio(token(name, theme), surface("sidebar", theme)),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it("the primary button's label on gold", () => {
      expect(
        contrastRatio(token("on-gold", theme), token("gold-fill", theme)),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("non-text (3:1)", () => {
    it("the focus ring (gold) on page, card, raised and sidebar", () => {
      for (const s of [...SURFACES, "sidebar"])
        expect(
          contrastRatio(token("gold", theme), surface(s, theme)),
          `focus ring on ${s}`,
        ).toBeGreaterThanOrEqual(3);
    });

    it("form-control boundaries (line-input) on page, card and raised", () => {
      for (const s of SURFACES)
        expect(
          contrastRatio(token("line-input", theme), surface(s, theme)),
          `line-input on ${s}`,
        ).toBeGreaterThanOrEqual(3);
    });
  });

  describe.each(STATUSES)("status %s", (status) => {
    const fg = () => token(`status-${status}-fg`, theme);
    const tint = () => token(`status-${status}-tint`, theme);

    it("icon (status colour) is 3:1 on its tint, on card and on raised", () => {
      expect(contrastRatio(fg(), tint()), "on tint").toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(fg(), surface("card", theme)),
        "on card",
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(fg(), surface("raised", theme)),
        "on raised",
      ).toBeGreaterThanOrEqual(3);
    });

    it("quiet chip label (normal text) is 4.5:1 on its tint", () => {
      expect(contrastRatio(token("ink", theme), tint())).toBeGreaterThanOrEqual(
        4.5,
      );
    });

    it("filled verdict chip label (status-on) is 4.5:1 on the status colour", () => {
      expect(
        contrastRatio(token("status-on", theme), fg()),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("pass and fail differ in lightness by at least 1.5:1", () => {
    expect(
      contrastRatio(
        token("status-pass-fg", theme),
        token("status-fail-fg", theme),
      ),
    ).toBeGreaterThanOrEqual(1.5);
  });

  it("the warning colour works as TEXT on its own tint (the offline banner)", () => {
    expect(
      contrastRatio(
        token("status-warning-fg", theme),
        token("status-warning-tint", theme),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
