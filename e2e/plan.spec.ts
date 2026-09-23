import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B5 in a real browser: intent in, PROPOSED plan out, review and
 * edit, and only then approve. Covers the gate's integrity: ungrounded and
 * blocked steps shown in place and unapprovable; every exclusion stated;
 * the approval that reaches the server is exactly what the person chose.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function propose(page: Page, intent: string) {
  await page.goto("/targets");
  await page
    .getByTestId("target-tgt_checkout")
    .getByRole("link", { name: "Compose test" })
    .click();
  await page.getByLabel("What do you want to test?").fill(intent);
  await page.getByRole("button", { name: "Propose a plan" }).click();
}

const step = (page: Page, n: number) => page.getByTestId(`plan-step-pstp_${n}`);

test("the compose form promises nothing runs, and needs an intent", async ({
  page,
}) => {
  await page.goto("/targets/tgt_checkout/compose");
  await expect(page.getByText("nothing runs until you approve.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Propose a plan" }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/plan-compose.png" });
});

test("a proposed plan is shown before anything executes, with every step's binding", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByTestId("plan-generating")).toBeVisible();
  await expect(page.getByTestId("plan-intent")).toHaveText("Buy something", {
    timeout: 10_000,
  });
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible();

  // All five steps are listed - none dropped.
  await expect(page.locator('[data-testid^="plan-step-"]')).toHaveCount(5);

  // A grounded step names the inventory element it is bound to.
  await expect(step(page, 3).getByTestId("step-binding")).toContainText(
    "inventory element",
  );
  await expect(step(page, 3).getByTestId("step-binding")).toContainText(
    "(link)",
  );
  // A page step names the page.
  await expect(step(page, 1).getByTestId("step-binding")).toContainText(
    "the page",
  );

  // Nothing ran: the runs list has no run for this plan (no navigation happened).
  await expect(page).toHaveURL(/compose\?plan=plan_/);
  await page.screenshot({
    path: "test-results/plan-review.png",
    fullPage: true,
  });
});

test("ungrounded steps are shown in place with their reason, and cannot be approved", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });

  const ambiguous = step(page, 4);
  await expect(ambiguous).toContainText("Not grounded");
  await expect(ambiguous.getByTestId("step-binding")).toContainText(
    "ambiguous element",
  );
  await expect(ambiguous).toContainText("More than one element matched");
  await expect(
    ambiguous.getByRole("button", { name: "Leave out" }),
  ).toHaveCount(0);
  await expect(ambiguous).toContainText("can't be approved");

  // The credential step: the engine refuses; the reason says so.
  const credential = step(page, 5);
  await expect(credential.getByTestId("step-binding")).toContainText(
    "credential required",
  );
  await expect(credential).toContainText("never does");
});

test("a write step on a read-only account is blocked with the server's reason", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  const write = step(page, 2);
  await expect(write).toContainText("Blocked");
  await expect(write).toContainText("read-only tier");
  await expect(write.getByTestId("step-effect")).toContainText("Changes state");
  await expect(write.getByRole("button", { name: "Leave out" })).toHaveCount(0);
});

test("every exclusion is stated, and the summary counts only what will run", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });

  const summary = page.getByTestId("approval-summary");
  await expect(summary).toContainText("This will run 2 of 5 proposed steps");
  await expect(summary).toContainText("3 can't be approved");

  await step(page, 3).getByRole("button", { name: "Leave out" }).click();
  await expect(summary).toContainText("This will run 1 of 5 proposed steps");
  await expect(summary).toContainText("1 left out by you");
  await expect(step(page, 3)).toContainText("Left out");
  await expect(
    page.getByRole("button", { name: "Approve and run 1 step" }),
  ).toBeEnabled();

  await step(page, 1).getByRole("button", { name: "Leave out" }).click();
  await expect(summary).toContainText("No steps selected");
  await expect(
    page.getByRole("button", { name: /Approve and run/ }),
  ).toBeDisabled();

  await step(page, 3).getByRole("button", { name: "Put back" }).click();
  await expect(summary).toContainText("This will run 1 of 5");
});

