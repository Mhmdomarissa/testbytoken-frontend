import path from "node:path";
import type { NextConfig } from "next";
import { resolveMocking } from "./scripts/mocking-env.mjs";
import { syncMswWorker } from "./scripts/msw-worker.mjs";

// Fails the build (and `next dev`) on an invalid flag, or on mocking
// together with a real API base URL - see scripts/mocking-env.mjs.
const mocking = resolveMocking(process.env);
// public/mockServiceWorker.js exists exactly when mocking is on.
syncMswWorker(mocking);

const nextConfig: NextConfig = {
  // Always defined, "on" or "off", so every build inlines a constant at
  // each `process.env.NEXT_PUBLIC_API_MOCKING === "on"` gate - an unset
  // variable isn't inlined, and a runtime lookup would keep the mock layer
  // in a real build (docs/DEPLOYMENT.md).
  env: { NEXT_PUBLIC_API_MOCKING: mocking ? "on" : "off" },
  async headers() {
    return [
      {
        // The demo's mock service worker must never be served from a
        // cache: a redeploy that upgrades msw has to reach the browser's
        // update check at once (docs/DEPLOYMENT.md, "Service worker
        // updates"). Browsers already bypass the HTTP cache for a worker's
        // own script; this keeps any CDN or proxy in between from holding
        // it too. Absent from a real build, where the file isn't served.
        source: "/mockServiceWorker.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  images: {
    // The landing page's stock photography (docs/PHASE_LANDING_POLISH.md,
    // L5): served through the image optimizer rather than vendored.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
      },
    ],
  },
  turbopack: {
    rules: {
      // Strip the OpenAPI-only layer (descriptions, path registration,
      // the zod-to-openapi setup) from the contract for every app bundle.
      // See scripts/openapi-strip-loader.cjs; scripts/check-contract-prose.mjs
      // fails CI if any of it still ships.
      "*.ts": {
        condition: { path: /^src\/lib\/contract\/[^/]+\.ts$/ },
        // The loader returns TypeScript, not JavaScript.
        as: "*.ts",
        loaders: [
          path.resolve(import.meta.dirname, "scripts/openapi-strip-loader.cjs"),
        ],
      },
      // TEMPORARY (2026-09-21): keep zod's 60+ unused locales out of the
      // client bundle. Explained, with upstream links and the delete-when
      // condition, in scripts/zod-locale-trim-loader.cjs.
      "*.js": {
        condition: {
          path: /node_modules\/zod\/v4\/(classic\/external|core\/index)\.js$/,
        },
        loaders: [
          path.resolve(
            import.meta.dirname,
            "scripts/zod-locale-trim-loader.cjs",
          ),
        ],
      },
    },
  },
};

export default nextConfig;
