import { OctagonXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnrecognisedValue, truncateRaw } from "@/lib/api/tolerant";
import { scanFailureCopy } from "./scanFailure";

/**
 * A failed scan is a designed state (Phase B B3), not a toast: which
 * thing went wrong, what the server said, and what to do - with only the
 * actions that can actually help (a scan we refused on principle has no
 * "Scan again").
 */
export function ScanFailurePanel({
  failure,
  onScanAgain,
  onChangeAddress,
  scanning,
}: {
  failure: { kind: string | UnrecognisedValue; message: string };
  onScanAgain: () => void;
  onChangeAddress: () => void;
  scanning: boolean;
}) {
  const copy = scanFailureCopy(failure.kind);
  return (
    <div
      role="group"
      aria-label="Why the last scan failed"
      data-testid="scan-failure"
      data-failure-kind={
        failure.kind instanceof UnrecognisedValue
          ? "unrecognised"
          : failure.kind
      }
      className="flex flex-col gap-2 border border-border bg-card p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium">
        <OctagonXIcon className="size-4 shrink-0" aria-hidden="true" />
        {copy.title}
      </div>
      {failure.kind instanceof UnrecognisedValue && (
        <p className="font-mono text-xs text-muted-foreground">
          kind: {truncateRaw(failure.kind.raw)}
        </p>
      )}
      <p className="text-muted-foreground">{failure.message}</p>
      <p>{copy.guidance}</p>
      <div className="flex flex-wrap gap-2">
        {copy.retryable && (
          <Button size="sm" onClick={onScanAgain} disabled={scanning}>
            Scan again
          </Button>
        )}
        {copy.suggestsNewAddress && (
          <Button
            size="sm"
            variant={copy.retryable ? "outline" : "default"}
            onClick={onChangeAddress}
          >
            Change address
          </Button>
        )}
      </div>
    </div>
  );
}
