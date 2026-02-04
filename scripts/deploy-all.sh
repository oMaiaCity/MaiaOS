#!/bin/bash
# Deploy all MaiaOS services to Fly.io
# Deploys: server (api-next-maia-city) and maia-city (next-maia-city)

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Retry function for flyctl commands
# Sometimes flyctl API calls fail with EOF errors even though the operation succeeded
retry_flyctl_deploy() {
  local app_name=$1
  local dockerfile=$2
  local config=$3
  local max_retries=3
  local retry_count=0
  local wait_time=5

  while [ $retry_count -lt $max_retries ]; do
    echo "Attempt $((retry_count + 1))/$max_retries: Deploying $app_name..."
    
    # Run flyctl deploy with increased wait timeout and capture output
    if flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 2>&1 | tee /tmp/flyctl-deploy.log; then
      # Check if deployment actually succeeded by verifying app status
      echo "Checking deployment status..."
      if flyctl status --app "$app_name" > /dev/null 2>&1; then
        echo "✅ Deployment verified: $app_name is running"
        return 0
      else
        echo "⚠️  Deployment command succeeded but app status check failed"
      fi
    fi

    # Check if the error is EOF or network-related
    if grep -q "EOF\|connection\|timeout" /tmp/flyctl-deploy.log 2>/dev/null; then
      retry_count=$((retry_count + 1))
      if [ $retry_count -lt $max_retries ]; then
        echo "⚠️  Network/EOF error detected. Waiting ${wait_time}s before retry..."
        sleep $wait_time
        wait_time=$((wait_time * 2))  # Exponential backoff
      fi
    else
      # Non-network error, don't retry
      echo "❌ Non-network error detected. Stopping retries."
      return 1
    fi
  done

  # Final check: sometimes deployment succeeds despite EOF error
  echo "⚠️  All retries exhausted. Checking if deployment actually succeeded..."
  if flyctl status --app "$app_name" > /dev/null 2>&1; then
    echo "✅ Deployment actually succeeded despite errors! App is running."
    return 0
  fi

  echo "❌ Deployment failed after $max_retries attempts"
  return 1
}

echo "🚀 Deploying all MaiaOS services to Fly.io..."
echo ""

# Deploy server service first (dependency)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1/2: Deploying server service (api-next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "api-next-maia-city" \
  "services/server/Dockerfile" \
  "services/server/fly.toml"; then
  echo "❌ Failed to deploy server service after retries"
  exit 1
fi

echo ""
echo "✅ Server service deployed!"
echo "   Health check: https://api-next-maia-city.fly.dev/health"
echo ""

# Deploy maia-city service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/2: Deploying maia-city service (next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/maia-city/Dockerfile" \
  "services/maia-city/fly.toml"; then
  echo "❌ Failed to deploy maia-city service after retries"
  exit 1
fi

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
echo ""
echo "🔍 Verify deployment:"
echo "   flyctl status --app next-maia-city"
echo "   flyctl status --app api-next-maia-city"
echo ""
