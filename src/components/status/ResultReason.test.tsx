import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ResultReason } from "./ResultReason";
import { PAGE_XSS_TITLE } from "@/mocks/data";

describe("ResultReason", () => {
  it("renders the full reason text, not truncated", () => {
    const longReason =
      'Expected element "#confirm-button" to be visible within 5000ms, but it was not found on the page. The page navigated to /checkout/error instead, suggesting the add-to-cart step failed silently upstream.';
    const { container } = render(
      <ResultReason reason={longReason} variant="fail" />,
    );
    expect(container.textContent).toContain(longReason);
  });

  it.each([
    ["skipped", "Skipped"],
    ["ungrounded", "Not locatable"],
    ["fail", "Failed"],
    ["timed_out", "Timed out"],
  ] as const)("labels the %s variant as %s", (variant, label) => {
    // container-scoped, not the global `screen`/destructured query - RTL
    // doesn't auto-cleanup between renders in this project's setup, so a
    // global query would see every previous it.each iteration's output
    // still mounted (matches the pattern already used elsewhere, e.g.
    // StatusBadge.test.tsx).
    const { container } = render(
      <ResultReason reason="because reasons" variant={variant} />,
    );
    expect(container.textContent).toContain(`${label}:`);
  });

  it("renders a hostile scraped reason as inert text, never markup (Phase A's XSS fixture)", () => {
    const { container } = render(
      <ResultReason reason={PAGE_XSS_TITLE} variant="ungrounded" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(PAGE_XSS_TITLE);
  });
});
