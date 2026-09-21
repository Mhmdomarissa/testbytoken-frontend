import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { MockingProvider } from "@/mocks/MockingProvider";
import { QueryProvider } from "@/lib/api/QueryProvider";

/**
 * Everything the signed-in console needs and a public page must not pay
 * for: the mock worker gate, the TanStack Query client, tooltips, toasts.
 * They live HERE, not in the root layout, so a route outside this group
 * (the public proof page, B9) ships none of them - see
 * src/app/root-boundary.test.ts, which keeps it that way.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockingProvider>
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryProvider>
    </MockingProvider>
  );
}
