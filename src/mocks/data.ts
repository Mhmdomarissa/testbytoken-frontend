import type { z } from "zod";
import type {
  ElementSchema,
  ModuleSchema,
  PageSchema,
  ProofSchema,
  ProofSnapshotSchema,
  RunDetailSchema,
  ScanSchema,
  StepSchema,
  SuiteSchema,
  SuiteVersionSchema,
  TargetSchema,
  WorkspaceSchema,
} from "@/lib/contract";

/**
 * The mock's fixture data. This is the contract's reference implementation,
 * not a stub - every shape here is a real, type-checked instance of a
 * contract schema, and it deliberately includes the ugly cases real data
 * produces: failures, unicode, absurdly long labels, a hostile page title,
 * a module with nothing locatable, and an account with no history at all.
 *
 * XSS fixture: PAGE_XSS_TITLE below is exactly the string
 * docs/PHASE_A.md's A6 task calls out. It must never be rendered via
 * dangerouslySetInnerHTML (banned repo-wide, see CLAUDE.md and
 * eslint.config.mjs) - src/mocks/xss-safety.test.tsx renders it through
 * plain JSX text interpolation and asserts it stays inert.
 */

export const PAGE_XSS_TITLE = "<img src=x onerror=alert(1)>";

const now = "2026-09-10T12:00:00Z";

// ---------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------

export const workspace: z.infer<typeof WorkspaceSchema> = {
  id: "wksp_demo",
  status: "ready",
  error: null,
  created_at: now,
  updated_at: now,
};

// ---------------------------------------------------------------------
// Targets - includes one with zero history (the "empty account" case)
// ---------------------------------------------------------------------

export const targetCheckout: z.infer<typeof TargetSchema> = {
  id: "tgt_checkout",
  name: "Checkout",
  base_url: "https://checkout.example.com",
  environment: "production",
  // Overlaid with the real most-recent scan by handlers/targets.ts (a
  // fixture can't know about scans started after it was written).
  last_scan: null,
  created_at: now,
  updated_at: now,
};

export const targetEmpty: z.infer<typeof TargetSchema> = {
  id: "tgt_empty",
  name: "Freshly added target",
  base_url: "https://new.example.com",
  environment: "staging",
  last_scan: null, // genuinely never scanned - the "empty account" case
  created_at: now,
  updated_at: now,
};

/**
 * A target whose scan FAILED, so scan failure is a designed state a screen
 * can be built against (B0.5 B4) rather than a status with no reason.
 */
export const targetUnreachable: z.infer<typeof TargetSchema> = {
  id: "tgt_unreachable",
  name: "Legacy admin",
  base_url: "https://legacy-admin.example.com",
  environment: "test",
  last_scan: null,
  created_at: now,
  updated_at: now,
};

export const targets = [targetCheckout, targetEmpty, targetUnreachable];

// ---------------------------------------------------------------------
// Scan - modules/pages, including the XSS title, a zero-locatable module,
// and very long / unicode labels.
// ---------------------------------------------------------------------

const pageHome: z.infer<typeof PageSchema> = {
  id: "page_home",
  url: "https://checkout.example.com/",
  title: "Checkout — Fast, secure payment",
};

const pageSettings: z.infer<typeof PageSchema> = {
  id: "page_settings",
  url: "https://checkout.example.com/settings",
  // The XSS fixture. A real crawl reflects whatever the target page's
  // <title> actually contains - including, sometimes, someone else's
  // injected markup. It must reach the UI as inert text.
  title: PAGE_XSS_TITLE,
};

export const modCheckout: z.infer<typeof ModuleSchema> = {
  id: "mod_checkout",
  name: "Checkout flow",
  pages: [pageHome],
  element_count: 24,
  elements_uniquely_locatable_count: 21,
};

// The honest empty state: a module where nothing could be uniquely
// located, so nothing got generated - zero, not "some".
export const modSettings: z.infer<typeof ModuleSchema> = {
  id: "mod_settings",
  name: "Account settings",
  pages: [pageSettings],
  element_count: 6,
  elements_uniquely_locatable_count: 0,
};

export const scanCheckout: z.infer<typeof ScanSchema> = {
  id: "scan_checkout_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  target_url: targetCheckout.base_url,
  status: "completed",
  parked_reason: null,
  failure: null,
  login_session_id: null,
  modules: [modCheckout, modSettings],
  created_at: now,
  updated_at: now,
};

