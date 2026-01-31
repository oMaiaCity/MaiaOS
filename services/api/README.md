# API Service

Unified API proxy service for external APIs (Honcho, RedPill, Google Voice), keeping API keys secure server-side.

## Overview

This service provides REST endpoints for Honcho memory operations and RedPill LLM chat, plus a WebSocket endpoint for Google Live Voice API. All API keys are kept server-side and never exposed to clients.

## Architecture

```
Browser Client
  ↓ HTTP/REST calls (no API keys)
API Service (Pure Bun, port 4201)
  ↓ Server-side API calls (with API keys)
Honcho API / RedPill API / Google Voice API
```

## Setup

1. **Environment Variables** (in root `.env`):
   ```bash
   # Server-side only (never exposed to client)
   HONCHO_API_KEY=your-honcho-api-key
   HONCHO_API_URL=https://api.honcho.dev
   RED_PILL_API_KEY=your-redpill-api-key
   GOOGLE_AI_API_KEY=your-google-api-key
   
   # Public (client can access)
   PUBLIC_DOMAIN_API=localhost:4201
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

3. **Run Development Server**:
   ```bash
   bun run dev
   ```

## REST Endpoints

### Memory Endpoints (Honcho)

All memory endpoints use `POST` with JSON body:

**Create Session:**
```bash
POST /api/v0/memory/create-session
Body: { workspaceId?: string, peerId: string, sessionId?: string }
Response: { sessionId: string, workspaceId: string, peerId: string }
```

**Add Message:**
```bash
POST /api/v0/memory/add-message
Body: { workspaceId?: string, sessionId: string, peerId: string, content: string }
Response: { success: boolean, sessionId: string, peerId: string, content: string }
```

**Get Context:**
```bash
POST /api/v0/memory/get-context
Body: { workspaceId?: string, peerId: string, sessionId?: string, query: string, target?: string }
Response: { context: string }
```

**Chat:**
```bash
POST /api/v0/memory/chat
Body: { workspaceId?: string, peerId: string, sessionId?: string, query: string, target?: string }
Response: { response: string }
```

### LLM Endpoint (RedPill)

**Chat Completions:**
```bash
POST /api/v0/llm/chat
Body: { messages: Array<{role: string, content: string}>, model?: string, temperature?: number }
Response: { content: string, role: string, usage?: object }
```

## WebSocket Endpoint

**Voice (Google Live API):**
```bash
ws://localhost:4201/api/v0/voice/live
```

See original voice-call service documentation for WebSocket message protocol.

## Health Check

```bash
GET /health
Response: { status: "ok", service: "api" }
```

## Error Handling

All endpoints return:
- `400` for invalid request body/missing parameters
- `500` for server errors (with error message in body)
- `200` for success (with result in body)

Error response format:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Features

- Pure Bun implementation (no framework overhead)
- Server-side API key management (never exposed to client)
- CORS support for browser requests
- REST endpoints for Honcho and RedPill
- WebSocket proxy for Google Voice API
- Error handling and logging

## Port Configuration

The service reads the port from `PUBLIC_DOMAIN_API` environment variable:
- Format: `hostname:port` (e.g., `localhost:4201`)
- Or just port number: `4201`
- Default: `4201` if not specified
