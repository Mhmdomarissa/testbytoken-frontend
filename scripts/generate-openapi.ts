import { writeFileSync } from "node:fs";
import path from "node:path";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/lib/contract/registry";

const generator = new OpenApiGeneratorV31(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Test by Token API",
    version: "0.1.0",
    description:
      "The contract the backend team implements to match this frontend. " +
      "Generated from Zod schemas in src/lib/contract/ - see docs/API_CONTRACT.md " +
      "for essential/nice-to-have status per endpoint and two open decisions " +
      "requiring sign-off (SSE auth, screenshot URL security).",
  },
  servers: [
    {
      url: "{backendOrigin}",
      description:
        "The backend's own origin - a separate service the browser calls " +
        "directly (CLAUDE.md: no Next.js proxy/BFF). Endpoint paths below " +
        "have no additional prefix, matching the brief's own endpoint list.",
      variables: {
        backendOrigin: { default: "https://api.testbytoken.example" },
      },
    },
  ],
});

const outputPath =
  process.argv[2] ?? path.join(import.meta.dirname, "..", "openapi.json");
writeFileSync(outputPath, JSON.stringify(document, null, 2) + "\n");

console.log(`Wrote ${outputPath}`);
