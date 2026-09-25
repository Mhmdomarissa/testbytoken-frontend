/**
 * The OG image's colours. satori (what ImageResponse renders with) can't
 * read CSS custom properties, so this is the one sanctioned place for raw
 * hex outside styles/tokens.css (UI v2 exception). An image has no colour
 * scheme to follow, so these are each token's DARK value.
 *
 * og-palette.test.ts parses styles/tokens.css and fails if any of these
 * drifts from its token - edit the token, then this, never only this.
 */
export const OG_PALETTE = {
  page: "#0a1120", // --surface-page (dark)
  card: "#111c31", // --surface-card (dark)
  gold: "#d4b27a", // --gold (dark)
  ink: "#edf1f7", // --ink (dark)
  verdict: {
    passed: "#72dba3", // --status-pass-fg (dark)
    failed: "#e05a61", // --status-fail-fg (dark)
    cancelled: "#919bab", // --status-cancelled-fg (dark)
    timed_out: "#b68e47", // --status-timed-out-fg (dark)
  } as Record<string, string>,
};

/** Which token each constant must equal (read by og-palette.test.ts). */
export const OG_TOKEN_OF = {
  page: "surface-page",
  card: "surface-card",
  gold: "gold",
  ink: "ink",
  verdict: {
    passed: "status-pass-fg",
    failed: "status-fail-fg",
    cancelled: "status-cancelled-fg",
    timed_out: "status-timed-out-fg",
  } as Record<string, string>,
};
