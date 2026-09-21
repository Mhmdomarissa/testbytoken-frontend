import { notFound } from "next/navigation";
import { ZodMessages } from "./ZodMessages";

/**
 * Test harness, not a product screen: shows what zod's default validation
 * messages look like in the BUNDLED client, so e2e/zod-messages.spec.ts can
 * prove the locale-trim workaround (scripts/zod-locale-trim-loader.cjs)
 * left English intact. 404s in production; skipped by the bundle budget.
 */
export default function ZodMessagesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ZodMessages />;
}
