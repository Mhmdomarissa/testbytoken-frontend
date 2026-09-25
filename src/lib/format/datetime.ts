/**
 * One way to write a date in the console (UI v2 V9's formatter, started in
 * V2 where the dashboard first needed it). Month in words, 24-hour time -
 * "25 Sept 2026, 18:00" - so it can't be read two ways, unlike
 * "09/09/2026". The viewer's own time zone unless one is given.
 */
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** A calendar date the server already bucketed ("2026-09-25" -> "25 Sept"). */
export function formatDay(date: string, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/** "4m 32s", "47s" - a span we measured between two server timestamps. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