// A parked scan - the login-handoff case. No credentials anywhere in this
// fixture or in the API that resumes it (CLAUDE.md).
export const scanParked: z.infer<typeof ScanSchema> = {
  id: "scan_parked_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  target_url: targetCheckout.base_url,
  status: "parked",
  parked_reason: "login_required",
  failure: null,
  login_session_id: null,
  modules: [modCheckout],
  created_at: now,
  updated_at: now,
};

// A failed scan: the structured KIND is what decides what the user does
// next (unreachable -> check the URL; refused -> allow our engine; ...).
export const scanFailed: z.infer<typeof ScanSchema> = {
  id: "scan_failed_1",
  workspace_id: workspace.id,
  target_id: targetUnreachable.id,
  target_url: targetUnreachable.base_url,
  status: "failed",
  parked_reason: null,
  failure: {
    kind: "unreachable",
    message:
      "We couldn't reach legacy-admin.example.com - the name did not resolve. Check the address, or that the site is up.",
  },
  login_session_id: null,
  modules: [],
  created_at: now,
  updated_at: now,
};

export const scans = [scanCheckout, scanParked, scanFailed];

// ---------------------------------------------------------------------
// Inspect - element inventories per module, including the zero-locatable
// module and elements with very long / unicode labels.
// ---------------------------------------------------------------------

const longLabel =
  "Continue to payment — by proceeding you agree to the Terms of Service, " +
  "Privacy Policy, Refund Policy, and confirm that the billing address " +
  "entered above matches the cardholder's statement address exactly as " +
  "issued by their bank or financial institution";

const elementsByModule: Record<string, z.infer<typeof ElementSchema>[]> = {
  [modCheckout.id]: [
    {
      id: "el_submit",
      page_url: pageHome.url,
      label: "Submit",
      role: "button",
      locator: "#submit",
      locator_strategy: "css",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_long_label",
      page_url: pageHome.url,
      label: longLabel,
      role: "button",
      locator: "button[data-testid='continue-to-payment']",
      locator_strategy: "test_id",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_unicode",
      page_url: pageHome.url,
      label: "支払いを続ける 💳 — Продолжить оплату — متابعة الدفع",
      role: "link",
      locator: "//button[contains(., '支払い')]",
      locator_strategy: "xpath",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_duplicate",
      page_url: pageHome.url,
      label: "Remove",
      role: "button",
      locator: ".line-item button.remove",
      locator_strategy: "css",
      uniquely_locatable: false,
      reason_not_locatable: "duplicate_locator",
    },
  ],
  // Zero locatable, on purpose - every element here is false.
  [modSettings.id]: [
    {
      id: "el_settings_1",
      page_url: pageSettings.url,
      label: "Save",
      role: "button",
      locator: "button.save",
      locator_strategy: "css",
      uniquely_locatable: false,
      reason_not_locatable: "duplicate_locator",
    },
    {
      id: "el_settings_2",
      page_url: pageSettings.url,
      label: "Cancel",
      role: "button",
      locator: "button.cancel",
      locator_strategy: "css",
      uniquely_locatable: false,
      reason_not_locatable: "duplicate_locator",
    },
  ],
};

export function elementsForModule(
  moduleId: string,
): z.infer<typeof ElementSchema>[] | undefined {
  return elementsByModule[moduleId];
}

// ---------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------

export const suiteCheckout: z.infer<typeof SuiteSchema> = {
  id: "suite_checkout",
  target_id: targetCheckout.id,
  name: "Checkout — generated suite",
  latest_version: 2,
  created_at: now,
  updated_at: now,
};

export const suites = [suiteCheckout];

export const suiteCheckoutVersions: z.infer<typeof SuiteVersionSchema>[] = [
  {
    id: "sv_checkout_2",
    suite_id: suiteCheckout.id,
    version: 2,
    source_scan_id: scanCheckout.id,
    scenario_count: 21,
    created_at: now,
  },
  {
    id: "sv_checkout_1",
    suite_id: suiteCheckout.id,
    version: 1,
    source_scan_id: scanCheckout.id,
    scenario_count: 18,
    created_at: "2026-08-20T09:00:00Z",
  },
];

