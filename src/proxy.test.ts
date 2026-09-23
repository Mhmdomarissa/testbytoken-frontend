// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const req = (pathname: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy: which routes need a session", () => {
  it.each([
    "/",
    "/p/abc123",
    "/p/abc123/opengraph-image",
    "/sign-in",
    "/style-guide",
  ])("%s is reachable without a session", (pathname) => {
    const res = proxy(req(pathname));
    expect(res.headers.get("location")).toBeNull();
  });

  it.each([
    "/overview",
    "/targets",
    "/runs",
    "/suites",
    "/usage",
    "/proofs/x",
    "/pricing",
  ])("%s redirects to sign-in without a session", (pathname) => {
    const res = proxy(req(pathname));
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("a prefix match is a path-segment match: /products is not /p", () => {
    expect(proxy(req("/products")).headers.get("location")).toContain(
      "/sign-in",
    );
  });
});

describe("proxy: a signed-in visitor is sent to the console home, before anything renders", () => {
  it.each(["/", "/sign-in"])("%s redirects to /overview", (pathname) => {
    const location = proxy(req(pathname, "session=demo_user")).headers.get(
      "location",
    );
    expect(new URL(location!).pathname).toBe("/overview");
  });

  it("/overview itself is served, not redirected again", () => {
    expect(
      proxy(req("/overview", "session=demo_user")).headers.get("location"),
    ).toBeNull();
  });
});
