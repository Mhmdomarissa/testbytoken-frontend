import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
