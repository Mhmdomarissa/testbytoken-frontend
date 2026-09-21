import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { WorkspaceSchema } from "@/lib/contract";
import { apiDelete, apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";

type Workspace = z.infer<typeof WorkspaceSchema>;

const NON_TERMINAL_STATUSES = new Set<Workspace["status"]>([
  "booting",
  "resetting",
]);

/**
 * A workspace boots an engine + browser and can be "booting"/"resetting"
 * for real wall-clock time - poll every 2s while non-terminal, stop
 * polling once it settles into `ready`/`error`/`terminated`. staleTime 0
 * (not cached across a poll) because "is it ready yet" only matters as
 * of right now, never as of some recent-but-stale snapshot.
 */
export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(id ?? ""),
    queryFn: () => apiGet(`/workspaces/${id}`, WorkspaceSchema),
    enabled: id !== undefined,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && NON_TERMINAL_STATUSES.has(status) ? 2_000 : false;
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/workspaces", WorkspaceSchema),
    onSuccess: (workspace) => {
      queryClient.setQueryData(
        queryKeys.workspaces.detail(workspace.id),
        workspace,
      );
    },
  });
}

export function useResetWorkspace(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/workspaces/${id}/reset`, WorkspaceSchema),
    onSuccess: (workspace) => {
      queryClient.setQueryData(queryKeys.workspaces.detail(id), workspace);
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/workspaces/${id}`, z.void()),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.workspaces.detail(id) });
    },
  });
}
