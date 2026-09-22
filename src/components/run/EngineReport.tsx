"use client";

import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; html: string };

/**
 * The engine's generated HTML report: content it produced from a site we
 * do not control, so it is untrusted no differently than a step's message
 * or a page title (CLAUDE.md section 1.4). Rendered ONLY in a sandboxed
 * iframe with NO tokens on the sandbox attribute - no allow-scripts, no
 * allow-same-origin, no allow-popups, nothing - the strictest sandbox a
 * browser has: scripts in the report cannot run, and even if they somehow
 * did, allow-same-origin is absent so they could never read this page's
 * cookies or DOM.
 *
 * Loaded via `fetch()` + `srcDoc`, not `src={url}` pointed straight at the
 * report endpoint. Found the hard way: a browser's service worker (which
 * is how MSW intercepts requests in this app) does not intercept iframe
 * NAVIGATION requests the way it intercepts `fetch()`/`XMLHttpRequest`/
 * `<img>` subresource loads - an `<iframe src="...">` pointed at a
 * mock-only path went straight to the real network and 404'd, even though
 * `fetch()` to the identical URL worked every time (confirmed by tracing
 * whether the mock's request handlers were even invoked: they were not,
 * for the iframe case, in every real-browser run tried). `srcDoc` makes no
 * network request of its own - the HTML arrives over the SAME fetch a
 * client already uses for every other endpoint, and the iframe still gets
 * an opaque, sandboxed origin with `sandbox=""` regardless of how its
 * content arrived (this is a spec guarantee, not specific to `src`).
 * e2e/media.spec.ts checks the report's own hostile script never reaches
 * this page, not just that the request nominally "succeeded".
 */
export function EngineReport({ url }: { url: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  // Reset during render, not in the effect below, when `url` itself
  // changes - the React-recommended way to "adjust state when a prop
  // changes" without an extra render pass (same pattern as
  // useJobEvents.ts's `trackedJobId`).
  const [trackedUrl, setTrackedUrl] = useState(url);
  if (url !== trackedUrl) {
    setTrackedUrl(url);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        return res.text();
      })
      .then((html) => {
        if (!cancelled) setState({ status: "ready", html });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Couldn't load the report. Please try again.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading the report…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.message}
      </p>
    );
  }
  return (
    <iframe
      data-testid="engine-report"
      srcDoc={state.html}
      sandbox=""
      title="Engine report"
      className="h-120 w-full border border-border"
    />
  );
}
