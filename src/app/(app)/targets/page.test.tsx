import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/errors";

const targetsState: { current: Record<string, unknown> } = { current: {} };
vi.mock("@/lib/api/queries/targets", () => ({
  useTargets: () => targetsState.current,
  useCreateTarget: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUpdateTarget: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("@/lib/api/queries/scans", () => ({
  useCreateScan: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

import TargetsPage from "./page";

const base = {
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
  refetch: vi.fn(),
};

afterEach(cleanup);

describe("Targets page states", () => {
  it("loading is a skeleton, not a spinner or blank", () => {
    targetsState.current = { ...base, isPending: true };
    const { container } = render(<TargetsPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it("an error is retryable and says what the server said", async () => {
    const refetch = vi.fn();
    targetsState.current = {
      ...base,
      isError: true,
      error: new ApiError("network", "Couldn't reach the server."),
      refetch,
    };
    render(<TargetsPage />);
    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("empty contains the action that fills it, and it opens the registration dialog", async () => {
    targetsState.current = { ...base, data: [] };
    render(<TargetsPage />);
    expect(screen.getByText("No targets yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a target" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
