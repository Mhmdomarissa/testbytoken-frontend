import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScanFailureKindSchema } from "@/lib/contract";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { scanFailureCopy } from "./scanFailure";
import { ScanFailurePanel } from "./ScanFailurePanel";
import { LastScan } from "./LastScan";

afterEach(cleanup);

describe("scanFailureCopy", () => {
  it("has specific guidance for every kind the contract defines (a new kind fails here, not in front of a customer)", () => {
    const generic = scanFailureCopy(new UnrecognisedValue("x")).title;
    for (const kind of ScanFailureKindSchema.options) {
      expect(scanFailureCopy(kind).title).not.toBe(generic);
    }
  });

  it("only a guardrail refusal is non-retryable, and it points at the address", () => {
    for (const kind of ScanFailureKindSchema.options) {
      expect(scanFailureCopy(kind).retryable).toBe(
        kind !== "blocked_by_guardrail",
      );
    }
    expect(scanFailureCopy("blocked_by_guardrail").suggestsNewAddress).toBe(
      true,
    );
  });

  it("a prototype-chain key is not a kind", () => {
    expect(scanFailureCopy("constructor").title).toBe(
      scanFailureCopy(new UnrecognisedValue("x")).title,
    );
  });
});

describe("ScanFailurePanel", () => {
  const noop = () => {};

  it("shows the server's message as text, never markup", () => {
    const { container } = render(
      <ScanFailurePanel
        failure={{
          kind: "refused",
          message: '<img src=x onerror="alert(1)"> 403',
        }}
        onScanAgain={noop}
        onChangeAddress={noop}
        scanning={false}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/onerror/)).toBeTruthy();
  });

  it("an unrecognised kind says so, shows the raw kind, and still allows a retry", async () => {
    const onScanAgain = vi.fn();
    render(
      <ScanFailurePanel
        failure={{
          kind: new UnrecognisedValue("solar_flare"),
          message: "The sun.",
        }}
        onScanAgain={onScanAgain}
        onChangeAddress={noop}
        scanning={false}
      />,
    );
    expect(screen.getByText(/doesn't recognise/)).toBeTruthy();
    expect(screen.getByText(/solar_flare/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scan again" }));
    expect(onScanAgain).toHaveBeenCalledOnce();
  });

  it("offers no 'Scan again' for a target we refused, only a new address", () => {
    render(
      <ScanFailurePanel
        failure={{ kind: "blocked_by_guardrail", message: "private address" }}
        onScanAgain={noop}
        onChangeAddress={noop}
        scanning={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Scan again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Change address" })).toBeTruthy();
  });

  it("disables 'Scan again' while a scan is already running", () => {
    render(
      <ScanFailurePanel
        failure={{ kind: "timeout", message: "slow" }}
        onScanAgain={noop}
        onChangeAddress={noop}
        scanning
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Scan again" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("LastScan", () => {
  const at = "2026-09-10T15:00:00.000Z";

  it("says 'Never scanned' rather than rendering nothing", () => {
    render(<LastScan scan={null} />);
    expect(screen.getByText("Never scanned")).toBeTruthy();
  });

  it.each([
    ["queued", "Queued"],
    ["crawling", "Scanning"],
    ["parked", "Needs sign-in"],
    ["completed", "Complete"],
    ["failed", "Failed"],
  ])("%s reads %s (not the run vocabulary's 'Pass')", (status, label) => {
    render(<LastScan scan={{ status, updated_at: at }} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("Pass")).toBeNull();
  });

  it("an unrecognised status is shown as unrecognised, with the raw value", () => {
    render(
      <LastScan
        scan={{ status: new UnrecognisedValue("quantum"), updated_at: at }}
      />,
    );
    expect(screen.getByText(/quantum/)).toBeTruthy();
  });
});
