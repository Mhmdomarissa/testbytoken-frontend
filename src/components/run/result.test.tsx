import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Screenshot } from "./Screenshot";
import { EngineReport } from "./EngineReport";

afterEach(cleanup);

describe("Screenshot", () => {
  it("opens a larger view in a dialog on click, and is never a link to anywhere", () => {
    const { container } = render(
      <Screenshot url="/screenshots/0.png" alt="Step 1" />,
    );
    expect(container.querySelector("a")).toBeNull();
    fireEvent.click(screen.getByTestId("screenshot-thumb"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Step 1")).toBeTruthy();
  });

  it("a failed image load says so instead of showing a broken image", () => {
    render(<Screenshot url="/screenshots/broken.png" alt="Step 1" />);
    const img = document.querySelector("img")!;
    fireEvent.error(img);
    expect(screen.getByTestId("screenshot-failed")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("EngineReport", () => {
  it("loads via fetch and renders the HTML with srcDoc, never src (see the file comment on why)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<h1>Report</h1>"),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EngineReport url="/runs/run_1/report" />);
    expect(screen.getByRole("status")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("engine-report")).toBeTruthy(),
    );
    const frame = screen.getByTestId("engine-report") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBeNull();
    expect(frame.getAttribute("srcdoc")).toBe("<h1>Report</h1>");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(fetchMock).toHaveBeenCalledWith("/runs/run_1/report");
    vi.unstubAllGlobals();
  });

  it("a failed fetch is a retryable-looking error, not a blank or a broken frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    render(<EngineReport url="/runs/run_1/report" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("engine-report")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("changing url re-fetches and shows loading again, not the stale report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>first</p>"),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>second</p>"),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<EngineReport url="/runs/run_1/report" />);
    await waitFor(() =>
      expect(
        (screen.getByTestId("engine-report") as HTMLIFrameElement).getAttribute(
          "srcdoc",
        ),
      ).toBe("<p>first</p>"),
    );
    rerender(<EngineReport url="/runs/run_2/report" />);
    await waitFor(() =>
      expect(
        (screen.getByTestId("engine-report") as HTMLIFrameElement).getAttribute(
          "srcdoc",
        ),
      ).toBe("<p>second</p>"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});

vi.mock("@/lib/api/queries/proofs", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/queries/proofs")
  >("@/lib/api/queries/proofs");
  return { ...actual, useSetShare: vi.fn() };
});
vi.mock("@/components/ui/toast", () => ({ toast: { add: vi.fn() } }));

import { useSetShare } from "@/lib/api/queries/proofs";
import { SharePanel } from "./SharePanel";

describe("SharePanel", () => {
  it("off: offers to create a link, and nothing looks shared", () => {
    vi.mocked(useSetShare).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSetShare>);
    render(<SharePanel proofId="proof_1" share={null} />);
    expect(screen.getByTestId("share-off")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("creating a link calls the mutation with enabled: true", () => {
    const mutate = vi.fn();
    vi.mocked(useSetShare).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSetShare>);
    render(<SharePanel proofId="proof_1" share={null} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create a public link" }),
    );
    expect(mutate).toHaveBeenCalledWith({ enabled: true });
  });

  it("on: shows the real link (never a bearer token appended) and revoking sends enabled: false", () => {
    const mutate = vi.fn();
    vi.mocked(useSetShare).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSetShare>);
    render(
      <SharePanel
        proofId="proof_1"
        share={{
          url: "https://testbytoken.example/p/share_abc",
          enabled: true,
          token: "share_abc",
        }}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("https://testbytoken.example/p/share_abc");
    expect(input.readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    expect(mutate).toHaveBeenCalledWith({ enabled: false });
  });

  it("a share.enabled: false record (revoked) is shown as off, not on", () => {
    vi.mocked(useSetShare).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSetShare>);
    render(
      <SharePanel
        proofId="proof_1"
        share={{
          url: "https://testbytoken.example/p/share_abc",
          enabled: false,
          token: "share_abc",
        }}
      />,
    );
    expect(screen.getByTestId("share-off")).toBeTruthy();
  });
});
