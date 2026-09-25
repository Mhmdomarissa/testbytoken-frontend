import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { MockingProvider } from "@/mocks/MockingProvider";
import { QueryProvider } from "@/lib/api/QueryProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

/**
 * Everything the signed-in console needs and a public page must not pay
 * for: the theme override, the mock worker gate, the TanStack Query
 * client, tooltips, toasts. ThemeProvider is outermost so its no-flash
 * script is in the server HTML even while MockingProvider holds rendering
 * in development.
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
    <ThemeProvider>
      <MockingProvider>
        <QueryProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </QueryProvider>
      </MockingProvider>
    </ThemeProvider>
  );
}
