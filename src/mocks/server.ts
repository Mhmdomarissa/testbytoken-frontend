import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** For tests and any server-side code path that needs the mock API. */
export const server = setupServer(...handlers);
