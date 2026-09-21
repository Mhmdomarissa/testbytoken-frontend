import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    },
  },
};

export default nextConfig;
