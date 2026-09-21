import { describe, expect, it } from "vitest";
import { validateTarget } from "./validateTarget";

const good = {
  name: "Checkout",
  base_url: "https://checkout.example.com",
  environment: "staging",
};

describe("validateTarget", () => {
  it("accepts a valid target and trims what it sends", () => {
    const result = validateTarget({
      ...good,
      name: "  Checkout  ",
      base_url: "  https://checkout.example.com/app  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Checkout",
        base_url: "https://checkout.example.com/app",
        environment: "staging",
      },
    });
  });

  it.each([
    ["", "name"],
    ["   ", "name"],
    ["x".repeat(81), "name"],
  ])("rejects name %j", (name, field) => {
    const r = validateTarget({ ...good, name });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual([field]);
  });

  it.each([
    "",
    "checkout.example.com", // no scheme
    "ftp://checkout.example.com",
    "javascript:alert(1)",
    "//checkout.example.com",
    "https://",
    "https://exa mple.com",
    "https:///nohost",
  ])("rejects address %j", (base_url) => {
    const r = validateTarget({ ...good, base_url });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.base_url).toBeTruthy();
  });

  it("rejects credentials in the URL, and says why", () => {
    for (const base_url of [
      "https://admin:hunter2@staging.example.com",
      "https://admin@staging.example.com",
    ]) {
      const r = validateTarget({ ...good, base_url });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.base_url).toMatch(/never take credentials/);
    }
  });

  it("does NOT reject private addresses - that is the server's guardrail, not ours", () => {
    for (const base_url of [
      "http://localhost:3000",
      "http://10.0.0.5",
      "http://192.168.1.10",
    ]) {
      expect(validateTarget({ ...good, base_url }).ok).toBe(true);
    }
  });

  it("requires an environment, and only a known one", () => {
    const missing = validateTarget({ ...good, environment: null });
    expect(missing.ok).toBe(false);
    const unknown = validateTarget({ ...good, environment: "prod-ish" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.environment).toBeTruthy();
  });

  it("reports every problem at once, not one at a time", () => {
    const r = validateTarget({ name: "", base_url: "nope", environment: null });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual([
        "base_url",
        "environment",
        "name",
      ]);
  });
});
