import type { Metadata } from "next";
import { ProofView } from "./ProofView";

/**
 * Deliberately static, not per-proof: `generateMetadata` and the OG image
 * route both run server-only (neither ships a byte to the client bundle),
 * but only the OG image route (opengraph-image.tsx, exempted in
 * route-boundary.test.ts with the reasoning written there) reads the
 * mock's data directly - keeping that concession to one file rather than
 * growing it into this one too. The OG image itself still carries the
 * real verdict and coverage; the meta title doesn't need to repeat it.
 */
export const metadata: Metadata = {
  title: "Shared proof",
  description: "An auditable proof of a test run, shared by its owner.",
};

export default async function PublicProofPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ProofView token={token} />;
}
