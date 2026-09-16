import { http } from "msw";
import { z } from "zod";
import { SuiteSchema, SuiteVersionSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { suites, suiteCheckoutVersions } from "../data";

export const suiteHandlers = [
  http.get("*/suites", async () => {
    return json(z.array(SuiteSchema), suites);
  }),

  http.get("*/suites/:id", async ({ params }) => {
    const suite = suites.find((s) => s.id === params.id);
    if (!suite) return errorResponse(404, "not_found", "Suite not found.");
    return json(SuiteSchema, suite);
  }),

  http.get("*/suites/:id/versions", async ({ params }) => {
    if (params.id !== suiteCheckoutVersions[0]?.suite_id) {
      return json(z.array(SuiteVersionSchema), []);
    }
    return json(z.array(SuiteVersionSchema), suiteCheckoutVersions);
  }),
];
