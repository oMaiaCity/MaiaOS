/**
 * Zero sync routes
 * Handles Zero sync endpoints (get-queries, push)
 * These routes filter by capabilities internally, so we allow them but they enforce their own security
 */

import { Elysia } from "elysia";
import { getQueries } from "./get-queries";
import { push } from "./push";
import { allow } from "../../../lib/middleware/default-deny";

export const zeroRoutes = new Elysia({ prefix: "/api/v0/zero" })
  .post("/get-queries", async ({ request }) => {
    return await getQueries({ request });
  }, { 
    beforeHandle: [allow] // Allow but filters internally by capabilities
  })
  .post("/push", async ({ request }) => {
    return await push({ request });
  }, { 
    beforeHandle: [allow] // Allow but checks capabilities internally
  });

