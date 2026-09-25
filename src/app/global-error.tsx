"use client";

/**
 * Catches a crash in the root layout itself - the one place ErrorState's
 * usual chrome (sidebar, fonts, tokens) can't be assumed to have rendered,
 * so this renders its own minimal, dependency-free HTML document per
 * Next's global-error convention.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0a1120",
          color: "#edf1f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ padding: "3rem", maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.8, fontSize: "0.875rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              border: "1px solid #edf1f7",
              background: "transparent",
              color: "#edf1f7",
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
