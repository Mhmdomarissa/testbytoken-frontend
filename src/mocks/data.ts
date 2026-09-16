import type { z } from "zod";
import type {
  ElementSchema,
  ModuleSchema,
  PageSchema,
  ProofSchema,
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
  created_at: now,
  updated_at: now,
};

export const targetEmpty: z.infer<typeof TargetSchema> = {
  id: "tgt_empty",
  name: "Freshly added target",
  base_url: "https://new.example.com",
  environment: "staging",
  created_at: now,
  updated_at: now,
};

export const targets = [targetCheckout, targetEmpty];

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

const modCheckout: z.infer<typeof ModuleSchema> = {
  id: "mod_checkout",
  name: "Checkout flow",
  pages: [pageHome],
  element_count: 24,
  elements_uniquely_locatable_count: 21,
};

// The honest empty state: a module where nothing could be uniquely
// located, so nothing got generated - zero, not "some".
const modSettings: z.infer<typeof ModuleSchema> = {
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
  modules: [modCheckout],
  created_at: now,
  updated_at: now,
};

export const scans = [scanCheckout, scanParked];

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
      locator: "#submit",
      locator_strategy: "css",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_long_label",
      page_url: pageHome.url,
      label: longLabel,
      locator: "button[data-testid='continue-to-payment']",
      locator_strategy: "test_id",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_unicode",
      page_url: pageHome.url,
      label: "支払いを続ける 💳 — Продолжить оплату — متابعة الدفع",
      locator: "//button[contains(., '支払い')]",
      locator_strategy: "xpath",
      uniquely_locatable: true,
      reason_not_locatable: null,
    },
    {
      id: "el_duplicate",
      page_url: pageHome.url,
      label: "Remove",
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
      locator: "button.save",
      locator_strategy: "css",
      uniquely_locatable: false,
      reason_not_locatable: "duplicate_locator",
    },
    {
      id: "el_settings_2",
      page_url: pageSettings.url,
      label: "Cancel",
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

function step(
  index: number,
  overrides: Partial<z.infer<typeof StepSchema>> = {},
): z.infer<typeof StepSchema> {
  return {
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

// Still executing - GET /jobs/{id}/events for this run's id streams new
// step events in src/mocks/handlers/events.ts, so `npm run dev` has a
// live SSE path to exercise without a real backend.
export const runStreaming: z.infer<typeof RunDetailSchema> = {
  id: "run_streaming_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  suite_id: suiteCheckout.id,
  status: "running",
  pass_rate: 1,
  coverage: { generated: 21, candidate: 24 },
  token_cost: 1.1,
  proof_id: null,
  started_at: "2026-09-16T12:00:00Z",
  finished_at: null,
  steps: [step(0, { action: "navigate", target: pageHome.url })],
};

const LONG_RUN_STEP_COUNT = 64;

export const runLong: z.infer<typeof RunDetailSchema> = {
  id: "run_long_1",
  workspace_id: workspace.id,
  target_id: targetCheckout.id,
  suite_id: suiteCheckout.id,
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

export const runs = [runPassed, runFailed, runStreaming, runLong];

// ---------------------------------------------------------------------
// Proofs
// ---------------------------------------------------------------------

function proofFor(
  run: z.infer<typeof RunDetailSchema>,
  hash: string,
): z.infer<typeof ProofSchema> {
  return {
    id: run.proof_id!,
    run_id: run.id,
    hash,
    token_cost: run.token_cost,
    steps: run.steps,
    share: null,
    created_at: run.finished_at ?? now,
  };
}

export const proofs = [
  proofFor(runPassed, "sha256:1a79a4d60de6718e8e5b326e338ae533"),
  proofFor(runFailed, "sha256:9f2c134e5b0a9c1de3f6e9d0f5b2a7c8"),
  proofFor(runLong, "sha256:6c56f1b0e5b6a4d2f8c9e1a3b5d7f9a1"),
];
