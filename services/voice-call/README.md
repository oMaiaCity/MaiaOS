# Voice Call Service

Simple WebSocket proxy service for Google Live Voice API, designed for the MaiaCity wallet browser extension.

## Overview

This service provides a WebSocket endpoint (`/api/v0/voice/live`) that proxies voice calls between the wallet extension client and Google's Live API using the `@maia/voice` package.

## Architecture

```
Wallet Extension (Sidepanel)
    ↓ WebSocket (ws://localhost:4201/api/v0/voice/live)
Voice Call Service (Pure Bun)
    ↓ Google Live API (via @maia/voice)
Google GenAI
```

## Setup

1. **Environment Variables** (in root `.env`):
   ```bash
   GOOGLE_AI_API_KEY=your-google-api-key
   PUBLIC_DOMAIN_VOICE=localhost:4201
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

3. **Run Development Server**:
   ```bash
   bun run dev
   ```

## Endpoints

- **WebSocket**: `ws://localhost:4201/api/v0/voice/live`
- **Health Check**: `http://localhost:4201/health`

## Message Protocol

### Client → Server

- `{ type: "audio", data: string, mimeType?: string }` - Send audio data (base64 encoded)
- `{ type: "text", text: string, turnComplete?: boolean }` - Send text message
- `{ type: "activityEnd" }` - Signal end of user activity

### Server → Client

- `{ type: "audio", data: string, mimeType?: string }` - Receive audio response
- `{ type: "transcript", role: "user"|"model", text: string }` - Transcript updates
- `{ type: "toolCall", name: string, args: object, result: any, contextString?: string }` - Tool execution
- `{ type: "status", status: "connected"|"disconnected" }` - Connection status
- `{ type: "log", message: string, context?: string }` - Log messages
- `{ type: "interrupted" }` - AI was interrupted
- `{ type: "error", message: string }` - Error occurred

## Features

- Pure Bun implementation (no Elysia overhead)
- Simple WebSocket proxy pattern
- Automatic session cleanup on disconnect
- Error handling and logging

## Port Configuration

The service reads the port from `PUBLIC_DOMAIN_VOICE` environment variable:
- Format: `hostname:port` (e.g., `localhost:4201`)
- Or just port number: `4201`
- Default: `4201` if not specified

