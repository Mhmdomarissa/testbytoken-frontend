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
import { registerPlanPaths } from "./plans";
import { registerLoginSessionPaths } from "./login-sessions";
import { registerProofPaths } from "./proofs";
import { registerUsagePaths } from "./usage";
import { registerOverviewPaths } from "./overview";

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "session",
  description:
    "httpOnly session cookie (CLAUDE.md: auth token lives in an httpOnly " +
    "cookie, never localStorage). Also the decided auth mechanism for SSE " +
    "(GET /jobs/{id}/events), with a deployment constraint attached - " +
    "see docs/API_CONTRACT.md.",
});

registerAuthPaths(registry);
registerWorkspacePaths(registry);
registerScanPaths(registry);
registerInspectPaths(registry);
registerRunPaths(registry);
registerEventPaths(registry);
registerSuitePaths(registry);
registerTargetPaths(registry);
registerPlanPaths(registry);
registerLoginSessionPaths(registry);
registerProofPaths(registry);
registerUsagePaths(registry);
registerOverviewPaths(registry);
