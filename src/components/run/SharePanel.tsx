"use client";

import { useState } from "react";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { useSetShare } from "@/lib/api/queries/proofs";
import { ApiError } from "@/lib/api/errors";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

/**
 * `POST /proofs/{id}/share`, per the contract nice-to-have. Sharing is
 * off by default (`share: null`) and the toggle is explicit either way -
 * nothing here auto-shares a proof just because it was viewed.
 *
 * The link is never a bearer token to OUR app's API (CLAUDE.md: never a
 * token in the URL) - it is the contract's own `share.url`, an opaque
 * capability for the PUBLIC proof page, which is what B9 builds. This
 * screen only creates/copies/revokes it.
 */
export function SharePanel({
  proofId,
  share,
}: {
  proofId: string;
  share: { url: string; enabled: boolean; token: string } | null;
}) {
  const setShare = useSetShare(proofId);
  const [copied, setCopied] = useState(false);

  if (share === null || !share.enabled) {
    return (
      <div className="flex flex-col gap-2" data-testid="share-off">
        <p className="text-sm text-muted-foreground">
          This proof is not shared. Sharing creates a public link that needs no
          sign-in.
        </p>
        {setShare.isError && (
          <p role="alert" className="text-sm text-destructive">
            {message(setShare.error)}
          </p>
        )}
        <div>
          <Button
            variant="outline"
            disabled={setShare.isPending}
            onClick={() => setShare.mutate({ enabled: true })}
          >
            <LinkIcon />
            {setShare.isPending ? "Creating link…" : "Create a public link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="share-on">
      <p className="text-sm text-muted-foreground">
        Anyone with this link can view this proof - no sign-in needed.
      </p>
      <div className="flex max-w-md gap-2">
        <Input
          readOnly
          value={share.url}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(share.url).then(() => {
              setCopied(true);
              toast.add({ title: "Link copied", type: "success" });
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        {/* A same-tab Link, not target="_blank": the owner previewing their
            own share is common enough to be worth one click, and this is
            an ordinary client-side navigation like any other in this app -
            "Back" returns here. */}
        <Link
          href={`/p/${share.token}`}
          className={buttonVariants({ variant: "ghost" })}
        >
          View public page
        </Link>
      </div>
      {setShare.isError && (
        <p role="alert" className="text-sm text-destructive">
          {message(setShare.error)}
        </p>
      )}
      <div>
        <Button
          variant="ghost"
          disabled={setShare.isPending}
          onClick={() => setShare.mutate({ enabled: false })}
        >
          {setShare.isPending ? "Revoking…" : "Revoke link"}
        </Button>
      </div>
    </div>
  );
}
