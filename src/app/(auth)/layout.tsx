import { MockingProvider } from "@/mocks/MockingProvider";

/**
 * Pre-auth pages (sign-in): the dev mock gate and nothing else. No Query
 * client, tooltips, toasts or shell - a visitor who isn't signed in yet
 * shouldn't download the console to see a form. The gate is needed because
 * sign-in fetches the mock backend directly (a passthrough in production).
 * Kept honest by src/app/route-boundary.test.ts.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MockingProvider>{children}</MockingProvider>;
}
