import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

/**
 * Side-effect module: patches `.openapi()` onto every Zod schema. Must be
 * imported before any `.openapi()` call - every file in this directory
 * imports this one first for that reason. Importing it more than once is
 * safe (idempotent).
 */
extendZodWithOpenApi(z);
