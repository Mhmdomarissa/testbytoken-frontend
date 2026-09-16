import { http } from "msw";
import { ScanSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { scans, scanCheckout } from "../data";

export const scanHandlers = [
  http.post("*/scans", async () => {
    // Always hands back the completed demo scan - this mock favors a
    // realistic, inspectable fixture over simulating a fresh crawl.
    return json(ScanSchema, scanCheckout, { status: 201 });
  }),

  http.get("*/scans/:id", async ({ params }) => {
    const scan = scans.find((s) => s.id === params.id);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    return json(ScanSchema, scan);
  }),

  http.post("*/scans/:id/continue", async ({ params }) => {
    const scan = scans.find((s) => s.id === params.id);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    if (scan.status !== "parked") {
      return errorResponse(409, "not_parked", "Scan is not currently parked.");
    }
    return json(ScanSchema, {
      ...scan,
      status: "completed",
      parked_reason: null,
    });
  }),
];
