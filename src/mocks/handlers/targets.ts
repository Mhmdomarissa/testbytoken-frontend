import { http } from "msw";
import { z } from "zod";
import { TargetSchema } from "@/lib/contract";
import { json, errorResponse, checkSimulatedError } from "../respond";
import { scanStore, targetStore } from "../store";
import { resolveScan } from "../lifecycle";

/**
 * B0.5 B4: `last_scan` is computed from the scans that actually exist, at
 * read time - a fixture written last week can't know about a scan started
 * a second ago, and a stale `null` here would tell a screen "never scanned"
 * about a target that is mid-crawl.
 */
export function withLastScan(target: z.infer<typeof TargetSchema>) {
  const latest = [...scanStore.values()]
    .filter((s) => s.target_id === target.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return { ...target, last_scan: null };
  const current = resolveScan(latest);
  return {
    ...target,
    last_scan: {
      id: current.id,
      status: current.status,
      failure: current.failure,
      created_at: current.created_at,
      updated_at: current.updated_at,
    },
  };
}

export const targetHandlers = [
  http.post("*/targets", async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      base_url: string;
      environment: string;
    };
    const created = {
      id: `tgt_${Math.random().toString(36).slice(2, 10)}`,
      name: body.name,
      base_url: body.base_url,
      environment: body.environment as
        "dev" | "test" | "staging" | "production",
      last_scan: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    targetStore.set(created.id, created);
    return json(TargetSchema, created, { status: 201 });
  }),

  http.get("*/targets", async ({ request }) => {
    return (
      checkSimulatedError(request) ??
      json(z.array(TargetSchema), [...targetStore.values()].map(withLastScan))
    );
  }),

  http.get("*/targets/:id", async ({ params }) => {
    const target = targetStore.get(params.id as string);
    if (!target) return errorResponse(404, "not_found", "Target not found.");
    return json(TargetSchema, withLastScan(target));
  }),

  http.patch("*/targets/:id", async ({ params, request }) => {
    const current = targetStore.get(params.id as string);
    if (!current) return errorResponse(404, "not_found", "Target not found.");
    const patch = (await request.json()) as Partial<
      z.infer<typeof TargetSchema>
    >;
    const updated = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    targetStore.set(updated.id, updated);
    return json(TargetSchema, withLastScan(updated));
  }),

  http.delete("*/targets/:id", async ({ params }) => {
    if (!targetStore.delete(params.id as string)) {
      return errorResponse(404, "not_found", "Target not found.");
    }
    return new Response(null, { status: 204 });
  }),
];
