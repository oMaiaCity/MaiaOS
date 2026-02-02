#!/bin/bash
# Deploy all MaiaOS services to Fly.io
# Deploys: server (api-next-maia-city) and maia-city (next-maia-city)

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Deploying all MaiaOS services to Fly.io..."
echo ""

# Deploy server service first (dependency)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1/2: Deploying server service (api-next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"
flyctl deploy --dockerfile services/server/Dockerfile --config services/server/fly.toml --app api-next-maia-city

echo ""
echo "✅ Server service deployed!"
echo "   Health check: https://api-next-maia-city.fly.dev/health"
echo ""

# Deploy maia-city service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/2: Deploying maia-city service (next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"
flyctl deploy --dockerfile services/maia-city/Dockerfile --config services/maia-city/fly.toml --app next-maia-city

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service URLs:"
echo "   Frontend: https://next-maia-city.fly.dev"
echo "   Server:   https://api-next-maia-city.fly.dev/health"
echo ""
echo "⚠️  IMPORTANT: Verify environment variables are set:"
echo "   flyctl secrets list --app next-maia-city"
echo "   flyctl secrets list --app api-next-maia-city"
echo ""
echo "   Required secrets:"
echo "   - next-maia-city: PUBLIC_API_DOMAIN (REQUIRED for sync)"
echo "   - api-next-maia-city: JAZZ_API_KEY (REQUIRED for sync)"
echo ""
echo "🔍 Verify deployment:"
echo "   flyctl status --app next-maia-city"
echo "   flyctl status --app api-next-maia-city"
echo ""
