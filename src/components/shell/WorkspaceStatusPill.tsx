"use client";

import { CircleIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResource } from "@/hooks/useResource";
import { WorkspaceSchema } from "@/lib/contract";
import { enumLabel } from "@/lib/api/tolerant";

const DEMO_WORKSPACE_ID = "wksp_demo";

/**
 * The engine/workspace status pill A7 calls for. Polls the one workspace
 * this mock account has - a real multi-workspace picker is product-screen
 * territory, out of scope for the shell.
 */
export function WorkspaceStatusPill() {
  const workspace = useResource(
    `/workspaces/${DEMO_WORKSPACE_ID}`,
    WorkspaceSchema,
  );

  if (workspace.status === "loading") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <LoaderCircleIcon className="animate-spin" />
        Connecting…
      </Badge>
    );
  }

  if (workspace.status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant="destructive" className="gap-1.5">
              <TriangleAlertIcon />
              Engine unreachable
            </Badge>
          }
        />
        <TooltipContent>{workspace.message}</TooltipContent>
      </Tooltip>
    );
  }

  const { status } = workspace.data;
  const label = status === "ready" ? "Engine ready" : enumLabel(status);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={status === "ready" ? "secondary" : "outline"}
            className="gap-1.5"
          >
            <CircleIcon
              className={
                status === "ready"
                  ? "size-2 fill-current"
                  : "size-2 animate-pulse fill-current"
              }
            />
            {label}
          </Badge>
        }
      />
      <TooltipContent>Workspace {DEMO_WORKSPACE_ID}</TooltipContent>
    </Tooltip>
  );
}
