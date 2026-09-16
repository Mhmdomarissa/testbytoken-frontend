import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PAGE_XSS_TITLE } from "./data";

/**
 * A6's XSS fixture (docs/PHASE_A.md): a page title containing
 * `<img src=x onerror=alert(1)>`, exactly as a real crawl would capture it
 * from a hostile or compromised target page. This must render as inert
 * text - no <img> element, no onerror handler ever attached.
 *
 * This doesn't need a real product screen to prove: React's default JSX
 * text interpolation ({title}) already escapes this correctly, and that's
 * exactly the behavior CLAUDE.md's dangerouslySetInnerHTML ban depends on.
 * This test is the regression guard for that assumption, independent of
 * whatever component eventually renders a page title for real.
 */
describe("hostile page title fixture", () => {
  it("is the exact payload the brief specifies", () => {
    expect(PAGE_XSS_TITLE).toBe("<img src=x onerror=alert(1)>");
  });

  it("renders as inert text via plain JSX interpolation, not markup", () => {
    const { container } = render(
      <div data-testid="title">{PAGE_XSS_TITLE}</div>,
    );

    // No <img> was created - the string never became markup.
    expect(container.querySelector("img")).toBeNull();

    // The literal text is present, unescaped-looking to a human, but safe
    // because it was never parsed as HTML.
    expect(container.textContent).toBe(PAGE_XSS_TITLE);
  });
});
