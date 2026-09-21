import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * scripts/openapi-strip-loader.cjs removes the OpenAPI-only layer from the
 * contract for every application bundle. These pin what it removes, what it
 * must leave alone, and that the real contract survives it. (The
 * bundle-level guarantee - that no description ships - is
 * scripts/check-contract-prose.mjs, run against a real build in CI.)
 */

const require = createRequire(import.meta.url);
const loader = require("../../../scripts/openapi-strip-loader.cjs") as (
  this: { resourcePath: string },
  source: string,
) => string;

const strip = (source: string) =>
  loader.call({ resourcePath: "/x/contract.ts" }, source);

describe("what it removes", () => {
  it("an .openapi() call becomes its receiver", () => {
    expect(
      strip(
        `export const A = z.string().openapi({ description: "long prose" });`,
      ),
    ).toBe(`export const A = z.string();`);
  });

  it("named-component registration too, and mid-chain calls", () => {
    expect(strip(`export const B = z.object({}).openapi("B");`)).toBe(
      `export const B = z.object({});`,
    );
    expect(
      strip(`const C = Id.openapi({ description: "x" }).nullable();`),
    ).toBe(`const C = Id.nullable();`);
  });

  it("nested .openapi() calls, at any depth", () => {
    const out = strip(
      `const S = z.object({ a: z.string().openapi({ description: "one" }), b: z.array(z.number().openapi({ description: "two" })) }).openapi("S");`,
    );
    expect(out).toBe(
      `const S = z.object({ a: z.string(), b: z.array(z.number()) });`,
    );
  });

  it("the prose argument of extensibleEnum, but not its values", () => {
    expect(
      strip(
        `const E = extensibleEnum(["a", "b"], "Why this exists. " + "More.");`,
      ),
    ).toBe(`const E = extensibleEnum(["a", "b"]);`);
  });

  it("the side-effect setup import, and path registration functions", () => {
    const out = strip(
      [
        `import "./zod-openapi-setup";`,
        `import { z } from "zod";`,
        `export const A = z.string();`,
        `export function registerThingPaths(registry: unknown) { registry.registerPath({ description: "prose" }); }`,
        `export function keepMe() { return 1; }`,
      ].join("\n"),
    );
    expect(out).not.toContain("zod-openapi-setup");
    expect(out).not.toContain("registerThingPaths");
    expect(out).not.toContain("prose");
    expect(out).toContain(`import { z } from "zod";`);
    expect(out).toContain("export function keepMe()");
  });
});

describe("what it must leave alone", () => {
  it("runtime checks and their messages, comments, and unrelated `openapi`-named things", () => {
    const src = [
      `// keep this comment`,
      `export const Id = z.string().regex(/^a$/).refine((v) => v !== "x", { message: "runtime message" });`,
      `const openapi = { name: "not a call" };`,
      `export const y = openapi.name;`,
    ].join("\n");
    expect(strip(src)).toBe(src);
  });

  it("extensibleEnum with only its values is untouched", () => {
    const src = `const E = extensibleEnum(["a"]);`;
    expect(strip(src)).toBe(src);
  });
});

describe("the real contract survives it", () => {
  const dir = path.join(import.meta.dirname);
  const files = readdirSync(dir).filter(
    (f) =>
      f.endsWith(".ts") &&
      !f.includes(".test.") &&
      f !== "zod-openapi-setup.ts" &&
      f !== "registry.ts",
  );
  const descriptions: string[] = [];
  (function collect(node: unknown) {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k === "description" && typeof v === "string" && v.length >= 40)
          descriptions.push(v);
        else collect(v);
      }
    }
  })(JSON.parse(readFileSync(path.join(dir, "../../../openapi.json"), "utf8")));

  it.each(files)(
    "%s: valid TypeScript, no .openapi(), none of the OpenAPI prose",
    (file) => {
      const out = loader.call(
        { resourcePath: path.join(dir, file) },
        readFileSync(path.join(dir, file), "utf8"),
      );
      const { diagnostics } = ts.transpileModule(out, {
        reportDiagnostics: true,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      });
      expect(
        diagnostics?.map((d) =>
          ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        ),
      ).toEqual([]);
      expect(out).not.toMatch(/\.openapi\(/);
      expect(out).not.toMatch(/zod-openapi-setup/);
      for (const d of descriptions)
        expect(out, d.slice(0, 50)).not.toContain(d.slice(0, 40));
    },
  );
});
