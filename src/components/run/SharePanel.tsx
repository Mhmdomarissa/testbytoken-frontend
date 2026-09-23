"use client";

import { useEffect, useRef, useState } from "react";
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
  const on = share !== null && share.enabled;

  // Focus moves only because the person acted - never because something
  // finished loading. This panel used to take focus on mount, i.e. when
  // the proof arrived, which scrolled a finished run to the bottom of the
  // page and away from its verdict. Now: create a link and focus lands on
  // that link; revoke it and focus lands on "Create a public link". Either
  // way the button that was pressed unmounts in the swap, so without this
  // focus would drop to <body> (Phase B B10).
  const acted = useRef(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!acted.current) return;
    acted.current = false;
    (on ? linkRef : createRef).current?.focus();
  }, [on]);
  // A failed request swapped nothing, so there is nothing to follow - and a
  // later change this person didn't make mustn't inherit the intent.
  useEffect(() => {
    if (setShare.isError) acted.current = false;
  }, [setShare.isError]);
  const toggle = (enabled: boolean) => {
    acted.current = true;
    setShare.mutate({ enabled });
  };

  if (!on) {
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
            ref={createRef}
            variant="outline"
            disabled={setShare.isPending}
            onClick={() => toggle(true)}
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
          ref={linkRef}
          readOnly
          aria-label="Public link to this proof"
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
          onClick={() => toggle(false)}
        >
          {setShare.isPending ? "Revoking…" : "Revoke link"}
        </Button>
      </div>
    </div>
  );
}
