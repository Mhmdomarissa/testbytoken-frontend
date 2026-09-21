// @vitest-environment node
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "./server";
import {
  LoginSessionSchema,
  MeResponseSchema,
  PlanSchema,
  PublicProofSchema,
  RunDetailSchema,
  ScanSchema,
  TargetSchema,
} from "@/lib/contract";
import { z } from "zod";
import { mockAccount, planStore } from "./store";
import { computeScanState } from "./lifecycle";
import { PLAN_GENERATION_MS } from "./planning";
import { CONNECT_AFTER_MS, PROVISION_MS } from "./login";
import { proofs } from "./data";

/**
 * The mock is the contract's REFERENCE IMPLEMENTATION, so each requirement
 * of docs/PHASE_B0_5.md part B is exercised here over real HTTP: every
 * response is parsed against the schema that defines it, and the rules the
 * contract states in prose (immutability, exactly-one, no credentials...)
 * are asserted as behaviour, not just documented.
 */

const base = "http://localhost";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  mockAccount.writeActions = false;
});
afterAll(() => server.close());

const post = (path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function settledPlan(intent = "check that checkout works") {
  vi.useFakeTimers({ toFake: ["Date"] });
  const created = PlanSchema.parse(
    await (
      await post("/plans", {
        workspace_id: "wksp_demo",
        target_id: "tgt_checkout",
        scan_id: "scan_checkout_1",
        intent,
      })
    ).json(),
  );
  expect(created.status).toBe("generating");
  vi.setSystemTime(Date.now() + PLAN_GENERATION_MS + 1);
  const plan = PlanSchema.parse(
    await (await fetch(`${base}/plans/${created.id}`)).json(),
  );
  vi.useRealTimers();
  return plan;
}

describe("B4: targets carry their last scan", () => {
  it("a never-scanned target says so; a scanned one carries the scan's state", async () => {
    const targets = z
      .array(TargetSchema)
      .parse(await (await fetch(`${base}/targets`)).json());
    expect(targets.find((t) => t.id === "tgt_empty")?.last_scan).toBeNull();
    expect(
      targets.find((t) => t.id === "tgt_checkout")?.last_scan,
    ).not.toBeNull();
  });

  it("starting a scan is visible on the target immediately (one round trip, no N+1)", async () => {
    const scan = ScanSchema.parse(
      await (
        await post("/scans", {
          workspace_id: "wksp_demo",
          target_id: "tgt_empty",
        })
      ).json(),
    );
    const target = TargetSchema.parse(
      await (await fetch(`${base}/targets/tgt_empty`)).json(),
    );
    expect(target.last_scan?.id).toBe(scan.id);
    expect(["queued", "crawling"]).toContain(target.last_scan?.status);
  });

  it("an unreachable target's scan FAILS with a structured kind and a message", () => {
    const base = {
      id: "scan_x",
      workspace_id: "w",
      target_id: "tgt_unreachable",
      target_url: "https://legacy-admin.example.com",
      status: "queued" as const,
      parked_reason: null,
      failure: null,
      login_session_id: null,
      modules: [],
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T12:00:00Z",
    };
    const done = computeScanState(base, 10_000);
    expect(done.status).toBe("failed");
    expect(done.failure?.kind).toBe("unreachable");
    expect(done.failure?.message.length).toBeGreaterThan(20);
    expect(computeScanState(base, 500).failure).toBeNull(); // failure only once failed
  });
});

describe("B7: the plan gate", () => {
  it("generation is asynchronous and uniform: 201 generating with no steps, then proposed", async () => {
    const plan = await settledPlan();
    expect(plan.status).toBe("proposed");
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("ungrounded steps are IN the plan, with their reason - not omitted", async () => {
    const plan = await settledPlan();
    const ungrounded = plan.steps.filter(
      (s) => s.binding.type === "ungrounded",
    );
    expect(ungrounded.length).toBeGreaterThanOrEqual(2);
    for (const s of ungrounded) {
      if (s.binding.type === "ungrounded")
        expect(s.binding.reason.length).toBeGreaterThan(10);
    }
  });

  it("no plan ever types a credential: that step is ungrounded, with input null", async () => {
    const plan = await settledPlan();
    const credential = plan.steps.find(
      (s) =>
        s.binding.type === "ungrounded" &&
        s.binding.reason_code === "credential_required",
    );
    expect(credential).toBeDefined();
    expect(credential?.input).toBeNull();
  });

  it("a 'writes:' intent is planned for a write-capable account, without touching the account", async () => {
    const plan = await settledPlan("writes: buy something");
    expect(plan.steps.find((s) => s.id === "pstp_2")?.blocked).toBeNull();
    expect(mockAccount.writeActions).toBe(false);
    const ordinary = await settledPlan("buy something");
    expect(
      ordinary.steps.find((s) => s.id === "pstp_2")?.blocked,
    ).not.toBeNull();
  });

  it("write steps are blocked, by the SERVER, on a read-only account - and free on a write account", async () => {
    const readOnly = await settledPlan();
    expect(
      readOnly.steps.find((s) => s.id === "pstp_2")?.blocked?.reason_code,
    ).toBe("read_only_tier");
    expect(readOnly.steps.find((s) => s.id === "pstp_1")?.blocked).toBeNull(); // reads are never blocked

    mockAccount.writeActions = true;
    const writer = await settledPlan();
    expect(writer.steps.find((s) => s.id === "pstp_2")?.blocked).toBeNull();
  });

  it("/auth/me exposes the capability the UI reads up front", async () => {
    const me = MeResponseSchema.parse(
      await (
        await fetch(`${base}/auth/me`, {
          headers: { cookie: "session=demo_user" },
        })
      ).json(),
    );
    expect(me.capabilities.write_actions).toBe(false);
  });

  it("a planner failure is a designed state, with a message", async () => {
    const plan = await settledPlan("fail: nonsense");
    expect(plan.status).toBe("failed");
    expect(plan.failure?.message.length).toBeGreaterThan(20);
  });

  it("approval is a selection + ordering only, and rejects everything it should (422)", async () => {
    const plan = await settledPlan();
    const bad = async (step_ids: string[]) =>
      (await post(`/plans/${plan.id}/approve`, { step_ids })).status;
    expect(await bad([])).toBe(422); // empty
    expect(await bad(["pstp_1", "pstp_1"])).toBe(422); // duplicate
    expect(await bad(["nope"])).toBe(422); // unknown id
    expect(await bad(["pstp_4"])).toBe(422); // ungrounded
    expect(await bad(["pstp_2"])).toBe(422); // blocked (read-only tier)
    expect(planStore.get(plan.id)?.plan.status).toBe("proposed"); // none of that changed anything
  });

  it("approval records the person's edit (subset AND order) and freezes the plan - steps never change, approval is not repeatable", async () => {
    const plan = await settledPlan();
    const before = JSON.stringify(plan.steps);

    const res = await post(`/plans/${plan.id}/approve`, {
      step_ids: ["pstp_3", "pstp_1"],
    }); // dropped two, reordered
    const approved = PlanSchema.parse(await res.json());
    expect(approved.status).toBe("approved");
    expect(approved.approval?.step_ids).toEqual(["pstp_3", "pstp_1"]);
    expect(JSON.stringify(approved.steps)).toBe(before); // the PROPOSAL is untouched: what was left out stays visible

    expect(
      (await post(`/plans/${plan.id}/approve`, { step_ids: ["pstp_1"] }))
        .status,
    ).toBe(409);
    expect((await post(`/plans/${plan.id}/discard`)).status).toBe(409);
    const again = PlanSchema.parse(
      await (await fetch(`${base}/plans/${plan.id}`)).json(),
    );
    expect(again.approval).toEqual(approved.approval); // immutable
  });

  it("a run executes the APPROVED plan, in approved order, each step pointing back at its plan step", async () => {
    const plan = await settledPlan();
    await post(`/plans/${plan.id}/approve`, { step_ids: ["pstp_3", "pstp_1"] });

    const run = RunDetailSchema.parse(
      await (
        await post("/runs", {
          workspace_id: "wksp_demo",
          target_id: "tgt_checkout",
          plan_id: plan.id,
        })
      ).json(),
    );
    expect(run.plan_id).toBe(plan.id);
    expect(run.suite_id).toBeNull();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10_000);
    const finished = RunDetailSchema.parse(
      await (await fetch(`${base}/runs/${run.id}`)).json(),
    );
    expect(finished.steps.map((s) => s.plan_step_id)).toEqual([
      "pstp_3",
      "pstp_1",
    ]);
    expect(finished.report_url).not.toBeNull();
  });

  it("only an approved plan can run (409), and a run names exactly one of suite_id / plan_id (422)", async () => {
    const proposed = await settledPlan();
    expect(
      (await post("/runs", { target_id: "tgt_checkout", plan_id: proposed.id }))
        .status,
    ).toBe(409);
    expect((await post("/runs", { target_id: "tgt_checkout" })).status).toBe(
      422,
    );
    expect(
      (
        await post("/runs", {
          target_id: "tgt_checkout",
          suite_id: "s",
          plan_id: proposed.id,
        })
      ).status,
    ).toBe(422);
  });
});

describe("B8: login sessions - no credential, ever", () => {
  async function create(targetId = "tgt_checkout") {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = LoginSessionSchema.parse(
      await (
        await post("/login-sessions", {
          workspace_id: "wksp_demo",
          target_id: targetId,
        })
      ).json(),
    );
    return session;
  }
  const at = async (id: string, msFromCreation: number) => {
    vi.setSystemTime(Date.now() + msFromCreation);
    return LoginSessionSchema.parse(
      await (await fetch(`${base}/login-sessions/${id}`)).json(),
    );
  };

  it("walks provisioning -> ready -> in_progress, exposing the live view only while it is usable", async () => {
    const s = await create();
    expect(s.status).toBe("provisioning");
    expect(s.view_url).toBeNull();

    const ready = await at(s.id, PROVISION_MS + 10);
    expect(ready.status).toBe("ready");
    expect(ready.view_url).not.toBeNull();
    expect(new URL(ready.view_url!).origin).not.toBe(base); // a separate origin

    const active = await at(s.id, CONNECT_AFTER_MS);
    expect(active.status).toBe("in_progress");
  });

  it("completing after the customer connected captures the session; completing twice is a 409", async () => {
    const s = await create();
    await at(s.id, CONNECT_AFTER_MS + 100);
    const done = LoginSessionSchema.parse(
      await (await post(`/login-sessions/${s.id}/complete`)).json(),
    );
    expect(done.status).toBe("completed");
    expect(done.view_url).toBeNull();
    expect((await post(`/login-sessions/${s.id}/complete`)).status).toBe(409);
  });

  it("saying 'done' before ever signing in fails as no_session_detected - the engine does not take their word for it", async () => {
    const s = await create();
    await at(s.id, PROVISION_MS + 10); // ready, but nobody connected
    const done = LoginSessionSchema.parse(
      await (await post(`/login-sessions/${s.id}/complete`)).json(),
    );
    expect(done.status).toBe("failed");
    expect(done.failure?.kind).toBe("no_session_detected");
  });

  it("an unreachable target can't get a browser (a designed failure), and expiry is reported", async () => {
    const s = await create("tgt_unreachable");
    expect((await at(s.id, PROVISION_MS + 10)).failure?.kind).toBe(
      "browser_unavailable",
    );

    const ok = await create();
    expect((await at(ok.id, 11 * 60 * 1000)).status).toBe("expired");
  });

  it("a scan or run can only reference a COMPLETED session", async () => {
    const s = await create();
    await at(s.id, PROVISION_MS + 10);
    expect(
      (
        await post("/scans", {
          target_id: "tgt_checkout",
          login_session_id: s.id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post("/scans", {
          target_id: "tgt_checkout",
          login_session_id: "lgn_nope",
        })
      ).status,
    ).toBe(422);
    vi.useRealTimers();
  });

  it("a parked scan cannot continue without a login session attached", async () => {
    expect((await post("/scans/scan_parked_1/continue", {})).status).toBe(422);
  });
});

describe("B9: the engine's report is served as untrusted content", () => {
  it("is sandboxed even on direct navigation, and does not exist until the run finishes", async () => {
    const finished = await fetch(`${base}/runs/run_pass_1/report`);
    expect(finished.status).toBe(200);
    expect(finished.headers.get("content-type")).toContain("text/html");
    expect(finished.headers.get("content-security-policy")).toBe("sandbox"); // no allow-* tokens at all
    expect(finished.headers.get("x-content-type-options")).toBe("nosniff");

    expect((await fetch(`${base}/runs/run_live_pass_1/report`)).status).toBe(
      404,
    ); // still running
  });
});

describe("B10: proofs are frozen, self-contained, and the public one leaks nothing", () => {
  it("the snapshot's gap adds up: uncovered_total = candidate - generated = the listed items", () => {
    for (const p of proofs) {
      const { coverage, uncovered, uncovered_total } = p.snapshot;
      expect(uncovered_total).toBe(coverage.candidate - coverage.generated);
      expect(uncovered.length).toBe(uncovered_total);
    }
  });

  it("GET /p/{token} returns the snapshot and NOTHING from the authenticated world", async () => {
    const shared = await post("/proofs/proof_pass_1/share", { enabled: true });
    const { token } = z
      .object({ token: z.string() })
      .parse(await shared.json());

    const body = await (await fetch(`${base}/p/${token}`)).json();
    PublicProofSchema.parse(body);
    expect(Object.keys(body).sort()).toEqual([
      "created_at",
      "hash",
      "id",
      "snapshot",
    ]);
    expect(JSON.stringify(body)).not.toContain("run_pass_1"); // no run id anywhere
    expect(JSON.stringify(body)).not.toContain(token); // no share token echoed back
  });

  it("revoking the share kills the public page entirely - the DISABLED token itself, not just a rotated-away old one", async () => {
    const enabled = z
      .object({ token: z.string() })
      .parse(
        await (
          await post("/proofs/proof_fail_1/share", { enabled: true })
        ).json(),
      );
    expect((await fetch(`${base}/p/${enabled.token}`)).status).toBe(200);

    // Sharing again mints a new token; with enabled:false THAT token must be dead too.
    const revoked = z
      .object({ token: z.string(), enabled: z.boolean() })
      .parse(
        await (
          await post("/proofs/proof_fail_1/share", { enabled: false })
        ).json(),
      );
    expect(revoked.enabled).toBe(false);
    expect((await fetch(`${base}/p/${revoked.token}`)).status).toBe(404); // disabled
    expect((await fetch(`${base}/p/${enabled.token}`)).status).toBe(404); // rotated away
  });
});
