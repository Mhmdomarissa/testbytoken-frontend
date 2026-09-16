import { http } from "msw";
import { z } from "zod";
import { TargetSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { targets } from "../data";

let store = [...targets];

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store = [...store, created];
    return json(TargetSchema, created, { status: 201 });
  }),

  http.get("*/targets", async () => {
    return json(z.array(TargetSchema), store);
  }),

  http.get("*/targets/:id", async ({ params }) => {
    const target = store.find((t) => t.id === params.id);
    if (!target) return errorResponse(404, "not_found", "Target not found.");
    return json(TargetSchema, target);
  }),

  http.patch("*/targets/:id", async ({ params, request }) => {
    const index = store.findIndex((t) => t.id === params.id);
    if (index === -1)
      return errorResponse(404, "not_found", "Target not found.");
    const patch = (await request.json()) as Partial<
      z.infer<typeof TargetSchema>
    >;
    const current = store[index]!;
    const updated = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    store = [...store.slice(0, index), updated, ...store.slice(index + 1)];
    return json(TargetSchema, updated);
  }),

  http.delete("*/targets/:id", async ({ params }) => {
    const index = store.findIndex((t) => t.id === params.id);
    if (index === -1)
      return errorResponse(404, "not_found", "Target not found.");
    store = [...store.slice(0, index), ...store.slice(index + 1)];
    return new Response(null, { status: 204 });
  }),
];
