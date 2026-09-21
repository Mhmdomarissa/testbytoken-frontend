import { authHandlers } from "./auth";
import { workspaceHandlers } from "./workspaces";
import { scanHandlers } from "./scans";
import { inspectHandlers } from "./inspect";
import { runHandlers } from "./runs";
import { eventHandlers } from "./events";
import { suiteHandlers } from "./suites";
import { targetHandlers } from "./targets";
import { planHandlers } from "./plans";
import { loginSessionHandlers } from "./loginSessions";
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
  ...planHandlers,
  ...loginSessionHandlers,
  ...proofHandlers,
  ...usageHandlers,
];
