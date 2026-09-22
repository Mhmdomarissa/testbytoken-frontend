import { MockingProvider } from "@/mocks/MockingProvider";
import { PublicMain } from "./PublicMain";

/**
 * The public proof page's own layout: the dev mock gate, a main landmark
 * with route-change focus management, and nothing else. No shell, no
 * Query client, no tooltips/toasts - the root layout already supplies
 * fonts/tokens/dark theme to every route, and that's all a REAL
 * deployment of this page would get. Phase B B9: "does not import the
 * app shell."
 *
 * `MockingProvider` is here only because this page talks to the mock
 * directly (a plain `fetch()`, no data layer) and, in this pre-backend
 * phase, that fetch needs MSW's worker started in its OWN tab to resolve
 * at all - see route-boundary.test.ts's PUBLIC_TIER comment for what was
 * actually observed without it. It is a no-op outside development
 * (MockingProvider's own gate), so a real deployment carries nothing extra
 * for it.
 *
 * `PublicMain` is here for the same reason ShellMain.tsx exists on the
 * console side (Phase B B10): this route group is reachable by a
 * same-tab client-side transition (SharePanel's "View public page" link),
 * not only a cold load, and Next.js does not move focus on that kind of
 * transition itself.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockingProvider>
      <PublicMain>{children}</PublicMain>
    </MockingProvider>
  );
}
