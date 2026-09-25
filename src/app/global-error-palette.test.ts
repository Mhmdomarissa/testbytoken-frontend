import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  GLOBAL_ERROR_PALETTE,
  GLOBAL_ERROR_TOKEN_OF,
} from "./global-error-palette";

const tokensCss = readFileSync(
  path.join(import.meta.dirname, "../../styles/tokens.css"),
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

describe("global-error's hex constants can't drift from the CSS tokens", () => {
  it.each(
    Object.keys(
      GLOBAL_ERROR_TOKEN_OF,
    ) as (keyof typeof GLOBAL_ERROR_TOKEN_OF)[],
  )("%s", (key) => {
    expect(GLOBAL_ERROR_PALETTE[key]).toBe(darkHex(GLOBAL_ERROR_TOKEN_OF[key]));
  });

  it("global-error.tsx uses the palette, not literal hex", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "global-error.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
