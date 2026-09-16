import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, IdSchema, TimestampSchema } from "./common";

/**
 * A workspace boots an engine process and warms a browser for one user.
 * It's the unit that gets reset or torn down - not a long-lived "project"
 * concept, closer to a session with its own lifecycle.
 */

export const WorkspaceStatusSchema = z
  .enum(["booting", "ready", "resetting", "error", "terminated"])
  .openapi({
    description:
      "Lifecycle state of the engine process backing this workspace.",
  });

export const WorkspaceSchema = z
  .object({
    id: IdSchema,
    status: WorkspaceStatusSchema,
    error: z
      .string()
      .nullable()
      .openapi({ description: "Populated when status is `error`." }),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Workspace");

const WorkspaceIdParam = z.object({ id: IdSchema });

export function registerWorkspacePaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/workspaces",
    tags: ["workspace"],
    summary: "Create a workspace (boots the engine, warms a browser)",
    security: [{ cookieAuth: [] }],
    responses: {
      201: {
        description: "Workspace created and booting.",
        content: { "application/json": { schema: WorkspaceSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/workspaces/{id}",
    tags: ["workspace"],
    summary: "Get workspace status",
    security: [{ cookieAuth: [] }],
    request: { params: WorkspaceIdParam },
    responses: {
      200: {
        description: "The workspace.",
        content: { "application/json": { schema: WorkspaceSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/workspaces/{id}/reset",
    tags: ["workspace"],
    summary:
      "Reset the workspace's browser session (new profile, same workspace)",
    security: [{ cookieAuth: [] }],
    request: { params: WorkspaceIdParam },
    responses: {
      200: {
        description: "Reset accepted; status returns to `booting`.",
        content: { "application/json": { schema: WorkspaceSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/workspaces/{id}",
    tags: ["workspace"],
    summary: "Tear down the workspace and its engine process",
    security: [{ cookieAuth: [] }],
    request: { params: WorkspaceIdParam },
    responses: {
      204: { description: "Torn down." },
    },
  });
}
