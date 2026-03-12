#!/bin/bash
# Deploy script for app
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
    
    # VITE_SEED_AVENS defaults to "all" in build (seeds all avens)
    # To override, pass --build-arg VITE_SEED_AVENS="todos,chat" manually
    echo "   Using VITE_SEED_AVENS=all (default - seeds all avens)"
    
    # Run deploy - explicit build args ensure VITE_PEER_SYNC_HOST is in bundle (sync domain)
    flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 \
      --build-arg VITE_PEER_SYNC_HOST="${VITE_PEER_SYNC_HOST}" \
      --build-arg VITE_PEER_APP_HOST=next.maia.city 2>&1 | tee /tmp/flyctl-deploy.log
    
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

echo "🚀 Deploying app to Fly.io..."
echo "   App: next-maia-city"
echo ""

cd "$MONOREPO_ROOT"

# Verify build args before deploy (VITE_PEER_SYNC_HOST = sync domain, not app)
bun scripts/fly-build-args-verify.js || exit 1
echo ""

# Optional: override via env - VITE_PEER_SYNC_HOST must be sync domain (not app)
VITE_PEER_SYNC_HOST="${VITE_PEER_SYNC_HOST:-sync.next.maia.city}"
export VITE_PEER_SYNC_HOST
if [[ "$VITE_PEER_SYNC_HOST" != "sync.next.maia.city" ]] && [[ "$VITE_PEER_SYNC_HOST" != "sync-next-maia-city.fly.dev" ]]; then
  echo "⚠️  VITE_PEER_SYNC_HOST=$VITE_PEER_SYNC_HOST (custom - ensure sync is at this domain)"
fi

# App build runs in Docker - VITE_PEER_SYNC_HOST passed as --build-arg
if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/app/Dockerfile" \
  "services/app/fly.toml"; then
  echo "❌ Failed to deploy app service after retries"
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
echo "   Sync domain: VITE_PEER_SYNC_HOST from fly.toml [build.args] (sync.next.maia.city)"
echo "   To override: fly deploy --build-arg VITE_PEER_SYNC_HOST=custom.domain.com --app next-maia-city"
