import { authHandlers } from "./auth";
import { workspaceHandlers } from "./workspaces";
import { scanHandlers } from "./scans";
import { inspectHandlers } from "./inspect";
import { runHandlers } from "./runs";
import { eventHandlers } from "./events";
import { suiteHandlers } from "./suites";
import { targetHandlers } from "./targets";
import { proofHandlers } from "./proofs";
import { usageHandlers } from "./usage";

export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...scanHandlers,
  ...inspectHandlers,
  ...runHandlers,
  ...eventHandlers,
  ...suiteHandlers,
  ...targetHandlers,
  ...proofHandlers,
  ...usageHandlers,
];
