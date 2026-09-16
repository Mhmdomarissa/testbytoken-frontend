import "./zod-openapi-setup";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { registerAuthPaths } from "./auth";
import { registerWorkspacePaths } from "./workspaces";
import { registerScanPaths } from "./scans";
import { registerInspectPaths } from "./inspect";
import { registerRunPaths } from "./runs";
import { registerEventPaths } from "./events";
import { registerSuitePaths } from "./suites";
import { registerTargetPaths } from "./targets";
import { registerProofPaths } from "./proofs";
import { registerUsagePaths } from "./usage";

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "session",
  description:
    "httpOnly session cookie (CLAUDE.md: auth token lives in an httpOnly " +
    "cookie, never localStorage). Recommended - not yet finalized - for SSE " +
    "auth too; see docs/API_CONTRACT.md.",
});

registerAuthPaths(registry);
registerWorkspacePaths(registry);
registerScanPaths(registry);
registerInspectPaths(registry);
registerRunPaths(registry);
registerEventPaths(registry);
registerSuitePaths(registry);
registerTargetPaths(registry);
registerProofPaths(registry);
registerUsagePaths(registry);