test("approval sends exactly the chosen steps in the chosen order, then starts a run", async ({
  page,
}) => {
  await propose(page, "writes: Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  // Write steps are not blocked for this account.
  await expect(step(page, 2)).not.toContainText("Blocked");
  await expect(page.getByTestId("approval-summary")).toContainText(
    "This will run 3 of 5",
  );
  await expect(page.getByTestId("approval-summary")).toContainText(
    "1 of the steps that will run change state",
  );

  // Reorder: move step 3 to the top of the approvable steps.
  await step(page, 3)
    .getByRole("button", { name: /^Move up:/ })
    .click();
  await step(page, 3)
    .getByRole("button", { name: /^Move up:/ })
    .click();
  await expect(step(page, 3)).toContainText("#1");

  const approveRequest = page.waitForRequest(
    (r) => r.url().includes("/approve") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Approve and run 3 steps" }).click();
  const body = (await approveRequest).postDataJSON();
  expect(body).toEqual({ step_ids: ["pstp_3", "pstp_1", "pstp_2"] });

  // The record stays on screen, and the run has started.
  await expect(page.getByTestId("run-started")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("approved-plan")).toContainText(
    "Approved to run (3)",
  );
  await page.getByRole("link", { name: "Watch this run" }).click();
  await expect(page).toHaveURL(/\/runs\/run_/);
});

test("an approved plan is a permanent record: what ran and what did not, with why", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Approve and run 2 steps" }).click();
  await expect(page.getByTestId("run-started")).toBeVisible({
    timeout: 10_000,
  });

  const record = page.getByTestId("approved-plan");
  await expect(record).toBeVisible();
  await expect(record).toContainText("Approved to run (2)");
  await expect(page.getByTestId("plan-scope")).toContainText(
    "2 of 5 proposed steps approved to run. 3 did not run: 0 left out by you, 3 the system could not approve.",
  );
  await expect(page.getByTestId("excluded-by-system")).toContainText(
    "The system could not approve (3)",
  );
  await expect(page.getByTestId("excluded-by-system")).toContainText(
    "Not grounded",
  );
  await expect(page.getByTestId("excluded-by-system")).toContainText("Blocked");
  await expect(page.getByTestId("excluded-by-user")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Leave out" })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/plan-approved.png",
    fullPage: true,
  });
});

test("discarding leaves nothing behind and returns to the form", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Discard this plan" }).click();
  await expect(page.getByLabel("What do you want to test?")).toBeVisible();
  await expect(page).not.toHaveURL(/plan=/);
});

test("a planner failure is a designed state with a way forward", async ({
  page,
}) => {
  await propose(page, "fail: nonsense");
  await expect(page.getByTestId("plan-failed")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("plan-failed")).toContainText(
    "couldn't turn that request into steps",
  );
  await page
    .getByRole("button", { name: "Change the request and try again" })
    .click();
  await expect(page.getByLabel("What do you want to test?")).toHaveValue(
    "fail: nonsense",
  );
});

test("compose needs a finished scan; unknown targets say so", async ({
  page,
}) => {
  await page.goto("/targets/tgt_empty/compose");
  await expect(page.getByText("Scan this target first")).toBeVisible();
  await page.goto("/targets/tgt_nope/compose");
  await expect(page.getByText("Target not found")).toBeVisible();
});

