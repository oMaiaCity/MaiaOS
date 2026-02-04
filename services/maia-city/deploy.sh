#!/bin/bash
# Deploy script for maia-city
# No build secrets needed - server service handles sync API key

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Retry function for flyctl commands
retry_flyctl_deploy() {
  local app_name=$1
  local dockerfile=$2
  local config=$3
  local max_retries=3
  local retry_count=0
  local wait_time=5

  while [ $retry_count -lt $max_retries ]; do
    echo "Attempt $((retry_count + 1))/$max_retries: Deploying $app_name..."
    
    if flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 2>&1 | tee /tmp/flyctl-deploy.log; then
      if flyctl status --app "$app_name" > /dev/null 2>&1; then
        echo "✅ Deployment verified: $app_name is running"
        return 0
      fi
    fi

    if grep -q "EOF\|connection\|timeout" /tmp/flyctl-deploy.log 2>/dev/null; then
      retry_count=$((retry_count + 1))
      if [ $retry_count -lt $max_retries ]; then
        echo "⚠️  Network/EOF error detected. Waiting ${wait_time}s before retry..."
        sleep $wait_time
        wait_time=$((wait_time * 2))
      fi
    else
      echo "❌ Non-network error detected. Stopping retries."
      return 1
    fi
  done

  if flyctl status --app "$app_name" > /dev/null 2>&1; then
    echo "✅ Deployment actually succeeded despite errors! App is running."
    return 0
  fi

  echo "❌ Deployment failed after $max_retries attempts"
  return 1
}

echo "🚀 Deploying maia-city to Fly.io..."
echo "   App: next-maia-city"
echo ""

cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/maia-city/Dockerfile" \
  "services/maia-city/fly.toml"; then
  echo "❌ Failed to deploy maia-city service after retries"
  exit 1
fi

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
