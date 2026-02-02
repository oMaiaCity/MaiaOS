#!/bin/bash
# Deploy script for server service to Fly.io

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying server service to Fly.io..."
echo "   App: api-next-maia-city"
echo ""

cd "$MONOREPO_ROOT"
flyctl deploy --dockerfile services/server/Dockerfile --config services/server/fly.toml --app api-next-maia-city

echo ""
echo "✅ Deployment complete!"
echo "   Health check: https://api-next-maia-city.fly.dev/health"
echo "   WebSocket: wss://api-next-maia-city.fly.dev/sync"
