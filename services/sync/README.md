# Zero Sync Service

Zero sync service using Rocicorp's Zero sync engine for real-time data synchronization.

## Overview

This service runs `zero-cache-dev` (development) or `zero-cache` (production) to sync data from PostgreSQL to clients via WebSocket connections.

## Admin Password

The `--admin-password` flag is used for **debugging and administration** of the Zero cache server:

- **Purpose**: Access admin endpoints like `/statz` (stats endpoint) for monitoring and debugging
- **Required**: Optional, but recommended for production debugging
- **Value**: Uses `ZERO_AUTH_SECRET` (defaults to `AUTH_SECRET` if not set)
- **Security**: Should be a strong, random password (same as your `AUTH_SECRET`)

**What it's used for:**
- Accessing `/statz` endpoint for server statistics and health monitoring
- Debugging Zero cache server state
- Admin operations on the Zero sync service

**Note**: This is separate from user authentication - it's for server administration only. User authentication is handled via Better Auth cookies.

## Environment Variables

- `ZERO_POSTGRES_SECRET` - PostgreSQL connection string (non-pooler, required)
- `AUTH_SECRET` - Shared auth secret (used for admin password if `ZERO_AUTH_SECRET` not set)
- `ZERO_AUTH_SECRET` - Zero-specific auth secret (optional, defaults to `AUTH_SECRET`)

## Development

```bash
bun dev  # Runs migration + zero-cache-dev
```

## Production

Uses Docker image `rocicorp/zero:0.24.3000000000` with `zero-cache` binary.

