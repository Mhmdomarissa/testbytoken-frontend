"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlobeIcon, PlusIcon } from "lucide-react";
import { useTargets } from "@/lib/api/queries/targets";
import { isUnrecognised } from "@/lib/api/tolerant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button, buttonVariants } from "@/components/ui/button";

type Target = NonNullable<ReturnType<typeof useTargets>["data"]>[number];

/**
 * Why a target can or can't be composed against right now - read from the
 * scan the server reported, never inferred. Only a COMPLETED scan grounds a
 * plan (the compose page enforces the same rule).
 */
function readiness(t: Target): { ready: true } | { ready: false; why: string } {
  const scan = t.last_scan;
  if (scan === null) return { ready: false, why: "Never scanned" };
  if (isUnrecognised(scan.status))
    return {
      ready: false,
      why: `Scan state not recognised: ${scan.status.raw}`,
    };
  switch (scan.status) {
    case "completed":
      return { ready: true };
    case "queued":
    case "crawling":
      return { ready: false, why: "Scan in progress" };
    case "parked":
      return { ready: false, why: "Scan waiting for a sign-in" };
    case "failed":
      return { ready: false, why: "Last scan failed" };
    default:
      return { ready: false, why: "Not scanned yet" };
  }
}

/**
 * "New test" (UI v2 V1): compose needs a target, so this asks which one.
 * Keyboard-first - it opens with the list focused for arrows and Enter.
 * Scanned targets are selectable; every other target is listed, disabled,
 * with its reason. No targets at all: an empty state that leads to adding
 * one. Exactly one ready target: it is preselected, but still shown, so
 * the person confirms where the test will run.
 */
export function TargetPicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>New test</DialogTitle>
          <DialogDescription>
            Choose the target to compose a test for.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: the targets are fetched when asked for. */}
        {open && <PickerBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const targets = useTargets();
  const list = targets.data ?? [];
  const readyIds = list.filter((t) => readiness(t).ready).map((t) => t.id);
  const [value, setValue] = useState<string | undefined>(undefined);
  // Exactly one ready target: preselect it (until the person moves).
  const selected = value ?? (readyIds.length === 1 ? readyIds[0] : undefined);

  function go(id: string) {
    onDone();
    router.push(`/targets/${id}/compose`);
  }

  if (targets.isPending) {
    return (
      <p role="status" className="px-5 py-6 text-sm text-muted-foreground">
        Loading targets…
      </p>
    );
  }

  if (targets.isError) {
    return (
      <div role="alert" className="flex flex-col gap-3 px-5 py-6 text-sm">
        <p>Couldn&apos;t load your targets.</p>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void targets.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 py-6 text-sm">
        <p className="font-medium">No targets yet</p>
        <p className="text-muted-foreground">
          A test runs against a registered, scanned target. Add the site you
          want tested first.
        </p>
        <Link
          href="/targets"
          onClick={onDone}
          className={buttonVariants({ size: "sm" })}
        >
          <PlusIcon aria-hidden="true" />
          Add a target
        </Link>
      </div>
    );
  }

  return (
    <Command
      value={selected ?? ""}
      onValueChange={setValue}
      className="rounded-none bg-transparent"
    >
      <CommandInput placeholder="Filter targets…" autoFocus />
      <CommandList className="max-h-80">
        <CommandEmpty>No target matches.</CommandEmpty>
        <CommandGroup>
          {list.map((t) => {
            const r = readiness(t);
            return (
              <CommandItem
                key={t.id}
                value={t.id}
                keywords={[t.name, t.base_url]}
                disabled={!r.ready}
                onSelect={() => r.ready && go(t.id)}
                data-testid={`pick-${t.id}`}
                // Disabled targets stay fully legible: the reason IS the
                // content, so it must meet contrast like any other text.
                className="items-start py-2 data-[disabled=true]:opacity-100"
              >
                <GlobeIcon aria-hidden="true" className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      r.ready
                        ? "truncate font-medium"
                        : "truncate font-medium text-(--ink-muted)"
                    }
                    title={t.name}
                  >
                    {t.name}
                  </span>
                  <span
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={t.base_url}
                  >
                    {t.base_url}
                  </span>
                </span>
                {!r.ready && (
                  <span className="shrink-0 self-center text-xs text-muted-foreground">
                    {r.why}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
