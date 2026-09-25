import { cn } from "@/lib/utils";

/**
 * The logomark (UI v2 §1.6): a gold ring, a thinner inner ring at 45%
 * opacity, and a check stroke - a token that was checked. Drawn in
 * `currentColor`, so it takes --gold from its context; decorative
 * wherever the wordmark sits beside it, so hidden from assistive tech.
 * The favicon, app icons and the OG mark come from this same geometry
 * (V7 / V9).
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0 text-(--gold)", className)}
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.25" />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.45"
      />
      <path
        d="M11.25 16.25l3.25 3.25 6.5-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
