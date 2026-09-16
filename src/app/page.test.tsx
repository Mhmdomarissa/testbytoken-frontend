import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Page from "./page";

describe("home page", () => {
  it("renders without crashing", () => {
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});