test("keyboard: every step - including the ones that can't run - is reachable by Tab, and announced with why", async ({
  page,
}) => {
  await propose(page, "Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });

  const list = page.getByRole("list", { name: "Proposed steps" });
  await list.getByRole("button").first().focus();

  const visited = new Set<string>();
  for (let i = 0; i < 16; i++) {
    const id = await page.evaluate(
      () =>
        document.activeElement
          ?.closest('[data-testid^="plan-step-"]')
          ?.getAttribute("data-testid") ?? null,
    );
    if (id) visited.add(id);
    await page.keyboard.press("Tab");
  }
  // All five steps got a keyboard stop, not just the two with buttons.
  expect([...visited].sort()).toEqual(
    [1, 2, 3, 4, 5].map((n) => `plan-step-pstp_${n}`),
  );

  // The blocked step, focused by keyboard, is named and described with the reason.
  const blockedRow = step(page, 2);
  await blockedRow.focus();
  await expect(blockedRow).toBeFocused();
  await expect(blockedRow).toHaveAccessibleName('Click "Submit"');
  await expect(blockedRow).toHaveAccessibleDescription(
    /Blocked, cannot be approved: This account is on the read-only tier/,
  );
  const ungrounded = step(page, 4);
  await ungrounded.focus();
  await expect(ungrounded).toHaveAccessibleDescription(
    /Not grounded, cannot be approved: ambiguous element/,
  );

  // Changing the selection is announced through the live summary.
  await expect(page.getByTestId("approval-summary")).toHaveAttribute(
    "aria-live",
    "polite",
  );
});

test("the record keeps the person's exclusions apart from the system's, in words and counts", async ({
  page,
}) => {
  await propose(page, "writes: Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  // Writes are allowed for this account: 1, 2, 3 approvable; 4 and 5 are not.
  await step(page, 3)
    .getByRole("button", { name: /^Leave out:/ })
    .click();
  await page.getByRole("button", { name: "Approve and run 2 steps" }).click();
  await expect(page.getByTestId("run-started")).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByTestId("plan-scope")).toContainText(
    "2 of 5 proposed steps approved to run. 3 did not run: 1 left out by you, 2 the system could not approve.",
  );
  await expect(page.getByTestId("excluded-by-user")).toContainText(
    "Left out by you (1)",
  );
  await expect(page.getByTestId("excluded-by-user")).toContainText("Left out");
  await expect(page.getByTestId("excluded-by-system")).toContainText(
    "The system could not approve (2)",
  );
  // The step the person left out is NOT filed under the system's exclusions, or vice versa.
  await expect(page.getByTestId("excluded-by-system")).not.toContainText(
    "Left out",
  );
  await expect(page.getByTestId("excluded-by-user")).not.toContainText(
    "Not grounded",
  );
  await page.screenshot({
    path: "test-results/plan-record-split.png",
    fullPage: true,
  });
});

test("a plan is read against the inventory it came from, and the runs list labels each coverage figure with what it counts", async ({
  page,
}) => {
  await propose(page, "writes: Buy something");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  // 5 steps drawn from an inventory of 30 elements, touching 2 of them.
  await expect(page.getByTestId("plan-inventory")).toContainText(
    "These 5 steps touch 2 of the 30 elements in the inventory this plan was made from",
  );

  await step(page, 3)
    .getByRole("button", { name: /^Leave out:/ })
    .click();
  await page.getByRole("button", { name: "Approve and run 2 steps" }).click();
  await expect(page.getByTestId("run-started")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("plan-inventory")).toBeVisible();

  await page.getByRole("link", { name: "Runs", exact: true }).click();
  await expect(page).toHaveURL(/\/runs$/);
  // The plan run says "plan steps"; the suite runs say "elements". Never a bare "x/y".
  const plan = page.locator(
    '[data-testid="pass-rate-coverage"][data-basis="plan"]',
  );
  await expect(plan).toHaveCount(1);
  await expect(plan).toContainText("2 of 5 plan steps covered");
  const suites = page.locator(
    '[data-testid="pass-rate-coverage"][data-basis="inventory"]',
  );
  expect(await suites.count()).toBeGreaterThan(0);
  await expect(suites.first()).toContainText("elements covered");
  await page.screenshot({
    path: "test-results/runs-basis.png",
    fullPage: true,
  });
});
