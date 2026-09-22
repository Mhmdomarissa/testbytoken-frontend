import type { z } from "zod";
import type { ProofSnapshotSchema } from "@/lib/contract";
import { UnrecognisedValue, truncateRaw } from "@/lib/api/tolerant";
import type { Tolerated } from "@/lib/api/tolerant";

type Uncovered = Tolerated<z.infer<typeof ProofSnapshotSchema>>["uncovered"];

/** `not_uniquely_locatable` -> "not uniquely locatable". A code from the server, shown as text. */
function humanise(code: string): string {
  return code.replace(/_/g, " ");
}

/**
 * Phase B B9: "shows what was NOT covered, not just what passed - a proof
 * that hides the gaps is not a proof." Always rendered, including the
 * empty case, so "nothing uncovered" is a stated fact on screen rather
 * than an absent section a reader has to interpret. `label`, `page_url`
 * and `reason` are all untrusted text scraped from the tested site or
 * written by the planner - plain interpolation, never markup.
 */
export function UncoveredList({
  uncovered,
  total,
}: {
  uncovered: Uncovered;
  total: number;
}) {
  return (
    <section
      className="flex flex-col gap-2"
      aria-label="Not covered"
      data-testid="uncovered-list"
    >
      <h2 className="font-heading text-lg font-light">Not covered ({total})</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every candidate was covered.
        </p>
      ) : (
        <>
          {uncovered.length < total && (
            <p className="text-sm text-muted-foreground">
              Showing {uncovered.length} of {total}.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {uncovered.map((u, i) => (
              <li
                key={i}
                className="border-l-2 border-(--status-warning-chip-fill) pl-3 text-sm"
              >
                <p className="break-words font-medium">
                  {u.label === "" ? (
                    <span className="text-muted-foreground">(no label)</span>
                  ) : (
                    u.label
                  )}
                </p>
                <p
                  className="truncate font-mono text-xs text-muted-foreground"
                  title={u.page_url}
                >
                  {u.page_url}
                </p>
                <p className="break-words text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {u.reason_code instanceof UnrecognisedValue
                      ? `unrecognised: ${truncateRaw(u.reason_code.raw)}`
                      : humanise(u.reason_code)}
                    :
                  </span>{" "}
                  {u.reason}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
