/**
 * Every query key used anywhere in the app, in one place, so a mutation in
 * one resource file can invalidate another resource's cache without
 * importing that file's internals or guessing at a key shape by hand.
 */
export const queryKeys = {
  workspaces: {
    detail: (id: string) => ["workspaces", id] as const,
  },
  targets: {
    all: () => ["targets"] as const,
    detail: (id: string) => ["targets", id] as const,
  },
  scans: {
    detail: (id: string) => ["scans", id] as const,
  },
  inspect: (scanId: string, moduleId: string) =>
    ["inspect", scanId, moduleId] as const,
  suites: {
    all: () => ["suites"] as const,
    detail: (id: string) => ["suites", id] as const,
    versions: (id: string) => ["suites", id, "versions"] as const,
  },
  runs: {
    list: (params: Record<string, string | undefined>) =>
      ["runs", "list", params] as const,
    detail: (id: string) => ["runs", id] as const,
  },
  plans: {
    detail: (id: string) => ["plans", id] as const,
  },
  proofs: {
    detail: (id: string) => ["proofs", id] as const,
    public: (token: string) => ["proofs", "public", token] as const,
  },
};