// ---------------------------------------------------------------------
// Runs - a healthy pass, a real failure, a long 64-step run, and one
// that's still "running" so the SSE path has something to stream.
// ---------------------------------------------------------------------

/** Session-scoped, resolved report URL (docs/API_CONTRACT.md) - served by handlers/runs.ts. */
export function reportUrl(runId: string): string {
  return `https://api.testbytoken.example/runs/${runId}/report`;
}

function step(
  index: number,
  overrides: Partial<z.infer<typeof StepSchema>> = {},
): z.infer<typeof StepSchema> {
  return {
    id: `stp_${index}`,
    plan_step_id: null,
    index,
    action: "click",
    target: "#submit",
    assertion: null,
    status: "pass",
    message: "OK",
    duration_ms: 420,
    screenshot_url: `https://screenshots.testbytoken.example/${index}.png`,
    ...overrides,
  };
}

export const runPassed: z.infer<typeof RunDetailSchema> = {
  id: "run_pass_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  suite_id: suiteCheckout.id,
  plan_id: null,
  login_session_id: null,
  report_url: reportUrl("run_pass_1"),
  status: "passed",
  pass_rate: 1,
  coverage: { generated: 21, candidate: 24 },
  token_cost: 4.2,
  proof_id: "proof_pass_1",
  started_at: "2026-09-10T11:00:00Z",
  finished_at: "2026-09-10T11:02:10Z",
  steps: [
    step(0, {
      action: "navigate",
      target: pageHome.url,
      message: "Loaded page",
    }),
    step(1, { action: "click", target: "#add-to-cart" }),
    step(2, { action: "fill", target: "#promo-code" }),
    step(3, { action: "click", target: "#submit", assertion: "is visible" }),
  ],
};

export const runFailed: z.infer<typeof RunDetailSchema> = {
  id: "run_fail_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  suite_id: suiteCheckout.id,
  plan_id: null,
  login_session_id: null,
  report_url: reportUrl("run_fail_1"),
  status: "failed",
  pass_rate: 0.75,
  coverage: { generated: 21, candidate: 24 },
  token_cost: 3.9,
  proof_id: "proof_fail_1",
  started_at: "2026-09-09T15:00:00Z",
  finished_at: "2026-09-09T15:01:47Z",
  steps: [
    step(0, { action: "navigate", target: pageHome.url }),
    step(1, { action: "click", target: "#add-to-cart" }),
    step(2, {
      action: "assert_visible",
      target: "#confirm-button",
      assertion: "is visible within 5000ms",
      status: "fail",
      message:
        'Expected element "#confirm-button" to be visible within 5000ms, ' +
        "but it was not found on the page. The element may be behind a " +
        "cookie-consent overlay that this scenario doesn't dismiss.",
      duration_ms: 5000,
      screenshot_url:
        "https://screenshots.testbytoken.example/run_fail_1/2.png",
    }),
    step(3, {
      action: "click",
      target: "#submit",
      status: "skipped",
      message: "Skipped after prior failure",
    }),
  ],
};

// Three stateful, time-based scenarios (Phase A review, §5) - their
// status/steps/pass_rate/finished_at below are placeholders overwritten by
// src/mocks/lifecycle.ts's computeRunState() every time they're fetched;
// what's here is just the part of the shape that doesn't change over
// time (ids, target, suite, coverage). See lifecycle.ts's
// LIVE_PASS_TIMELINE/LIVE_FAIL_TIMELINE/LIVE_STALL_TIMELINE for what
// actually happens and when.
function liveRunBase(id: string): z.infer<typeof RunDetailSchema> {
  return {
    id,
    workspace_id: workspace.id,
    target_id: targetCheckout.id,
    suite_id: suiteCheckout.id,
    plan_id: null,
    login_session_id: null,
    report_url: null,
    status: "running",
    pass_rate: 1,
    coverage: { generated: 21, candidate: 24 },
    token_cost: 1.1,
    proof_id: null,
    started_at: now,
    finished_at: null,
    steps: [],
  };
}

