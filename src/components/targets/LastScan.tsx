import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { UnrecognisedValue } from "@/lib/api/tolerant";

const SCAN_LABELS = new Map<string, string>([
  ["queued", "Queued"],
  ["crawling", "Scanning"],
  ["parked", "Needs sign-in"],
  ["completed", "Complete"],
  ["failed", "Failed"],
]);

/** The wording for a scan status on a chip; undefined for a value we don't know (the chip then shows the raw value). */
export function scanStatusLabel(
  status: string | UnrecognisedValue,
): string | undefined {
  return status instanceof UnrecognisedValue
    ? undefined
    : SCAN_LABELS.get(status);
}

const formatWhen = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** `Target.last_scan`, as a cell: never blank - "Never scanned" is stated, not implied. */
export function LastScan({
  scan,
}: {
  scan: {
    status: string | UnrecognisedValue;
    updated_at: string;
  } | null;
}) {
  if (scan === null) {
    return <span className="text-muted-foreground">Never scanned</span>;
  }
  const label = scanStatusLabel(scan.status);
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={toBadgeStatus(scan.status)} label={label} />
      <span className="text-xs text-muted-foreground">
        {formatWhen.format(new Date(scan.updated_at))}
      </span>
    </div>
  );
}
