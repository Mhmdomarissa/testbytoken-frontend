import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  IdSchema,
  JobStatusSchema,
  TimestampSchema,
  extensibleEnum,
} from "./common";

/**
 * A scan crawls a target application and discovers its structure. It may
 * park waiting for the customer to sign in themselves inside the live,
 * engine-controlled browser - we never see or store their credentials
 * (CLAUDE.md: no password field for the app under test, anywhere).
 */

export const ScanStatusSchema = JobStatusSchema.extract([
  "queued",
  "crawling",
  "parked",
  "completed",
  "failed",
]).openapi({
  description:
    "Scan-shaped subset of the JobStatus vocabulary. `parked` means the " +
    "crawl is waiting on a manual sign-in. Extensible: clients MUST " +
    "tolerate unknown members.",
  "x-extensible-enum": true,
});

/**
 * B0.5 B4. `failed` used to carry no reason, so a screen could only say
 * "scan failed" - and the KIND is what decides what the user does next.
 */
export const ScanFailureKindSchema = extensibleEnum(
  ["unreachable", "refused", "timeout", "blocked_by_guardrail", "internal"],
  "Why a scan failed. `unreachable`: DNS/connection failure - the URL may " +
    "be wrong or the site down. `refused`: the site answered and denied us " +
    "(403/WAF/robots) - the customer must allow our engine. `timeout`: the " +
    "site was too slow to crawl. `blocked_by_guardrail`: WE refused the " +
    "target (e.g. a private/internal address) - not retryable, change the " +
    "target. `internal`: our fault - retry, then contact support.",
);

export const ScanFailureSchema = z
  .object({
    kind: ScanFailureKindSchema,
    message: z.string().openapi({
      description:
        "Human-readable, safe to show a customer as-is. MUST NOT contain page " +
        "content, cookies, tokens, or anything typed into the browser.",
    }),
  })
  .openapi("ScanFailure");

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
    failure: ScanFailureSchema.nullable().openapi({
      description:
        "REQUIRED (B0.5 B4). MUST be non-null exactly when `status` is " +
        "`failed`, and null otherwise.",
    }),
    login_session_id: IdSchema.nullable().openapi({
      description:
        "The captured login session this scan is crawling under (B0.5 B8), or null.",
    }),
    modules: z.array(ModuleSchema),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Scan");

export const ScanSummarySchema = z
  .object({
    id: IdSchema,
    status: ScanStatusSchema,
    failure: ScanFailureSchema.nullable(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("ScanSummary");

export const CreateScanRequestSchema = z
  .object({
    workspace_id: IdSchema,
    target_id: IdSchema,
    login_session_id: IdSchema.optional().openapi({
      description:
        "Crawl under an already-captured login session (B0.5 B8). Omit for an unauthenticated crawl; a crawl that then needs sign-in parks with `login_required`.",
    }),
  })
  .openapi("CreateScanRequest");

export const ContinueScanRequestSchema = z
  .object({
    login_session_id: IdSchema.optional().openapi({
      description:
        "Attach a completed login session to a scan parked with `login_required`. Required in that case (B0.5 B8).",
    }),
  })
  .openapi("ContinueScanRequest");

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
    request: {
      params: ScanIdParam,
      body: {
        required: false,
        content: { "application/json": { schema: ContinueScanRequestSchema } },
      },
    },
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
