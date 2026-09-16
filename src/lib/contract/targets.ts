import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  EnvironmentSchema,
  ErrorSchema,
  IdSchema,
  TimestampSchema,
} from "./common";

/**
 * A target is the customer's application under test. `environment` is a
 * plain field on the target, not a separate sub-resource - simplest shape
 * that satisfies "CRUD + environments" without inventing a second CRUD
 * surface for something that's really one enum.
 */

export const TargetSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    base_url: z.url(),
    environment: EnvironmentSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Target");

export const CreateTargetRequestSchema = z
  .object({
    name: z.string().min(1),
    base_url: z.url(),
    environment: EnvironmentSchema,
  })
  .openapi("CreateTargetRequest");

export const UpdateTargetRequestSchema =
  CreateTargetRequestSchema.partial().openapi("UpdateTargetRequest");

const TargetIdParam = z.object({ id: IdSchema });

export function registerTargetPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/targets",
    tags: ["targets"],
    summary: "Create a target",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreateTargetRequestSchema } },
      },
    },
    responses: {
      201: {
        description: "Created.",
        content: { "application/json": { schema: TargetSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/targets",
    tags: ["targets"],
    summary: "List targets",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "All targets.",
        content: { "application/json": { schema: z.array(TargetSchema) } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/targets/{id}",
    tags: ["targets"],
    summary: "Get a target",
    security: [{ cookieAuth: [] }],
    request: { params: TargetIdParam },
    responses: {
      200: {
        description: "The target.",
        content: { "application/json": { schema: TargetSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/targets/{id}",
    tags: ["targets"],
    summary: "Update a target",
    security: [{ cookieAuth: [] }],
    request: {
      params: TargetIdParam,
      body: {
        content: { "application/json": { schema: UpdateTargetRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "Updated.",
        content: { "application/json": { schema: TargetSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/targets/{id}",
    tags: ["targets"],
    summary: "Delete a target",
    security: [{ cookieAuth: [] }],
    request: { params: TargetIdParam },
    responses: {
      204: { description: "Deleted." },
    },
  });
}
