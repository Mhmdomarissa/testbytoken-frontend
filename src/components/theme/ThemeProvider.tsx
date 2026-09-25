"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The console's theme: the system setting by default, overridable by the
 * person (the toggle arrives with the shell, UI v2 V1) and remembered.
 *
 * next-themes' inline script, not a cookie: it sets `.light` / `.dark` on
 * <html> before first paint, so there is no flash, and it needs nothing
 * from the server. A cookie would have to be read in the ROOT layout
 * (the only place that renders <html>), which would make every route
 * dynamic - the public proof page and the landing included. The script's
 * content is fixed, so the deploy's CSP can allow it by hash or nonce.
 *
 * Console only. The landing, the proof page and sign-in follow the system
 * through CSS alone (`color-scheme` + light-dark() in styles/tokens.css)
 * and ship no theming JavaScript. `disableTransitionOnChange` is left off
 * on purpose: it works by injecting a <style> element, which a strict CSP
 * would block.
 */
/**
 * The no-flash script only needs to run once: in the server HTML, on a full
 * page load. When React creates it in the browser instead (a client-side
 * navigation into the console, e.g. sign-in -> overview), it can never
 * execute, and React 19 logs "Encountered a script tag while rendering
 * React component" - caught by e2e/cold-start.spec.ts, which requires a
 * clean console. React skips that warning for a non-JavaScript `type` (a
 * "data block"), so the client-rendered copy is typed as data. The
 * server/client attribute difference is expected: next-themes already sets
 * suppressHydrationWarning on this one element.
 */
const SCRIPT_PROPS = {
  type: typeof window === "undefined" ? "text/javascript" : "application/json",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="tbt-theme"
      scriptProps={SCRIPT_PROPS}
    >
      {children}
    </NextThemesProvider>
  );
}
