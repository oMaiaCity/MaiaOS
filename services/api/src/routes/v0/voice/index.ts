/**
 * Voice routes
 * Handles Google Live Voice API endpoints
 * Requires api:voice capability (default deny - must explicitly grant access)
 * 
 * IMPORTANT: WebSocket routes bypass onBeforeHandle, so we need to:
 * 1. Block at HTTP level in global onBeforeHandle (checks Upgrade header)
 * 2. Check capability in WebSocket open handler as fallback
 */

import { Elysia } from "elysia";
import { voiceLiveHandler } from "./live";
import { allow } from "../../../lib/middleware/default-deny";

export const voiceRoutes = new Elysia({ prefix: "/api/v0/voice" })
    .ws("/live", voiceLiveHandler, {
        // Mark route as allowed so defaultDenyPlugin doesn't block it
        // Actual capability check happens in voiceLiveHandler.open()
        beforeHandle: [allow]
    });

