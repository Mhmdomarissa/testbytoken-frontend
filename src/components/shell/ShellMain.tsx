"use client";

import { usePathname } from "next/navigation";
import { useFocusRegionOnChange } from "@/hooks/useFocusRegionOnChange";

/**
 * The console shell's main landmark - and, critically, the thing that
 * receives focus on every route into the shell (Phase B B10). A full page
 * load resets focus for free; a next/link transition does not - Next.js
 * has no built-in equivalent. Without this, a keyboard or screen-reader
 * user who activates a link lands on whatever the PREVIOUS screen's
 * focused element becomes once it's unmounted: nothing, silently, with
 * focus dropped to <body> and no sense of where they are. Found by driving
 * the whole spine keyboard-only in one sitting, not per-screen - every
 * per-screen keyboard test starts with page.goto(), which resets focus for
 * free and can't see this gap.
 *
 * Also fires on this component's OWN first mount, deliberately not just
 * later pathname changes: this layout is shared across every route under
 * it, so its first mount IS the first client-side transition into the
 * shell for the session (e.g. straight from sign-in) - exactly the kind of
 * hop this exists to catch, not a hard page load with its own fine
 * default focus state. `tabIndex={-1}` makes it programmatically focusable
 * without joining the normal Tab order.
 */
export function ShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useFocusRegionOnChange<HTMLElement>(pathname);

  return (
    <main
      ref={ref}
      tabIndex={-1}
      className="flex-1 overflow-y-auto p-6 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </main>
  );
}
