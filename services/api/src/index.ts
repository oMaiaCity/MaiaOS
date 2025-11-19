import { Elysia } from "elysia";
import { zeroRoutes } from "./routes/v0/zero";
import { voiceRoutes } from "./routes/v0/voice";
import { projects } from "./routes/v0/projects";
import { isTrustedOrigin } from "./lib/utils/trusted-origins";

const PORT = process.env.PORT || 4204;

const app = new Elysia()
  // ⚠️ NO auth routes mounted - wallet service handles all /api/auth/* routes
  // API service only verifies cookies (read-only), doesn't handle authentication
  // Zero sync endpoints (they handle CORS manually)
  .use(zeroRoutes)
  // Voice API endpoints (WebSocket)
  .use(voiceRoutes)
  // API endpoints - handle CORS manually (like hominio-me)
  .group("/api/v0", (app) => 
    app
      // Handle OPTIONS preflight for projects endpoint
      .options("/projects", ({ request, set }) => {
        const origin = request.headers.get('origin');
        if (origin && isTrustedOrigin(origin)) {
          set.headers['Access-Control-Allow-Origin'] = origin;
          set.headers['Access-Control-Allow-Credentials'] = 'true';
          set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
          set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie';
          set.headers['Access-Control-Max-Age'] = '86400';
        }
        return '';
      })
      .get("/projects", async ({ request }) => {
        return await projects({ request });
      })
  )
  .get("/health", () => ({ status: "ok" }))
  .listen(PORT);

console.log(
  `🦊 API service is running at ${app.server?.hostname}:${app.server?.port}`
);

