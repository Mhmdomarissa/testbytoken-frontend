import { ImageResponse } from "next/og";
import { OG_PALETTE } from "./og-palette";
import { findProofByShareToken } from "@/mocks/handlers/proofs";

/**
 * Server-only: never ships a byte of JS to any client, so it is exempt
 * from src/app/route-boundary.test.ts's "nothing under (public) reaches
 * the console/mocks" rule (see that file's own comment on this
 * exemption). That's also why it's the ONE place in this route allowed
 * to import the mock's internals directly, by necessity rather than
 * choice: this route runs in the Next server process, which has no HTTP
 * path back into the mock (MSW's browser worker only intercepts
 * BROWSER-side requests - a server-side `fetch()` here would hit nothing
 * and 404). A real backend wouldn't have this problem - this route would
 * do an ordinary server-side fetch to its own API, which works fine
 * against a real server; the direct import is a mock-phase-only
 * concession, not the intended shape.
 *
 * Phase B B9 + section 1.2: an OG image showing a pass rate MUST carry
 * coverage alongside it, same as everywhere else pass rate appears - so
 * this can't be a static placeholder, it has to read the real proof.
 */
export const alt = "Test by Token — auditable proof";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// satori can't read CSS custom properties; the palette is kept in step
// with styles/tokens.css by og-palette.test.ts.
const BLUE_DEEP = OG_PALETTE.page;
const BLUE_MID = OG_PALETTE.card;
const GOLD = OG_PALETTE.gold;
const CREAM = OG_PALETTE.ink;
const VERDICT_COLOR = OG_PALETTE.verdict;
const VERDICT_LABEL: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
  timed_out: "Timed out",
};

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proof = findProofByShareToken(token);

  if (!proof) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BLUE_DEEP,
          color: `rgba(248, 244, 238, 0.6)`,
          fontSize: 40,
        }}
      >
        Test by Token
      </div>,
      size,
    );
  }

  const { snapshot } = proof;
  const verdict = snapshot.verdict;
  const verdictColor = VERDICT_COLOR[verdict] ?? CREAM;
  const verdictLabel = VERDICT_LABEL[verdict] ?? verdict;
  const percent = Math.round(snapshot.pass_rate * 100);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BLUE_DEEP,
        padding: 64,
        color: CREAM,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 24, color: GOLD, letterSpacing: 2 }}>
          TEST BY TOKEN — AUDITABLE PROOF
        </div>
        <div style={{ fontSize: 56, display: "flex" }}>
          {snapshot.target.name}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: BLUE_MID,
            border: `2px solid ${verdictColor}`,
            padding: "12px 24px",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              background: verdictColor,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 32, color: verdictColor, display: "flex" }}>
            {verdictLabel}
          </div>
        </div>
        <div style={{ fontSize: 40, display: "flex" }}>{percent}% pass</div>
        {/* Pass rate never ships alone (CLAUDE.md / Phase B section 1.2) -
              coverage is on the SAME card, not a separate call. */}
        <div
          style={{
            fontSize: 32,
            color: "rgba(248, 244, 238, 0.7)",
            display: "flex",
          }}
        >
          {snapshot.coverage.generated} of {snapshot.coverage.candidate} covered
        </div>
      </div>
    </div>,
    size,
  );
}
