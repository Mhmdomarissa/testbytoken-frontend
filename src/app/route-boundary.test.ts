// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

/**
 * The boundary is signed-in vs not, in two tiers. Phase B B9: the public
 * proof page "does not import the app shell" (`(public)`, strictest). Pre-auth
 * pages (`(auth)`: sign-in) get the dev mock gate and nothing else. This
 * makes that a checked fact rather than a promise. Anything under
 * `src/app/(public)/` - and the root layout every route inherits - must not
 * reach, by any chain of imports, the console's client runtime: the shell,
 * the mock worker, the TanStack Query provider and hooks, or the packages
 * behind them. Otherwise a phone opening a shared proof link downloads
 * the whole console first (measured: a bare public route is ~181 KB gzip;
 * under the console's providers it was ~384 KB).
 *
 * The walker is exercised against a synthetic violating tree below, so an
 * empty `(public)` directory (nothing to walk yet) can't make the real
 * assertion pass vacuously.
 */

const SRC = path.join(import.meta.dirname, "..");

interface Tier {
  forbiddenPaths: string[];
  forbiddenPackages: string[];
  /** Files an entry MAY import, and which are not walked into (their own imports are their business). */
  leaves: string[];
}

const CONSOLE_ONLY = [
  "components/shell",
  "lib/api/queries",
  "lib/api/QueryProvider.tsx",
  "hooks/useResource.ts",
  "app/(console)",
];

/** A public page (the proof page): none of the console, and no mock plumbing at all. */
export const PUBLIC_TIER: Tier = {
  forbiddenPaths: [...CONSOLE_ONLY, "mocks"],
  forbiddenPackages: ["@tanstack/react-query", "msw"],
  leaves: [],
};

/**
 * A pre-auth page (sign-in): still none of the console, but it talks to the
 * mock backend directly in development, so it may use the mock gate and the
 * mock-only session-cookie workaround - as leaves, so what THEY import (the
 * MSW worker, handlers) is not walked and the Query client can't ride in
 * through them unnoticed.
 */
export const AUTH_TIER: Tier = {
  forbiddenPaths: [...CONSOLE_ONLY, "mocks"],
  forbiddenPackages: ["@tanstack/react-query", "msw"],
  leaves: ["mocks/MockingProvider.tsx", "mocks/session-cookie-workaround.ts"],
};

function specifiers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function resolve(from: string, spec: string, src: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(src, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (base === null) return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return candidate;
  }
  return null;
}

/** Every violation reachable from `entries`, each as the chain of files that leads to it. */
export function findViolations(
  entries: string[],
  src: string,
  tier: Tier = PUBLIC_TIER,
): string[] {
  const violations: string[] = [];
  const seen = new Set<string>();
  const forbidden = tier.forbiddenPaths.map((p) => path.join(src, p));
  const leaves = tier.leaves.map((p) => path.join(src, p));

  const walk = (file: string, chain: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiers(file)) {
      const pkg = tier.forbiddenPackages.find(
        (p) => spec === p || spec.startsWith(`${p}/`),
      );
      const next = resolve(file, spec, src);
      const label = (f: string) => path.relative(src, f);
      if (pkg) {
        violations.push(
          [...chain, file].map(label).join(" -> ") + ` -> ${pkg}`,
        );
      } else if (next) {
        if (leaves.includes(next)) continue;
        if (
          forbidden.some((f) => next === f || next.startsWith(f + path.sep))
        ) {
          violations.push([...chain, file, next].map(label).join(" -> "));
        } else {
          walk(next, [...chain, file]);
        }
      }
    }
  };
  for (const entry of entries) walk(entry, []);
  return violations;
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return filesUnder(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe("the public route boundary", () => {
  it("the root layout reaches nothing from the console's client runtime", () => {
    expect(findViolations([path.join(SRC, "app/layout.tsx")], SRC)).toEqual([]);
  });

  it("nothing under (public) reaches the shell, the mock worker or the query client", () => {
    expect(
      findViolations(filesUnder(path.join(SRC, "app/(public)")), SRC),
    ).toEqual([]);
  });

  it("nothing under (auth) reaches the shell or the query client (the mock gate is allowed)", () => {
    const entries = filesUnder(path.join(SRC, "app/(auth)"));
    expect(entries.length).toBeGreaterThan(0); // sign-in lives here: not vacuous
    expect(findViolations(entries, SRC, AUTH_TIER)).toEqual([]);
  });

  it("the console providers live in the (console) group, not the root layout", () => {
    const root = fs.readFileSync(path.join(SRC, "app/layout.tsx"), "utf8");
    expect(root).not.toMatch(
      /QueryProvider|MockingProvider|TooltipProvider|Toaster/,
    );
    const consoleLayout = fs.readFileSync(
      path.join(SRC, "app/(console)/layout.tsx"),
      "utf8",
    );
    expect(consoleLayout).toMatch(/QueryProvider/);
  });
});

describe("findViolations (so the checks above can't pass by walking nothing)", () => {
  function tree(files: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boundary-"));
    for (const [name, body] of Object.entries(files)) {
      const p = path.join(dir, name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
    }
    return dir;
  }

  it("finds a transitive import of the shell, with the chain that leads there", () => {
    const dir = tree({
      "app/(public)/p/page.tsx": `import { Proof } from "@/components/proof/Proof";`,
      "components/proof/Proof.tsx": `import { helper } from "../../lib/helper";`,
      "lib/helper.ts": `export * from "@/components/shell/AppSidebar";`,
      "components/shell/AppSidebar.tsx": `export const AppSidebar = 1;`,
    });
    const found = findViolations(
      [path.join(dir, "app/(public)/p/page.tsx")],
      dir,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("components/shell/AppSidebar");
    expect(found[0]).toContain("lib/helper.ts");
  });

  it("finds a dynamic import and a forbidden package", () => {
    const dir = tree({
      "a.tsx": `const m = () => import("@/mocks/browser");`,
      "b.tsx": `import { useQuery } from "@tanstack/react-query";`,
      "mocks/browser.ts": ``,
    });
    expect(findViolations([path.join(dir, "a.tsx")], dir)).toHaveLength(1);
    expect(findViolations([path.join(dir, "b.tsx")], dir)).toHaveLength(1);
  });

  it("the auth tier allows the mock gate as a leaf, but not what a console page would bring", () => {
    const dir = tree({
      "auth/page.tsx": `import { MockingProvider } from "@/mocks/MockingProvider";`,
      "mocks/MockingProvider.tsx": `import("./browser");`,
      "mocks/browser.ts": `import { setupWorker } from "msw";`,
      "auth/bad.tsx": `import { QueryProvider } from "@/lib/api/QueryProvider";`,
      "lib/api/QueryProvider.tsx": ``,
    });
    expect(
      findViolations([path.join(dir, "auth/page.tsx")], dir, AUTH_TIER),
    ).toEqual([]);
    expect(
      findViolations([path.join(dir, "auth/bad.tsx")], dir, AUTH_TIER),
    ).toHaveLength(1);
    // ...while the public tier refuses even the mock gate.
    expect(
      findViolations([path.join(dir, "auth/page.tsx")], dir, PUBLIC_TIER),
    ).toHaveLength(1);
  });

  it("passes a clean tree", () => {
    const dir = tree({
      "a.tsx": `import { x } from "./b"; import React from "react";`,
      "b.ts": `export const x = 1;`,
    });
    expect(findViolations([path.join(dir, "a.tsx")], dir)).toEqual([]);
  });
});
