import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { OG_PALETTE, OG_TOKEN_OF } from "./og-palette";

const tokensCss = readFileSync(
  path.join(import.meta.dirname, "../../../../../styles/tokens.css"),
  "utf8",
);

function darkHex(name: string): string {
  const m = tokensCss.match(
    new RegExp(
      `--${name}:\\s*light-dark\\(\\s*#[0-9a-fA-F]{6}\\s*,\\s*(#[0-9a-fA-F]{6})\\s*\\)`,
    ),
  );
  if (!m?.[1]) throw new Error(`--${name} is not a light-dark() pair`);
  return m[1].toLowerCase();
}

describe("the OG image's hex constants can't drift from the CSS tokens", () => {
  it.each(["page", "card", "gold", "ink"] as const)("%s", (key) => {
    expect(OG_PALETTE[key]).toBe(darkHex(OG_TOKEN_OF[key]));
  });

  it.each(Object.keys(OG_TOKEN_OF.verdict))("verdict %s", (verdict) => {
    expect(OG_PALETTE.verdict[verdict]).toBe(
      darkHex(OG_TOKEN_OF.verdict[verdict]!),
    );
  });
});
