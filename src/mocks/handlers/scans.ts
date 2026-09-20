import { http } from "msw";
import { ScanSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { scanStore } from "../store";
import { resolveScan, registerLiveScan } from "../lifecycle";

export const scanHandlers = [
  http.post("*/scans", async ({ request }) => {
    // Progresses queued -> crawling -> completed in real time (Phase A
    // review, §5) rather than returning an instantly-completed fixture -
    // GET /scans/{id} and GET /jobs/{id}/events both reflect the same
    // timeline (src/mocks/lifecycle.ts).
    const body = (await request.json().catch(() => ({}))) as {
      workspace_id?: string;
      target_id?: string;
    };
    const id = `scan_${Math.random().toString(36).slice(2, 10)}`;
    const created = {
      id,
      workspace_id: body.workspace_id ?? "wksp_demo",
      target_id: body.target_id ?? "tgt_checkout",
      target_url: "https://checkout.example.com",
      status: "queued" as const,
      parked_reason: null,
      modules: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    scanStore.set(id, created);
    registerLiveScan(id);
    return json(ScanSchema, resolveScan(created), { status: 201 });
  }),

  http.get("*/scans/:id", async ({ params }) => {
    const scan = scanStore.get(params.id as string);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    return json(ScanSchema, resolveScan(scan));
  }),

  http.post("*/scans/:id/continue", async ({ params }) => {
    const scan = scanStore.get(params.id as string);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    const current = resolveScan(scan);
    if (current.status !== "parked") {
      return errorResponse(409, "not_parked", "Scan is not currently parked.");
    }
    return json(ScanSchema, {
      ...current,
      status: "completed",
      parked_reason: null,
    });
  }),
];
