import { http } from "msw";
import { WorkspaceSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { workspace } from "../data";

export const workspaceHandlers = [
  http.post("*/workspaces", async () => {
    return json(WorkspaceSchema, workspace, { status: 201 });
  }),

  http.get("*/workspaces/:id", async ({ params }) => {
    if (params.id !== workspace.id) {
      return errorResponse(404, "not_found", "Workspace not found.");
    }
    return json(WorkspaceSchema, workspace);
  }),

  http.post("*/workspaces/:id/reset", async ({ params }) => {
    if (params.id !== workspace.id) {
      return errorResponse(404, "not_found", "Workspace not found.");
    }
    return json(WorkspaceSchema, { ...workspace, status: "booting" });
  }),

  http.delete("*/workspaces/:id", async ({ params }) => {
    if (params.id !== workspace.id) {
      return errorResponse(404, "not_found", "Workspace not found.");
    }
    return new Response(null, { status: 204 });
  }),
];
