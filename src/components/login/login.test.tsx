import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { checkViewUrl, ticketIsFresh, TICKET_MAX_AGE_MS } from "./viewUrl";
import { loginFailureCopy } from "./failureCopy";
import { LoginPanel, type LoginSession } from "./LoginPanel";

afterEach(cleanup);

const APP = "https://app.testbytoken.example";
const LIVE = "https://live-browser.testbytoken.example/s/lgn_1?ticket=abc123";

function session(over: Partial<LoginSession> = {}): LoginSession {
  return {
    id: "lgn_1",
    workspace_id: "w",
    target_id: "t",
    status: "ready",
    view_url: LIVE,
    expires_at: "2026-09-21T12:00:00.000Z",
    failure: null,
    created_at: "2026-09-21T11:50:00.000Z",
    updated_at: "2026-09-21T11:50:00.000Z",
    ...over,
  };
}

function panel(
  s: LoginSession,
  over: Partial<Parameters<typeof LoginPanel>[0]> = {},
) {
  const handlers = {
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    onRestart: vi.fn(),
  };
  const utils = render(
    <LoginPanel
      session={s}
      fetchedAt={1_000}
      now={2_000}
      appOrigin={APP}
      targetName="Checkout"
      busy={false}
      error={null}
      {...handlers}
      {...over}
    />,
  );
  return { ...utils, ...handlers };
}

describe("checkViewUrl: the live browser is on another origin, over https, or we refuse it", () => {
  it("accepts an https URL on a different origin and reports only its host", () => {
    expect(checkViewUrl(LIVE, APP)).toEqual({
      ok: true,
      href: LIVE,
      host: "live-browser.testbytoken.example",
    });
  });
  it.each([
    [null, "missing"],
    ["not a url", "invalid"],
    ["http://live-browser.example/s/1", "insecure"],
    ["javascript:alert(1)", "insecure"],
    ["https://app.testbytoken.example/s/1", "same_origin"],
    ["https://user:pass@live-browser.example/s/1", "invalid"],
  ])("refuses %s (%s)", (url, reason) => {
    expect(checkViewUrl(url, APP)).toEqual({ ok: false, reason });
  });
});

describe("ticketIsFresh: a single-use ticket lives at most 60s", () => {
  it("is fresh only while the reading is young, and never for an unknown reading", () => {
    expect(ticketIsFresh(1_000, 1_000 + TICKET_MAX_AGE_MS)).toBe(true);
    expect(ticketIsFresh(1_000, 1_000 + TICKET_MAX_AGE_MS + 1)).toBe(false);
    expect(ticketIsFresh(0, 5)).toBe(false);
  });
});

describe("LoginPanel", () => {
  it("in `ready`, offers the browser as a new-tab link with no opener and no referrer - and never prints the ticket", () => {
    const { container } = panel(session());
    const link = screen.getByTestId("open-browser") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(LIVE);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("live-browser.testbytoken.example");
    expect(container.textContent).not.toContain("ticket");
    expect(container.textContent).not.toContain("abc123");
  });

  it("holds the link back while the reading is stale, rather than offering an expired ticket", () => {
    panel(session(), {
      fetchedAt: 1_000,
      now: 1_000 + TICKET_MAX_AGE_MS + 5_000,
    });
    expect(screen.queryByTestId("open-browser")).toBeNull();
    expect(screen.getByText(/Refreshing the link/)).toBeTruthy();
  });

  it("refuses a view_url on the app's own origin and says nothing was opened", () => {
    panel(session({ view_url: "https://app.testbytoken.example/s/1" }));
    expect(screen.queryByTestId("open-browser")).toBeNull();
    expect(screen.getByTestId("unsafe-view-url").textContent).toMatch(
      /isn't safe to open.*same origin.*Nothing was opened/,
    );
  });

  it("has no input of any kind in any state - there is nowhere to type a credential", () => {
    const statuses = [
      "provisioning",
      "ready",
      "in_progress",
      "completed",
      "expired",
      "failed",
      "cancelled",
    ] as const;
    for (const status of statuses) {
      const { container, unmount } = panel(
        session({
          status,
          view_url:
            status === "ready" || status === "in_progress" ? LIVE : null,
          failure:
            status === "failed"
              ? { kind: "no_session_detected", message: "m" }
              : null,
        }),
      );
      expect(
        container.querySelectorAll("input, textarea, select, [contenteditable]")
          .length,
      ).toBe(0);
      unmount();
    }
    const odd = panel(session({ status: new UnrecognisedValue("weird") }));
    expect(odd.container.querySelectorAll("input, textarea").length).toBe(0);
  });

  it("`complete` is only the customer's statement: the button sends no data", () => {
    const { onComplete } = panel(session({ status: "in_progress" }));
    fireEvent.click(
      screen.getByRole("button", { name: "I've finished signing in" }),
    );
    expect(onComplete).toHaveBeenCalledWith();
  });

  it("says who the state belongs to: completed states what was and wasn't kept", () => {
    panel(session({ status: "completed", view_url: null }));
    expect(screen.getByText(/We captured your session/)).toBeTruthy();
    expect(screen.getByText(/never the session itself/)).toBeTruthy();
    expect(screen.queryByTestId("open-browser")).toBeNull();
  });

  it.each([
    ["expired", /ran out of time.*Nothing was captured/],
    ["cancelled", /Cancelled\. Nothing was captured/],
  ] as const)(
    "%s is a designed state with a way to start over",
    (status, text) => {
      const { onRestart } = panel(session({ status, view_url: null }));
      expect(screen.getByTestId(`login-${status}`).textContent).toMatch(text);
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(onRestart).toHaveBeenCalledOnce();
    },
  );

  it("failed shows the kind's meaning and the server's message as text, and can be retried", () => {
    const { onRestart } = panel(
      session({
        status: "failed",
        view_url: null,
        failure: {
          kind: "no_session_detected",
          message: '<img src=x onerror="alert(1)"> nothing',
        },
      }),
    );
    expect(screen.getByText("We didn't see a signed-in session")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/onerror/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("an unrecognised status is shown as unrecognised, with the raw value, and offers no session action", () => {
    panel(session({ status: new UnrecognisedValue("teleporting") }));
    expect(screen.getByTestId("login-unrecognised").textContent).toMatch(
      /teleporting/,
    );
    expect(
      screen.queryByRole("button", { name: /finished signing in/ }),
    ).toBeNull();
  });
});

describe("loginFailureCopy", () => {
  it("has specific guidance for each kind in the contract and a generic fallback", () => {
    const generic = loginFailureCopy(new UnrecognisedValue("x")).title;
    for (const kind of [
      "browser_unavailable",
      "no_session_detected",
      "internal",
    ]) {
      expect(loginFailureCopy(kind).title).not.toBe(generic);
    }
    expect(loginFailureCopy("constructor").title).toBe(generic);
  });
});
