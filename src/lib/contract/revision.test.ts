import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EventIdSchema,
  JobEventSchema,
  ProofSchema,
  PublicProofSchema,
  ScanSchema,
  StepSchema,
  TargetSchema,
  eventIdValue,
} from "./index";
import { ElementSchema } from "./inspect";

/**
 * docs/PHASE_B0_5.md part B: each contract requirement pinned as a test, so
 * a later edit that quietly relaxes one fails CI rather than a backend
 * team's first integration. Reads the COMMITTED openapi.json for the
 * whole-document properties (which `contract-drift` already guarantees
 * matches the Zod schemas).
 */

const openapi = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../../openapi.json"), "utf8"),
) as {
  components: { schemas: Record<string, unknown> };
  paths: Record<string, unknown>;
};

function walk(
  node: unknown,
  visit: (n: Record<string, unknown>, at: string) => void,
  at = "",
) {
  if (Array.isArray(node))
    node.forEach((n, i) => walk(n, visit, `${at}[${i}]`));
  else if (node && typeof node === "object") {
    visit(node as Record<string, unknown>, at);
    for (const [k, v] of Object.entries(node)) walk(v, visit, `${at}.${k}`);
  }
}

const step = {
  id: "stp_1",
  plan_step_id: null,
  index: 0,
  action: "click",
  target: "#a",
  assertion: null,
  status: "pass",
  message: "ok",
  duration_ms: 1,
  screenshot_url: null,
};

describe("B1: step identity", () => {
  it("a step without an id is rejected - identity is required, not derived from index", () => {
    const { id: _id, ...withoutId } = step;
    expect(StepSchema.safeParse(withoutId).success).toBe(false);
    expect(StepSchema.safeParse(step).success).toBe(true);
  });
});

describe("B2: event ordering is a specified, total, numeric order", () => {
  it.each(["0", "1", "42", "9007199254740991"])(
    "accepts canonical id %s",
    (id) => {
      expect(EventIdSchema.safeParse(id).success).toBe(true);
      expect(eventIdValue(id)).toBe(Number(id));
    },
  );

  it.each([
    "",
    "-1",
    "01",
    "1.0",
    "1e3",
    "abc",
    "9007199254740992",
    "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    " 1",
  ])(
    "rejects non-canonical id %j - never a value a client could mis-order",
    (id) => {
      expect(EventIdSchema.safeParse(id).success).toBe(false);
      expect(eventIdValue(id)).toBeNull();
    },
  );

  it("the JobEvent id field is the EventId schema everywhere it appears", () => {
    expect(
      JobEventSchema.safeParse({ id: "abc", type: "status", status: "running" })
        .success,
    ).toBe(false);
  });
});

describe("B3: heartbeat", () => {
  it("is a valid event with NO id - it is not part of the sequence", () => {
    const beat = {
      type: "heartbeat",
      at: "2026-09-21T12:00:00Z",
      interval_ms: 15000,
    };
    expect(JobEventSchema.safeParse(beat).success).toBe(true);
    // An id on a heartbeat is not an error (extra keys strip), but it must
    // not be REQUIRED, or a server would have to burn sequence numbers on it.
    expect(JobEventSchema.safeParse({ ...beat, id: undefined }).success).toBe(
      true,
    );
  });
});

describe("B4: scan state and failure detail", () => {
  it("Target carries last_scan (nullable, but present)", () => {
    const target = {
      id: "t",
      name: "n",
      base_url: "https://a.example.com",
      environment: "dev",
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T12:00:00Z",
    };
    expect(TargetSchema.safeParse(target).success).toBe(false); // missing last_scan
    expect(TargetSchema.safeParse({ ...target, last_scan: null }).success).toBe(
      true,
    );
  });

  it("a Scan must state its failure (null when not failed)", () => {
    const scan = {
      id: "s",
      workspace_id: "w",
      target_id: "t",
      target_url: "https://a.example.com",
      status: "failed",
      parked_reason: null,
      login_session_id: null,
      modules: [],
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T12:00:00Z",
    };
    expect(ScanSchema.safeParse(scan).success).toBe(false); // failure missing
    expect(
      ScanSchema.safeParse({
        ...scan,
        failure: { kind: "unreachable", message: "no route" },
      }).success,
    ).toBe(true);
  });
});

describe("B6: element role", () => {
  it("role is required (nullable for a generic container) and distinct from locator_strategy", () => {
    const el = {
      id: "e",
      page_url: "https://a.example.com",
      label: "Go",
      locator: "#go",
      locator_strategy: "role",
      uniquely_locatable: true,
      reason_not_locatable: null,
    };
    expect(ElementSchema.safeParse(el).success).toBe(false);
    expect(ElementSchema.safeParse({ ...el, role: null }).success).toBe(true);
    expect(ElementSchema.safeParse({ ...el, role: "button" }).success).toBe(
      true,
    );
  });
});

