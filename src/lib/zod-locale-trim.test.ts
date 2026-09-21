// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const loader = require("../../scripts/zod-locale-trim-loader.cjs") as {
  (this: { resourcePath: string }, source: string): string;
  trim(source: string, file: string): string;
};

const ZOD = path.dirname(require.resolve("zod/package.json"));
const external = path.join(ZOD, "v4/classic/external.js");
const core = path.join(ZOD, "v4/core/index.js");

describe("zod locale trim loader (temporary workaround - see the loader's header)", () => {
  it("removes the locale and JSON-schema re-exports from the INSTALLED zod, and nothing else", () => {
    for (const file of [external, core]) {
      const before = fs.readFileSync(file, "utf8");
      const after = loader.trim(before, file);
      expect(before).toMatch(/export \* as locales/);
      expect(after).not.toMatch(/locales/);
      expect(after.split("\n").length).toBeLessThan(before.split("\n").length);
    }
    const after = loader.trim(fs.readFileSync(external, "utf8"), external);
    expect(after).not.toMatch(/toJSONSchema|fromJSONSchema/);
    // Everything the app uses is still exported.
    expect(after).toMatch(/export \* from "\.\/schemas\.js"/);
    expect(after).toMatch(/export \* as iso/);
    expect(after).toMatch(/export \* as coerce/);
  });

  it("does not touch English: the default locale is registered from classic/schemas.js, which this loader never sees", () => {
    const schemas = fs.readFileSync(
      path.join(ZOD, "v4/classic/schemas.js"),
      "utf8",
    );
    expect(schemas).toMatch(/import en from "\.\.\/locales\/en\.js"/);
  });

  it("fails LOUDLY when zod changes shape, naming the upstream issues", () => {
    expect(() => loader.trim("export const nothing = 1;\n", external)).toThrow(
      /not found[\s\S]*88643[\s\S]*6050/,
    );
    expect(() => loader.trim("export * from './x.js';\n", core)).toThrow(
      /not found/,
    );
  });

  it("fails loudly if the rule ever matches a file it wasn't written for", () => {
    expect(() =>
      loader.trim(
        "export * as locales from './l.js';\n",
        "/x/node_modules/zod/v4/classic/schemas.js",
      ),
    ).toThrow(/unexpected file/);
  });

  it("works as a Turbopack loader (this.resourcePath)", () => {
    const out = loader.call(
      { resourcePath: core },
      fs.readFileSync(core, "utf8"),
    );
    expect(out).not.toMatch(/locales/);
  });
});
