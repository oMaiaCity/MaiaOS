# Deployment Guide

## Overview

This document describes the deployment process for the Hominio monorepo services to Fly.io.

## Services

### 1. Sync Service (`hominio-sync`)
- **App Name**: `hominio-sync` (new Fly.io app)
- **Domain**: `sync.hominio.me`
- **Port**: `4848` (internal)
- **Deployment**: Triggered on successful release via `deploy-sync.yml`
- **Migrations**: Runs automatically via GitHub Actions before deployment

### 2. API Service (`hominio-api`)
- **App Name**: `hominio-api` (new Fly.io app)
- **Domain**: `api.hominio.me`
- **Port**: `4204` (internal)
- **Deployment**: Triggered on successful release via `deploy-api.yml`

## GitHub Secrets Required

All secrets must be set in the **PRODUCTION** environment in GitHub:

### Zero Sync Service Secrets
- `ZERO_POSTGRES_SECRET` - PostgreSQL connection string (non-pooler, required)
- `ZERO_AUTH_SECRET` - Zero auth secret (for JWT verification)
- `ZERO_GET_QUERIES_URL` - (Optional, defaults to `https://api.hominio.me/api/v0/zero/get-queries`)
- `ZERO_PUSH_URL` - (Optional, defaults to `https://api.hominio.me/api/v0/zero/push`)

### API Service Secrets
- `ZERO_POSTGRES_SECRET` - PostgreSQL connection string (same as sync service)
- `AUTH_POSTGRES_SECRET` - Better Auth database connection
- `AUTH_SECRET` - Better Auth secret (must match wallet service)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
- `ADMIN` - Admin user ID (optional)
- `PUBLIC_DOMAIN_API` - API domain (defaults to `api.hominio.me`)
- `PUBLIC_DOMAIN_SYNC` - Sync domain (defaults to `sync.hominio.me`)

## Deployment Flow

1. **Release Workflow** (`release.yml`)
   - Runs semantic-release on push to `main`
   - Creates git tag and GitHub release
   - Triggers deployment workflows

2. **Sync Service Deployment** (`deploy-sync.yml`)
   - Triggered after successful release
   - Deploys to `hominio-me-sync` Fly.io app
   - Runs migrations before deployment
   - Deploys Zero schema permissions

3. **API Service Deployment** (`deploy-api.yml`)
   - Triggered after successful release
   - Deploys to `hominio-api` Fly.io app

## Migration Process

### Sync Service Migrations
Migrations run automatically in GitHub Actions **before** deployment:
1. Wait for health check to pass
2. Setup Bun
3. Install dependencies
4. Run `bun run scripts/zero-migrate.js` (creates tables, adds example project if empty)
5. Deploy Zero schema permissions via `zero-deploy-permissions`

**Note**: Migrations run in GitHub Actions, not in the Docker container. This ensures migrations complete before the service starts.

## Environment Variables

### Sync Service (`hominio-sync`)
- `ZERO_UPSTREAM_DB` - Mapped from `ZERO_POSTGRES_SECRET`
- `ZERO_POSTGRES_SECRET` - PostgreSQL connection
- `ZERO_AUTH_SECRET` - Auth secret
- `ZERO_GET_QUERIES_URL` - API endpoint for synced queries
- `ZERO_PUSH_URL` - API endpoint for custom mutators
- `ZERO_GET_QUERIES_FORWARD_COOKIES` - `true`
- `ZERO_MUTATE_FORWARD_COOKIES` - `true`

### API Service (`hominio-api`)
- `ZERO_POSTGRES_SECRET` - Zero database connection
- `AUTH_POSTGRES_SECRET` - Better Auth database connection
- `AUTH_SECRET` - Better Auth secret (must match wallet service)
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `ADMIN` - Admin user ID
- `PUBLIC_DOMAIN_API` - API domain
- `PUBLIC_DOMAIN_SYNC` - Sync domain

## DNS Configuration

### Sync Service
- **Type**: CNAME
- **Name**: `sync`
- **Value**: `hominio-sync.fly.dev`
- **TTL**: 300

### API Service
- **Type**: CNAME
- **Name**: `api`
- **Value**: `hominio-api.fly.dev`
- **TTL**: 300

Fly.io will automatically provision Let's Encrypt certificates once DNS records are configured.

## Manual Deployment

You can manually trigger deployments via GitHub Actions:
1. Go to Actions → Deploy Sync Service / Deploy API Service
2. Click "Run workflow"
3. Select branch: `main`
4. Click "Run workflow"

## Troubleshooting

### Sync Service
- Check logs: `flyctl logs --app hominio-sync`
- Check status: `flyctl status --app hominio-sync`
- Verify secrets: `flyctl secrets list --app hominio-sync`

### API Service
- Check logs: `flyctl logs --app hominio-api`
- Check status: `flyctl status --app hominio-api`
- Verify secrets: `flyctl secrets list --app hominio-api`

### Migration Issues
- Migrations run in GitHub Actions, check workflow logs
- Ensure `ZERO_POSTGRES_SECRET` is set correctly
- Verify database connection is non-pooler (required for logical replication)

