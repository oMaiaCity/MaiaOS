#!/bin/bash
# Deploy script for maia-city
# No build secrets needed - sync service handles sync API key

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
    
    # VITE_SEED_VIBES defaults to "all" in Dockerfile (seeds all vibes)
    # To override, pass --build-arg VITE_SEED_VIBES="todos,maia" manually
    # Or set as Fly.io secret and it will be available as env var (but needs build-time injection)
    # For now, default to "all" - users can override via fly.toml [build] section if needed
    echo "   Using VITE_SEED_VIBES=all (default - seeds all vibes)"
    
    # Run deploy and capture exit code
    flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 2>&1 | tee /tmp/flyctl-deploy.log
    
    local deploy_exit_code=${PIPESTATUS[0]}
    
    # Check if deployment command succeeded FIRST
    if [ $deploy_exit_code -eq 0 ]; then
      # Deployment succeeded - verify it's actually running
      # (Don't check for build errors here - if exit code is 0, deployment worked)
      # Verify app is actually running and healthy
      echo "Checking deployment status..."
      local status_output=$(flyctl status --app "$app_name" 2>&1)
      if [ $? -eq 0 ] && echo "$status_output" | grep -qE "running|started"; then
        # Check if machines are healthy
        local machines_output=$(flyctl machines list --app "$app_name" 2>&1)
        if echo "$machines_output" | grep -qE "started|running"; then
          echo "✅ Deployment verified: $app_name is running"
          return 0
        else
          echo "⚠️  App exists but no healthy machines found"
          echo "$machines_output"
          return 1
        fi
      else
        echo "⚠️  Deployment command succeeded but app is not running"
        echo "$status_output"
        return 1
      fi
    else
      # Deployment failed - check for specific error types
      if grep -qiE "Build failed|error during build|failed to build|build.*failed" /tmp/flyctl-deploy.log 2>/dev/null; then
        echo "❌ Build failed detected in deployment log"
        echo "Last 30 lines of build output:"
        tail -30 /tmp/flyctl-deploy.log
        return 1
      fi
    fi

    # Check if it's a network error (retryable)
    if grep -qE "EOF|connection|timeout|network" /tmp/flyctl-deploy.log 2>/dev/null; then
      retry_count=$((retry_count + 1))
      if [ $retry_count -lt $max_retries ]; then
        echo "⚠️  Network/EOF error detected. Waiting ${wait_time}s before retry..."
        sleep $wait_time
        wait_time=$((wait_time * 2))
      fi
    else
      echo "❌ Non-network error detected. Stopping retries."
      echo "Last 20 lines of output:"
      tail -20 /tmp/flyctl-deploy.log
      return 1
    fi
  done

  echo "❌ Deployment failed after $max_retries attempts"
  return 1
}

echo "🚀 Deploying maia-city to Fly.io..."
echo "   App: next-maia-city"
echo ""

cd "$MONOREPO_ROOT"

# Build bundles and maia-city frontend (required before Docker - avoids workspace resolution in Docker)
echo "📦 Building kernel, vibes, and maia-city frontend..."
if ! bun run bundles:build; then
  echo "❌ Failed to build bundles"
  exit 1
fi
if ! (cd services/maia-city && NODE_ENV=production VITE_SEED_VIBES=all bunx vite build --mode production); then
  echo "❌ Failed to build maia-city frontend"
  exit 1
fi
echo "✅ Build complete"
echo ""

if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/maia-city/Dockerfile" \
  "services/maia-city/fly.toml"; then
  echo "❌ Failed to deploy maia-city service after retries"
  exit 1
fi

# Scale to 1 machine (downgrade from 2 if needed)
echo ""
echo "📊 Scaling to 1 machine..."
flyctl scale count 1 --app "next-maia-city" || {
  echo "⚠️  Warning: Failed to scale machines (may already be at 1)"
}

echo ""
echo "✅ Deployment complete!"
echo "   URL: https://next-maia-city.fly.dev"
echo ""
echo "⚠️  IMPORTANT: Verify PUBLIC_API_DOMAIN secret is set:"
echo "   flyctl secrets list --app next-maia-city"
echo ""
echo "   If not set, sync will not work! Set it with:"
echo "   flyctl secrets set PUBLIC_API_DOMAIN=\"sync-next-maia-city.fly.dev\" --app next-maia-city"
echo "   (or for custom domain: sync.next.maia.city)"
echo ""
echo "   Note: VITE_SEED_VIBES defaults to \"all\" (seeds all vibes automatically)"
echo "   To override: flyctl deploy --build-arg VITE_SEED_VIBES=\"todos,maia\" --app next-maia-city"
