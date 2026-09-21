import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import {
  approvability,
  initialReview,
  isWrite,
  move,
  reviewSummary,
  selectedStepIds,
  toggleLeftOut,
  type PlanStep,
} from "./reviewState";
import { PlanStepRow } from "./PlanStepRow";
import { PlanReview } from "./PlanReview";
import { ApprovedPlan } from "./ApprovedPlan";

afterEach(cleanup);

let n = 0;
function step(over: Partial<PlanStep> = {}): PlanStep {
  n += 1;
  return {
    id: `s${n}`,
    index: n - 1,
    description: `Step ${n}`,
    action: "click",
    input: null,
    action_class: "read",
    binding: { type: "page", page_url: "https://x.example.com/" },
    blocked: null,
    ...over,
  };
}
const ungrounded = (over: Partial<PlanStep> = {}) =>
  step({
    binding: {
      type: "ungrounded",
      reason_code: "ambiguous_element",
      reason: "two matched",
    },
    ...over,
  });
const blocked = (over: Partial<PlanStep> = {}) =>
  step({
    action_class: "write",
    blocked: { reason_code: "read_only_tier", message: "read-only account" },
    ...over,
  });

describe("approvability and effect", () => {
  it("only a grounded, unblocked step may be approved", () => {
    expect(approvability(step())).toEqual({ ok: true });
    expect(approvability(ungrounded())).toEqual({
      ok: false,
      why: "ungrounded",
    });
    expect(approvability(blocked())).toEqual({ ok: false, why: "blocked" });
  });
  it("an unknown action class is treated as a write (contract safety rule)", () => {
    expect(isWrite(step({ action_class: "read" }))).toBe(false);
    expect(isWrite(step({ action_class: "write" }))).toBe(true);
    expect(
      isWrite(step({ action_class: new UnrecognisedValue("teleport") })),
    ).toBe(true);
  });
});

describe("review state (the person's edits)", () => {
  const a = step();
  const b = step();
  const c = step();
  const bad = ungrounded();
  const steps = [a, bad, b, c];

  it("selection is the ordered approvable, non-left-out ids", () => {
    let r = initialReview(steps);
    expect(selectedStepIds(r, steps)).toEqual([a.id, b.id, c.id]);
    r = move(r, c.id, -1); // swap with b
    expect(selectedStepIds(r, steps)).toEqual([a.id, c.id, b.id]);
    r = toggleLeftOut(r, a);
    expect(selectedStepIds(r, steps)).toEqual([c.id, b.id]);
  });

  it("a step that can't be approved can never be selected, whatever the edits", () => {
    let r = initialReview(steps);
    r = toggleLeftOut(r, bad); // no-op
    expect(r.leftOut.has(bad.id)).toBe(false);
    r = move(r, bad.id, 1);
    expect(selectedStepIds(r, steps)).not.toContain(bad.id);
    expect(
      selectedStepIds({ order: [bad.id, a.id], leftOut: new Set() }, steps),
    ).toEqual([a.id]);
  });

  it("moving off either end is a no-op, and editing never mutates the plan", () => {
    const frozen = steps.map((s) => ({ ...s }));
    const r = initialReview(steps);
    expect(move(r, a.id, -1)).toBe(r);
    expect(move(r, c.id, 1)).toBe(r);
    toggleLeftOut(move(r, b.id, -1), b);
    expect(steps).toEqual(frozen);
  });

  it("the summary accounts for every step: selected + left out + not approvable = total", () => {
    const r = toggleLeftOut(initialReview(steps), b);
    const s = reviewSummary(r, steps);
    expect(s).toMatchObject({
      total: 4,
      selected: 2,
      leftOutByYou: 1,
      notApprovable: 1,
    });
    expect(s.selected + s.leftOutByYou + s.notApprovable).toBe(s.total);
  });
});

describe("PlanStepRow", () => {
  it("shows an ungrounded step in place with its reason, and offers no way to include it", () => {
    render(
      <ul>
        <PlanStepRow
          step={ungrounded()}
          position={{ kind: "not-approvable" }}
          controls={{
            canMoveUp: false,
            canMoveDown: false,
            onMove: vi.fn(),
            onToggle: vi.fn(),
          }}
        />
      </ul>,
    );
    expect(screen.getByText("Not grounded")).toBeTruthy();
    expect(screen.getByTestId("step-binding").textContent).toMatch(
      /ambiguous element.*two matched/,
    );
    expect(screen.queryByRole("button", { name: /^Leave out:/ })).toBeNull();
  });

  it("shows a blocked step with the server's reason", () => {
    render(
      <ul>
        <PlanStepRow step={blocked()} position={{ kind: "not-approvable" }} />
      </ul>,
    );
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getAllByText(/read-only account/).length).toBeGreaterThan(0);
  });

  it("scraped text is inert: descriptions, labels, locators, inputs", () => {
    const hostile = step({
      description: '<img src=x onerror="alert(1)">',
      input: "<b>bold</b>",
      binding: {
        type: "element",
        element_id: "el",
        label: "<script>x</script>",
        role: null,
        page_url: "https://x.example.com/",
        locator: "a".repeat(400),
        uniquely_locatable: true,
      },
    });
    const { container } = render(
      <ul>
        <PlanStepRow step={hostile} position={{ kind: "will-run", nth: 1 }} />
      </ul>,
    );
    expect(container.querySelector("img, b, script, a")).toBeNull();
    expect(container.textContent).toContain("onerror");
    expect(container.textContent).toContain("(no role)");
  });

  it("an unrecognised action class says it is treated as a write", () => {
    render(
      <ul>
        <PlanStepRow
          step={step({ action_class: new UnrecognisedValue("teleport") })}
          position={{ kind: "will-run", nth: 1 }}
        />
      </ul>,
    );
    expect(screen.getByTestId("step-effect").textContent).toMatch(
      /Changes state.*teleport.*treated as a write/,
    );
  });
});

