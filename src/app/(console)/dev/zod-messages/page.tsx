import { notFound } from "next/navigation";
import { ZodMessages } from "./ZodMessages";

// Mock-backed build? Written out here, not imported: Next inlines
// process.env.NEXT_PUBLIC_* only at the use site, and only then can the
// build drop the mock-only code below (docs/DEPLOYMENT.md).
const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "on";

/**
 * Test harness, not a product screen: shows what zod's default validation
 * messages look like in the BUNDLED client, so e2e/zod-messages.spec.ts can
 * prove the locale-trim workaround (scripts/zod-locale-trim-loader.cjs)
 * left English intact. Exists only in mock-backed builds (dev, and the
 * demo's production build - where it's most worth checking); 404s in a
 * real build. Skipped by the bundle budget.
 */
export default function ZodMessagesPage() {
  if (!MOCKING) notFound();
  return <ZodMessages />;
}
