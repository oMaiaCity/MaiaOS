import { Elysia } from "elysia";
import { zeroRoutes } from "./routes/v0/zero";
import { voiceRoutes } from "./routes/v0/voice";
import { projects } from "./routes/v0/projects";
import { authPlugin } from "./lib/middleware/auth";
import { errorHandlerPlugin } from "./lib/middleware/error-handler";
import { handleOptions } from "./lib/middleware/cors";
import { defaultDenyPlugin, allow, requireAuth } from "./lib/middleware/default-deny";

const PORT = process.env.PORT || 4204;

const app = new Elysia()
  // Global error handler
  .use(errorHandlerPlugin)
  // Global auth plugin (extracts authData, doesn't require auth)
  .use(authPlugin)
  // Handle OPTIONS preflight globally (allow OPTIONS requests)
  .onBeforeHandle(async ({ request, set, path }) => {
    // Block WebSocket upgrades for voice API BEFORE upgrade happens (default deny)
    // WebSocket upgrades have "Upgrade: websocket" header
    const upgradeHeader = request.headers.get('upgrade');
    if (upgradeHeader?.toLowerCase() === 'websocket' && path.startsWith('/api/v0/voice')) {
      // Extract auth data manually (authPlugin might not have run yet for WebSocket upgrades)
      const { extractAuthData } = await import('./lib/auth-context');
      let authData;
      
      console.log(`[default-deny] 🔍 WebSocket upgrade detected for ${path}`);
      console.log(`[default-deny] 🔍 Request headers:`, {
        cookie: request.headers.get('cookie') ? 'present' : 'missing',
        origin: request.headers.get('origin'),
        upgrade: request.headers.get('upgrade')
      });
      
      try {
        authData = await extractAuthData(request);
        console.log(`[default-deny] 🔍 Auth extraction result:`, authData ? `authenticated as ${authData.sub}` : 'not authenticated');
      } catch (error) {
        console.error(`[default-deny] ❌ Auth extraction failed:`, error);
        console.log(`[default-deny] ❌ BLOCKED WebSocket upgrade to ${path} - auth extraction failed`);
        set.status = 401;
        throw new Error(`Unauthorized: Authentication required for WebSocket connection`);
      }
      
      if (!authData) {
        console.log(`[default-deny] ❌ BLOCKED WebSocket upgrade to ${path} - not authenticated (no authData)`);
        set.status = 401;
        throw new Error(`Unauthorized: Authentication required for WebSocket connection`);
      }
      
      // Check api:voice capability
      const { checkCapability } = await import('@hominio/caps');
      const principal = `user:${authData.sub}`;
      console.log(`[default-deny] 🔍 Checking capability for user ${authData.sub} (principal: ${principal})`);
      
      let hasVoiceCapability = false;
      try {
        hasVoiceCapability = await checkCapability(
          principal,
          { type: 'api', namespace: 'voice' },
          'read'
        );
        console.log(`[default-deny] 🔍 Capability check result: ${hasVoiceCapability}`);
      } catch (error) {
        console.error(`[default-deny] ❌ Error checking capability:`, error);
        // Default deny on error
        hasVoiceCapability = false;
      }
      
      if (!hasVoiceCapability) {
        console.log(`[default-deny] ❌ BLOCKED WebSocket upgrade to ${path} - user ${authData.sub} does not have api:voice capability`);
        set.status = 403;
        throw new Error(`Forbidden: No api:voice capability. Access denied by default.`);
      }
      
      console.log(`[default-deny] ✅ ALLOWED WebSocket upgrade to ${path} - user ${authData.sub} has api:voice capability`);
      // Don't return - let the upgrade proceed
    }
    
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
  .listen(PORT);

console.log(
  `🦊 API service is running at ${app.server?.hostname}:${app.server?.port}`
);

