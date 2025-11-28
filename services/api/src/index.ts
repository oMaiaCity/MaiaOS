import { Elysia } from "elysia";

// Force reload: 2024-11-28 12:00 PM
import { zeroRoutes } from "./routes/v0/zero";
import { voiceRoutes } from "./routes/v0/voice";
import { projects } from "./routes/v0/projects";
import { authPlugin } from "./lib/middleware/auth";
import { errorHandlerPlugin } from "./lib/middleware/error-handler";
import { handleOptions } from "./lib/middleware/cors";
import { defaultDenyPlugin, allow, requireAuth } from "./lib/middleware/default-deny";

const PORT = process.env.PORT || 4204;
const HOST = process.env.HOST || '0.0.0.0';

const app = new Elysia()
  // Global error handler
  .use(errorHandlerPlugin)
  // Global auth plugin (extracts authData, doesn't require auth)
  .use(authPlugin)
  // Handle OPTIONS preflight globally (allow OPTIONS requests)
  .onBeforeHandle(async ({ request, path }) => {
    // Note: WebSocket upgrades for /api/v0/voice are handled in the WebSocket handler's open() method
    // This allows the upgrade to happen, then the handler checks capabilities and closes with proper error codes
    // This gives better error messages to the browser (close code 1008 with reason) vs blocking before upgrade
    
    const optionsResponse = handleOptions(request);
    if (optionsResponse) {
      return optionsResponse;
    }
  })
  // Health check - explicitly allow (no auth needed)
  .get("/health", () => ({ status: "ok" }), { beforeHandle: [allow] })
  // ⚠️ NO auth routes mounted - wallet service handles all /api/auth/* routes
  // API service only verifies cookies (read-only), doesn't handle authentication
  // Zero sync endpoints (they handle CORS manually and filter internally)
  .use(zeroRoutes)
  // Voice API endpoints (WebSocket - requires auth, handled internally)
  .use(voiceRoutes)
  // API endpoints - explicitly allow with auth requirement
  .group("/api/v0", (app) => 
    app
      .get("/projects", async ({ authData, request }) => {
        return await projects({ request, authData });
      }, { beforeHandle: [allow] }) // Explicitly allow this route
  )
  // DEFAULT DENY: Lock down all routes by default (MUST be last)
  // This runs AFTER all routes are registered, so it can check if they're allowed
  .use(defaultDenyPlugin)
  .listen({ port: Number(PORT), hostname: HOST });

console.log(
  `🦊 API service is running at ${HOST}:${PORT} (v0.14.0)`
);