describe("PlanStepRow accessibility", () => {
  it("a step with no controls is a keyboard stop, and its accessible description says why it can't run", () => {
    render(
      <ul>
        <PlanStepRow
          step={blocked({ id: "b1", description: "Click Submit" })}
          position={{ kind: "not-approvable" }}
          controls={{
            canMoveUp: false,
            canMoveDown: false,
            onMove: vi.fn(),
            onToggle: vi.fn(),
          }}
        />
        <PlanStepRow
          step={ungrounded({ id: "u1", description: "Click Remove" })}
          position={{ kind: "not-approvable" }}
        />
      </ul>,
    );
    for (const id of ["b1", "u1"]) {
      const li = screen.getByTestId(`plan-step-${id}`);
      expect(li.getAttribute("tabindex")).toBe("0");
      expect(li.getAttribute("role")).toBe("group");
      const described = document.getElementById(
        li.getAttribute("aria-describedby")!,
      )!;
      expect(described.textContent).toMatch(/cannot be approved/i);
    }
    expect(document.getElementById("b1-state")!.textContent).toMatch(
      /Blocked.*read-only account/,
    );
    expect(document.getElementById("u1-state")!.textContent).toMatch(
      /Not grounded.*ambiguous element.*two matched/,
    );
  });

  it("a step WITH controls is not an extra tab stop, but is a named group its buttons sit in", () => {
    render(
      <ul>
        <PlanStepRow
          step={step({ id: "g1", description: "Open it" })}
          position={{ kind: "will-run", nth: 1 }}
          controls={{
            canMoveUp: false,
            canMoveDown: true,
            onMove: vi.fn(),
            onToggle: vi.fn(),
          }}
        />
      </ul>,
    );
    const li = screen.getByTestId("plan-step-g1");
    expect(li.getAttribute("tabindex")).toBeNull();
    expect(document.getElementById("g1-state")!.textContent).toBe(
      "Will run, number 1",
    );
    // Buttons are named by the step, and the visible label is inside the name (WCAG 2.5.3).
    expect(
      screen.getByRole("button", { name: "Leave out: Open it" }).textContent,
    ).toBe("Leave out");
    expect(
      screen.getByRole("button", { name: "Move down: Open it" }),
    ).toBeTruthy();
  });

  it("a left-out step's toggle is named for what it does now, and says so in its state", () => {
    render(
      <ul>
        <PlanStepRow
          step={step({ id: "l1", description: "Open it" })}
          position={{ kind: "left-out" }}
          controls={{
            canMoveUp: false,
            canMoveDown: false,
            onMove: vi.fn(),
            onToggle: vi.fn(),
          }}
        />
      </ul>,
    );
    expect(
      screen.getByRole("button", { name: "Put back: Open it" }).textContent,
    ).toBe("Put back");
    expect(document.getElementById("l1-state")!.textContent).toMatch(
      /Left out by you/,
    );
  });
});

describe("PlanReview", () => {
  const good1 = step();
  const good2 = step();
  const steps = [good1, ungrounded(), blocked(), good2];

  it("approves exactly the selected ids, in the person's order", () => {
    const onApprove = vi.fn();
    render(
      <PlanReview
        intent="do it"
        steps={steps}
        busy={false}
        error={null}
        onApprove={onApprove}
        onDiscard={vi.fn()}
      />,
    );
    const down = () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: `Move down: ${good1.description}`,
        }),
      );
    down(); // past the ungrounded step
    down(); // past the blocked step
    down(); // past good2
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and run 2 steps" }),
    );
    expect(onApprove).toHaveBeenCalledWith([good2.id, good1.id]);
  });

  it("states every exclusion and disables approval when nothing is selected", () => {
    render(
      <PlanReview
        intent="do it"
        steps={steps}
        busy={false}
        error={null}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByTestId("approval-summary").textContent).toMatch(
      /2 of 4 proposed steps/,
    );
    expect(screen.getByTestId("approval-summary").textContent).toMatch(
      /2 can't be approved/,
    );
    for (const b of screen.getAllByRole("button", { name: /^Leave out:/ }))
      fireEvent.click(b);
    expect(screen.getByTestId("approval-summary").textContent).toMatch(
      /No steps selected/,
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Approve and run/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("the approval summary is a polite live region, so a change is announced", () => {
    render(
      <PlanReview
        intent="x"
        steps={steps}
        busy={false}
        error={null}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    const summary = screen.getByTestId("approval-summary");
    expect(summary.getAttribute("role")).toBe("status");
    expect(summary.getAttribute("aria-live")).toBe("polite");
  });

  it("while an approval is in flight, both actions are disabled (no double-fire)", () => {
    render(
      <PlanReview
        intent="x"
        steps={steps}
        busy
        error={null}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Working…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Discard this plan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("ApprovedPlan", () => {
  it("lists what was approved in order AND what was not run, with why", () => {
    const a = step();
    const b = step();
    const g = ungrounded();
    render(
      <ApprovedPlan
        steps={[a, g, b]}
        approvedIds={[b.id, a.id]}
        approvedAt="2026-09-10T12:00:00Z"
      />,
    );
    expect(screen.getByText("Approved to run (2)")).toBeTruthy();
    expect(screen.getByTestId("excluded-steps").textContent).toMatch(
      /Not run \(1\).*Not grounded/,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
