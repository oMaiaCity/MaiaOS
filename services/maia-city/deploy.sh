#!/bin/bash
# Deploy script for maia-city
# No build secrets needed - server service handles sync API key

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying maia-city to Fly.io..."
echo "   App: next-maia-city"
echo ""

cd "$MONOREPO_ROOT"
flyctl deploy --dockerfile services/maia-city/Dockerfile --config services/maia-city/fly.toml --app next-maia-city

echo ""
echo "✅ Deployment complete!"
echo "   URL: https://next-maia-city.fly.dev"
echo ""
echo "⚠️  IMPORTANT: Verify PUBLIC_API_DOMAIN secret is set:"
echo "   flyctl secrets list --app next-maia-city"
echo ""
echo "   If not set, sync will not work! Set it with:"
echo "   flyctl secrets set PUBLIC_API_DOMAIN=\"api-next-maia-city.fly.dev\" --app next-maia-city"
echo "   (or for custom domain: api.next.maia.city)"
