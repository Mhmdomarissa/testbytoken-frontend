import { http } from "msw";
import { InspectResponseSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { elementsForModule } from "../data";

export const inspectHandlers = [
  http.post("*/inspect", async ({ request }) => {
    const body = (await request.json()) as { module_id?: string };
    const elements = body.module_id
      ? elementsForModule(body.module_id)
      : undefined;
    if (!elements) {
      return errorResponse(404, "not_found", "Module not found.");
    }
    return json(InspectResponseSchema, {
      module_id: body.module_id!,
      elements,
    });
  }),
];
