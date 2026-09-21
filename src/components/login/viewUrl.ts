/**
 * The live browser lives on a SEPARATE origin (docs/API_CONTRACT.md: it is
 * an untrusted-content origin, and it must not share an origin with the
 * app). The server says so; the client checks, because a `view_url` on our
 * own origin - or a non-https one - means something is wrong upstream and
 * the safe response is to refuse to open it, not to trust it.
 */
export type ViewUrl =
  | { ok: true; href: string; host: string }
  | { ok: false; reason: "missing" | "invalid" | "insecure" | "same_origin" };

export function checkViewUrl(
  viewUrl: string | null,
  appOrigin: string,
): ViewUrl {
  if (viewUrl === null) return { ok: false, reason: "missing" };
  let url: URL;
  try {
    url = new URL(viewUrl);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.username !== "" || url.password !== "")
    return { ok: false, reason: "invalid" };
  if (url.protocol !== "https:") return { ok: false, reason: "insecure" };
  if (url.origin === appOrigin) return { ok: false, reason: "same_origin" };
  return { ok: true, href: url.href, host: url.host };
}

/**
 * The single-use ticket in `view_url` is valid for at most 60 seconds. It
 * is offered only while the reading it came from is younger than this, so a
 * stale link (a backgrounded tab, a stalled poll) is refreshed, never
 * offered and never stored.
 */
export const TICKET_MAX_AGE_MS = 45_000;

export function ticketIsFresh(
  fetchedAtMs: number,
  nowMs: number,
  maxAgeMs: number = TICKET_MAX_AGE_MS,
): boolean {
  return fetchedAtMs > 0 && nowMs - fetchedAtMs <= maxAgeMs;
}
