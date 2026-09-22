import { http, HttpResponse } from "msw";

/**
 * Backs every rehosted `Step.screenshot_url` (see respond.ts's
 * `rehostMediaUrls` and data.ts's SCREENSHOT_ORIGIN comment). One tiny,
 * deterministic placeholder image regardless of path - what matters for
 * the reference mock is that a real request round-trips to a real image
 * response, not what the picture shows.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
<rect width="320" height="200" fill="#0d2244"/>
<text x="50%" y="50%" fill="#f8f4ee" font-family="monospace" font-size="14" text-anchor="middle" dominant-baseline="middle">mock screenshot</text>
</svg>`;

function placeholder() {
  return new HttpResponse(PLACEHOLDER_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}

export const screenshotHandlers = [
  // Two explicit shapes (both exist in the fixtures: `/screenshots/0.png`
  // and `/screenshots/run_fail_1/2.png`) rather than a trailing wildcard -
  // a chained `*/screenshots/*` pattern proved unreliable to match via
  // real <img> element requests in a real browser (intermittent 404s
  // against MSW's own path matcher, not reproducible through fetch()
  // alone - found by actually loading the image in Playwright, not by
  // reasoning about it).
  http.get("*/screenshots/:file", placeholder),
  http.get("*/screenshots/:run/:file", placeholder),
];
