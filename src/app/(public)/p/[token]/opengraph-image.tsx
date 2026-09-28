import { ImageResponse } from "next/og";
import { OG_PALETTE } from "./og-palette";
import { apiGet } from "@/lib/api/client";
import { isUnrecognised } from "@/lib/api/tolerant";
import { PublicProofSchema } from "@/lib/contract";

// Mock-backed build? Written out here, not imported: Next inlines
// process.env.NEXT_PUBLIC_* only at the use site, and only then can the
// build drop the mock-only code below (docs/DEPLOYMENT.md).
const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "on";

/**
 * Server-only: never ships a byte of JS to any client (and is the one file
 * under (public) exempt from the mock-import rule in
 * src/app/route-boundary.test.ts, for that reason). It reads the proof
 * through loadOgProof below: the mock store in a mock-backed build, the
 * API's GET /p/{token} otherwise.
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

/** What the OG card draws - a finished proof's headline, nothing more. */
interface OgProof {
  targetName: string;
  /** The raw verdict, known or not (an unknown one is shown as sent). */
  verdict: string;
  passRate: number;
  generated: number;
  candidate: number;
}

/**
 * The shared proof behind an OG image, or null if the token doesn't
 * resolve (invalid, expired or revoked). Server-side only.
 *
 * With mocking on, it reads the mock's proof store directly: this route
 * runs in the Next server, and MSW only intercepts in the browser, so a
 * fetch here would reach nothing - a mock-phase concession. With mocking
 * off, that branch and its import of the mock layer are dead code and are
 * removed from the build (scripts/check-mocks-in-build.mjs), and the
 * image is built the intended way: GET /p/{token} from the API, parsed
 * through the contract like every other response.
 */
async function loadOgProof(token: string): Promise<OgProof | null> {
  if (MOCKING) {
    const { findProofByShareToken } = await import("@/mocks/handlers/proofs");
    const snapshot = findProofByShareToken(token)?.snapshot;
    if (!snapshot) return null;
    return {
      targetName: snapshot.target.name,
      verdict: snapshot.verdict,
      passRate: snapshot.pass_rate,
      generated: snapshot.coverage.generated,
      candidate: snapshot.coverage.candidate,
    };
  }
  try {
    const { snapshot } = await apiGet(
      `/p/${encodeURIComponent(token)}`,
      PublicProofSchema,
    );
    return {
      targetName: snapshot.target.name,
      verdict: isUnrecognised(snapshot.verdict)
        ? snapshot.verdict.raw
        : snapshot.verdict,
      passRate: snapshot.pass_rate,
      generated: snapshot.coverage.generated,
      candidate: snapshot.coverage.candidate,
    };
  } catch {
    // Not found, revoked, or the API unreachable: the generic card, which
    // claims nothing about any run.
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proof = await loadOgProof(token);

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

  const verdict = proof.verdict;
  const verdictColor = VERDICT_COLOR[verdict] ?? CREAM;
  const verdictLabel = VERDICT_LABEL[verdict] ?? verdict;
  const percent = Math.round(proof.passRate * 100);

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
        <div style={{ fontSize: 56, display: "flex" }}>{proof.targetName}</div>
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
          {proof.generated} of {proof.candidate} covered
        </div>
      </div>
    </div>,
    size,
  );
}
