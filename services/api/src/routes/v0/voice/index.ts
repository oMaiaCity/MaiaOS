import { Elysia } from "elysia";
import { voiceLiveHandler } from "./live";
import { voiceLiveNextHandler } from "./live-next";
import { allow } from "../../../lib/middleware/default-deny";

export const voiceRoutes = new Elysia({ prefix: "/api/v0/voice" })
    .ws("/live", voiceLiveHandler, {
        beforeHandle: [allow]
    })
    .ws("/live-next", voiceLiveNextHandler, {
        beforeHandle: [allow]
    });
