import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, IdSchema } from "./common";

/**
 * Inspect opens one module and lists its elements with the locator the
 * runner would use. NON-NEGOTIABLE (docs/PHASE_A.md): every element
 * carries whether it is uniquely locatable - that flag is what explains
 * a run's coverage number to a customer, so it is required, not optional,
 * on every element in this list.
 */

export const LocatorStrategySchema = z
  .enum(["css", "xpath", "role", "text", "test_id"])
  .openapi({
    description: "How `locator` should be interpreted by the runner.",
  });

export const ElementSchema = z
  .object({
    id: IdSchema,
    page_url: z.url(),
    label: z.string().openapi({
      description:
        "Best-effort human label - visible text, aria-label, or similar.",
    }),
    locator: z.string(),
    locator_strategy: LocatorStrategySchema,
    uniquely_locatable: z.boolean().openapi({
      description:
        "False when the engine found more than one element matching this " +
        "locator and can't disambiguate. A false here is why a test may not " +
        "get generated for this element - see Run.coverage.",
    }),
    reason_not_locatable: z.string().nullable().openapi({
      description:
        "Set when uniquely_locatable is false, e.g. `duplicate_locator`.",
    }),
  })
  .openapi("Element");

export const InspectRequestSchema = z
  .object({
    scan_id: IdSchema,
    module_id: IdSchema,
  })
  .openapi("InspectRequest");

export const InspectResponseSchema = z
  .object({
    module_id: IdSchema,
    elements: z.array(ElementSchema),
  })
  .openapi("InspectResponse");

export function registerInspectPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/inspect",
    tags: ["inspect"],
    summary: "List one module's elements with locators",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: InspectRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "Element inventory for the requested module.",
        content: { "application/json": { schema: InspectResponseSchema } },
      },
      404: {
        description: "Scan or module not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
