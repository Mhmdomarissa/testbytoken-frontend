import { UnrecognisedValue } from "@/lib/api/tolerant";

export interface ScanFailureCopy {
  title: string;
  /** What the person should do next - the whole reason the kind exists (B0.5 B4). */
  guidance: string;
  /** False when scanning the same target again cannot help (we refused it). */
  retryable: boolean;
  /** Whether the fix is to change the target's address. */
  suggestsNewAddress: boolean;
}

/**
 * A Map, not an object literal: `kind` is a server string and
 * `{}["constructor"]` is a function, not undefined.
 *
 * The wording is ours; the server's `message` is shown alongside it
 * (React-escaped, never as HTML) because it carries the specifics - which
 * host, which status code. Anything not in the map, including a kind the
 * contract adds later, gets the generic entry that still says something
 * true and still lets the person try again - never a made-up specific.
 */
const COPY = new Map<string, ScanFailureCopy>([
  [
    "unreachable",
    {
      title: "We couldn't reach the site",
      guidance:
        "Check that the address is right and that the site is up, then scan again. If the address is wrong, change it.",
      retryable: true,
      suggestsNewAddress: true,
    },
  ],
  [
    "refused",
    {
      title: "The site refused our scanner",
      guidance:
        "The site answered but denied us - a firewall or bot protection is the usual cause. Allow our engine to reach it, then scan again.",
      retryable: true,
      suggestsNewAddress: false,
    },
  ],
  [
    "timeout",
    {
      title: "The site was too slow to scan",
      guidance:
        "It didn't respond in time. Try again; if it keeps happening, the site may be overloaded or blocking us quietly.",
      retryable: true,
      suggestsNewAddress: false,
    },
  ],
  [
    "blocked_by_guardrail",
    {
      title: "This address can't be scanned",
      guidance:
        "We refused this target: we only scan sites reachable from the public internet. Scanning it again won't change that - register a different address.",
      retryable: false,
      suggestsNewAddress: true,
    },
  ],
  [
    "internal",
    {
      title: "Our scanner failed",
      guidance:
        "This was our fault, not yours. Try again; if it fails a second time, contact support.",
      retryable: true,
      suggestsNewAddress: false,
    },
  ],
]);

const UNRECOGNISED: ScanFailureCopy = {
  title: "The scan failed for a reason this app doesn't recognise",
  guidance:
    "The message below is what the server reported. You can try again; if it keeps failing, contact support.",
  retryable: true,
  suggestsNewAddress: false,
};

export function scanFailureCopy(
  kind: string | UnrecognisedValue,
): ScanFailureCopy {
  if (kind instanceof UnrecognisedValue) return UNRECOGNISED;
  return COPY.get(kind) ?? UNRECOGNISED;
}
