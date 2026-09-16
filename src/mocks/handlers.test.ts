// @vitest-environment node
//
// Pure HTTP tests against the MSW node server - no DOM needed. jsdom's
// fetch/ReadableStream does not surface chunks incrementally the way
// Node's native fetch (undici) does, which made the SSE test below hang
// waiting for the whole (never-ending, for the live job) stream to close
// before its first `reader.read()` resolved. Confirmed by reproducing the
// same handler standalone under plain Node (fine) vs this file's default
// jsdom environment (hung) before adding this directive.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server";
import {
  RunDetailSchema,
  InspectResponseSchema,
  ProofSchema,
} from "@/lib/contract";

/**
 * Exercises the mock over real HTTP (via MSW's node server + fetch), not
 * by importing handler functions directly - this is what "the mock is the
 * contract's reference implementation" needs to mean: every response, for
 * every endpoint, actually parses against the schema that defines it.
 */

const base = "http://localhost";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ugly-case fixtures are real, schema-valid data", () => {
  it("a failed run has a real, specific failure message", async () => {
    const res = await fetch(`${base}/runs/run_fail_1`);
    const body = await res.json();
    const run = RunDetailSchema.parse(body);

    expect(run.status).toBe("failed");
    const failedStep = run.steps.find((s) => s.status === "fail");
    expect(failedStep?.message).toMatch(/confirm-button/);
    expect(failedStep?.message.length).toBeGreaterThan(20);
  });

  it("a 64-step run is exactly that long", async () => {
    const res = await fetch(`${base}/runs/run_long_1`);
    const run = RunDetailSchema.parse(await res.json());
    expect(run.steps).toHaveLength(64);
  });

  it("a module with nothing locatable reports zero, honestly", async () => {
    const res = await fetch(`${base}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scan_id: "scan_checkout_1",
        module_id: "mod_settings",
      }),
    });
    const inspected = InspectResponseSchema.parse(await res.json());

    expect(inspected.elements.length).toBeGreaterThan(0);
    expect(
      inspected.elements.every((el) => el.uniquely_locatable === false),
    ).toBe(true);
  });

  it("an empty target has no runs at all, not an error", async () => {
    const res = await fetch(`${base}/runs?target_id=tgt_empty`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("elements carry very long and unicode labels intact", async () => {
    const res = await fetch(`${base}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scan_id: "scan_checkout_1",
        module_id: "mod_checkout",
      }),
    });
    const inspected = InspectResponseSchema.parse(await res.json());

    const long = inspected.elements.find((el) => el.id === "el_long_label");
    expect(long?.label.length).toBeGreaterThan(150);

    const unicode = inspected.elements.find((el) => el.id === "el_unicode");
    expect(unicode?.label).toContain("💳");
  });

  it("a still-running job streams live SSE events", async () => {
    const res = await fetch(`${base}/jobs/run_streaming_1/events`);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Deliberately not calling reader.cancel() here: this MSW version's
    // interceptor never resolves that promise for a streamed mock
    // response, hanging the test indefinitely. Reading the first chunk is
    // enough to prove the stream actually delivers incrementally rather
    // than buffering until close (which, for this job, never happens).
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toMatch(/^id: /);
    expect(text).toContain('"type":"step"');
  });

  it("a finished proof carries a hash and every step", async () => {
    const res = await fetch(`${base}/proofs/proof_fail_1`);
    const proof = ProofSchema.parse(await res.json());
    expect(proof.hash).toMatch(/^sha256:/);
    expect(proof.steps.length).toBeGreaterThan(0);
  });
});
