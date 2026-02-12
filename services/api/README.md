# API Service

Unified API proxy for RedPill LLM, keeping API keys secure server-side.

## Overview

REST endpoint for RedPill LLM chat. API keys are kept server-side and never exposed to clients.

## Architecture

```
Browser Client
  ↓ HTTP/REST (no API keys)
API Service (Bun, port 4201)
  ↓ Server-side API calls (with API keys)
RedPill API
```

## Setup

1. **Environment Variables** (in root `.env`):
   ```bash
   RED_PILL_API_KEY=your-redpill-api-key
   PUBLIC_DOMAIN_API=localhost:4201
   ```

2. **Run Development Server**:
   ```bash
   bun run dev
   ```

## REST Endpoints

### LLM (RedPill)

**Chat Completions:**
```bash
POST /api/v0/llm/chat
Body: { messages: Array<{role: string, content: string}>, model?: string, temperature?: number }
Response: { content: string, role: string, usage?: object }
```

Uses RedPill OpenAI-compatible API. Model configurable per request.

## Health Check

```bash
GET /health
Response: { status: "ok", service: "api" }
```

## Port Configuration

Reads port from `PUBLIC_DOMAIN_API`:
- Format: `hostname:port` (e.g., `localhost:4201`)
- Default: `4201`