export const runLivePass = liveRunBase("run_live_pass_1");
export const runLiveFail = liveRunBase("run_live_fail_1");
export const runLiveStall = liveRunBase("run_live_stall_1");
/** Same timeline as runLivePass, but its first SSE connection drops mid-run - see handlers/events.ts. */
export const runLiveDrop = liveRunBase("run_live_drop_1");

const LONG_RUN_STEP_COUNT = 64;

export const runLong: z.infer<typeof RunDetailSchema> = {
  id: "run_long_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  suite_id: suiteCheckout.id,
  plan_id: null,
  login_session_id: null,
  report_url: reportUrl("run_long_1"),
  status: "passed",
  pass_rate: 0.96875, // 62/64
  coverage: { generated: 21, candidate: 24 },
  token_cost: 11.6,
  proof_id: "proof_long_1",
  started_at: "2026-09-08T09:00:00Z",
  finished_at: "2026-09-08T09:04:32Z",
  steps: Array.from({ length: LONG_RUN_STEP_COUNT }, (_, i) => {
    if (i === 17) {
      return step(i, {
        action: "assert_text",
        target: ".cart-total",
        status: "warning",
        message:
          "Cart total matched, but formatting differs from the locale default.",
      });
    }
    if (i === 41) {
      return step(i, {
        action: "assert_visible",
        target: ".upsell-banner",
        status: "fail",
        message:
          'Expected element ".upsell-banner" to be visible, but it was not rendered for this session.',
      });
    }
    return step(i, {
      action: i % 2 === 0 ? "click" : "assert_visible",
      target: `#step-${i}`,
    });
  }),
};

export const runs = [
  runPassed,
  runFailed,
  runLong,
  runLivePass,
  runLiveFail,
  runLiveStall,
  runLiveDrop,
];

// ---------------------------------------------------------------------
// Proofs
// ---------------------------------------------------------------------

/**
 * The 3 candidates behind "21 of 24 covered" - which ones, and why. Lengths
 * MUST agree (uncovered_total = candidate - generated); a test enforces it.
 */
const uncoveredFixture: z.infer<typeof ProofSnapshotSchema>["uncovered"] = [
  {
    label: "Remove",
    page_url: pageHome.url,
    reason_code: "not_uniquely_locatable",
    reason: 'More than one element matched ".line-item button.remove".',
  },
  {
    label: "Save",
    page_url: pageSettings.url,
    reason_code: "not_uniquely_locatable",
    reason: 'More than one element matched "button.save".',
  },
  {
    label: "Cancel",
    page_url: pageSettings.url,
    reason_code: "not_uniquely_locatable",
    reason: 'More than one element matched "button.cancel".',
  },
];

/**
 * A proof is a FROZEN SNAPSHOT (B0.5 B10): everything the public page needs
 * is copied in here at creation, so nothing it renders reads through to a
 * live run, and re-running or renaming anything later cannot change it.
 */
function snapshotFor(
  run: z.infer<typeof RunDetailSchema>,
): z.infer<typeof ProofSnapshotSchema> {
  const verdict = run.status === "passed" ? "passed" : "failed";
  return {
    verdict,
    pass_rate: run.pass_rate,
    coverage: run.coverage,
    target: { name: targetCheckout.name, base_url: targetCheckout.base_url },
    started_at: run.started_at,
    finished_at: run.finished_at ?? now,
    duration_ms:
      new Date(run.finished_at ?? now).getTime() -
      new Date(run.started_at).getTime(),
    token_cost: run.token_cost,
    steps: run.steps,
    plan: null, // suite runs have no plan; a plan run's proof carries it
    uncovered_total: run.coverage.candidate - run.coverage.generated,
    uncovered: uncoveredFixture,
  };
}

function proofFor(
  run: z.infer<typeof RunDetailSchema>,
  hash: string,
): z.infer<typeof ProofSchema> {
  return {
    id: run.proof_id!,
    run_id: run.id,
    hash,
    share: null,
    created_at: run.finished_at ?? now,
    snapshot: snapshotFor(run),
  };
}

export const proofs = [
  proofFor(runPassed, "sha256:1a79a4d60de6718e8e5b326e338ae533"),
  proofFor(runFailed, "sha256:9f2c134e5b0a9c1de3f6e9d0f5b2a7c8"),
  proofFor(runLong, "sha256:6c56f1b0e5b6a4d2f8c9e1a3b5d7f9a1"),
];