describe("B5: every enum is extensible, machine-readably", () => {
  it("every multi-member enum in openapi.json is marked x-extensible-enum", () => {
    const offenders: string[] = [];
    walk(openapi, (node, at) => {
      const values = node.enum;
      if (
        Array.isArray(values) &&
        values.length > 1 &&
        node["x-extensible-enum"] !== true
      ) {
        offenders.push(at);
      }
    });
    expect(offenders).toEqual([]);
  });

  it("the extensibility clause is in the prose of an enum's description too", () => {
    const run = JSON.stringify(openapi.components.schemas.RunDetail);
    expect(run).toContain("MUST tolerate unknown members");
  });
});

describe("B10: a proof is a self-contained frozen snapshot", () => {
  const snapshot = {
    verdict: "passed",
    pass_rate: 1,
    coverage: { basis: "inventory", generated: 21, candidate: 24 },
    target: { name: "Checkout", base_url: "https://a.example.com" },
    started_at: "2026-09-21T12:00:00Z",
    finished_at: "2026-09-21T12:01:00Z",
    duration_ms: 60000,
    token_cost: 4.2,
    steps: [step],
    plan: null,
    uncovered_total: 3,
    uncovered: [],
  };
  const pub = {
    id: "p",
    hash: "sha256:x",
    created_at: "2026-09-21T12:01:00Z",
    snapshot,
  };

  it("carries verdict, pass rate AND coverage (both halves), target, timestamps and the gap", () => {
    expect(PublicProofSchema.safeParse(pub).success).toBe(true);
    for (const field of [
      "verdict",
      "pass_rate",
      "coverage",
      "target",
      "started_at",
      "finished_at",
      "uncovered_total",
      "uncovered",
      "steps",
    ]) {
      const { [field]: _dropped, ...rest } = snapshot as Record<
        string,
        unknown
      >;
      expect(
        PublicProofSchema.safeParse({ ...pub, snapshot: rest }).success,
        `snapshot must require ${field}`,
      ).toBe(false);
    }
  });

  it("the PUBLIC shape has no run id, no share, nothing that resolves to authenticated data", () => {
    const parsed = PublicProofSchema.parse({
      ...pub,
      run_id: "run_1",
      share: { token: "x" },
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "created_at",
      "hash",
      "id",
      "snapshot",
    ]);
    // ...and the owner's Proof is the public one PLUS those two, not a different document.
    expect(
      ProofSchema.safeParse({ ...pub, run_id: "run_1", share: null }).success,
    ).toBe(true);
  });
});

describe("B8: no credential ever traverses the API", () => {
  it("no request body anywhere has a property that could carry one", () => {
    const forbidden =
      /password|passwd|credential|secret|cookie|storage_state|session_token/i;
    const offenders: string[] = [];
    for (const [route, item] of Object.entries(openapi.paths)) {
      walk(item, (node, at) => {
        if (!at.includes(".requestBody")) return;
        const props = node.properties;
        if (props && typeof props === "object") {
          for (const name of Object.keys(props)) {
            if (forbidden.test(name)) offenders.push(`${route}${at}: ${name}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the login-session resource itself exposes no captured-session data", () => {
    const props = Object.keys(
      (openapi.components.schemas.LoginSession as { properties: object })
        .properties,
    );
    expect(
      props.filter((p) => /cookie|password|credential|storage|token/i.test(p)),
    ).toEqual([]);
  });
});

describe("B7/B8/B9: the new surface exists", () => {
  it.each([
    ["/plans", "post"],
    ["/plans/{id}", "get"],
    ["/plans/{id}/approve", "post"],
    ["/login-sessions", "post"],
    ["/login-sessions/{id}", "get"],
    ["/login-sessions/{id}/complete", "post"],
    ["/runs/{id}/report", "get"],
  ])("%s %s is in openapi.json", (route, method) => {
    expect(
      (openapi.paths[route] as Record<string, unknown>)?.[method],
    ).toBeDefined();
  });

  it("the report endpoint's contract says it is untrusted and how it must be served", () => {
    const op = JSON.stringify(
      (openapi.paths["/runs/{id}/report"] as Record<string, unknown>).get,
    );
    expect(op).toContain("UNTRUSTED");
    expect(op).toContain("Content-Security-Policy: sandbox");
    expect(op).toContain("allow-same-origin");
  });

  it("a plan's steps can only be approved by id, as a selection - there is no PATCH", () => {
    expect(
      (openapi.paths["/plans/{id}"] as Record<string, unknown>).patch,
    ).toBeUndefined();
  });
});
