import { cn } from "@/lib/utils";

/**
 * Phase B, §1.3: "If the engine could not ground a flow - no locator,
 * ambiguous element, login never cleared - that is a first-class result
 * the user must see, with the reason. Skipped and ungrounded items are
 * not filtered out of lists, not collapsed by default, and not excluded
 * from counts without the exclusion being stated on screen."
 *
 * One place to render "why", reused across every shape that carries a
 * reason: a Step's `message` (always present, including on `skipped`
 * and `fail`), an Element's `reason_not_locatable` (set when
 * `uniquely_locatable` is false), and whatever a future compose/plan
 * endpoint returns for a step the system couldn't ground (contract gap -
 * see B1's report). Always rendered inline, at full length - never a
 * tooltip, a truncated line, or a detail hidden behind a click, which
 * would be exactly the kind of quiet exclusion §1.3 rules out.
 *
 * Content rendered here is scraped from a site we do not control (an
 * assertion message can quote page text) - plain JSX text interpolation
 * only, matching CLAUDE.md's `dangerouslySetInnerHTML` ban and the XSS
 * fixture test (src/mocks/xss-safety.test.tsx already proves plain
 * interpolation renders hostile content as inert text; this component
 * relies on that same guarantee for its own `reason` string).
 */
const VARIANT_LABEL: Record<ResultReasonVariant, string> = {
  skipped: "Skipped",
  ungrounded: "Not locatable",
  fail: "Failed",
  timed_out: "Timed out",
};

export type ResultReasonVariant =
  "skipped" | "ungrounded" | "fail" | "timed_out";

export function ResultReason({
  reason,
  variant,
  className,
}: {
  reason: string;
  variant: ResultReasonVariant;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <span className="font-medium text-foreground">
        {VARIANT_LABEL[variant]}:
      </span>{" "}
      {reason}
    </p>
  );
}
