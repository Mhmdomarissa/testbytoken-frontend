import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, IdSchema, TimestampSchema } from "./common";

/**
 * A scan crawls a target application and discovers its structure. It may
 * park waiting for the customer to sign in themselves inside the live,
 * engine-controlled browser - we never see or store their credentials
 * (CLAUDE.md: no password field for the app under test, anywhere).
 */

export const ScanStatusSchema = z
  .enum(["queued", "crawling", "parked", "completed", "failed"])
  .openapi({
    description: "`parked` means the crawl is waiting on a manual sign-in.",
  });

export const PageSchema = z
  .object({
    id: IdSchema,
    url: z.url(),
    title: z.string(),
  })
  .openapi("Page");

export const ModuleSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    pages: z.array(PageSchema),
    // Coarse inventory at the module level - the detailed, per-element
    // locator listing is what POST /inspect returns for one module.
    element_count: z.number().int().min(0),
    elements_uniquely_locatable_count: z
      .number()
      .int()
      .min(0)
      .openapi({
        description:
          "Subset of element_count that Inspect would mark uniquely_locatable. " +
          "The gap between the two is what the coverage.candidate/generated " +
          "split on a Run ultimately explains to the customer.",
      }),
  })
  .openapi("Module");

export const ScanSchema = z
  .object({
    id: IdSchema,
    workspace_id: IdSchema,
    target_id: IdSchema,
    target_url: z.url(),
    status: ScanStatusSchema,
    parked_reason: z.string().nullable().openapi({
      description: "Set when status is `parked`, e.g. `login_required`.",
    }),
    modules: z.array(ModuleSchema),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Scan");

export const CreateScanRequestSchema = z
  .object({
    workspace_id: IdSchema,
    target_id: IdSchema,
  })
  .openapi("CreateScanRequest");

const ScanIdParam = z.object({ id: IdSchema });

export function registerScanPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/scans",
    tags: ["scan"],
    summary: "Start a scan of a target",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreateScanRequestSchema } },
      },
    },
    responses: {
      201: {
        description: "Scan queued.",
        content: { "application/json": { schema: ScanSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/scans/{id}",
    tags: ["scan"],
    summary: "Get scan status and discovered structure so far",
    security: [{ cookieAuth: [] }],
    request: { params: ScanIdParam },
    responses: {
      200: {
        description: "The scan.",
        content: { "application/json": { schema: ScanSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/scans/{id}/continue",
    tags: ["scan"],
    summary: "Resume a parked scan after the customer has signed in manually",
    description:
      "Called once the user has finished authenticating themselves inside the " +
      "live browser view. Takes no credentials - the engine already has an " +
      "authenticated browser session; this just tells it to keep crawling.",
    security: [{ cookieAuth: [] }],
    request: { params: ScanIdParam },
    responses: {
      200: {
        description: "Crawl resumed.",
        content: { "application/json": { schema: ScanSchema } },
      },
      409: {
        description: "Scan is not currently parked.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
