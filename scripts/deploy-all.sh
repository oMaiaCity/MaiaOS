#!/bin/bash
# Deploy all MaiaOS services to Fly.io
# Deploys: sync service (sync-next-maia-city) and maia-city (next-maia-city)

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
    flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 2>&1 | tee /tmp/flyctl-deploy.log
    
    local deploy_exit_code=${PIPESTATUS[0]}
    
    # Check for build failures in the log
    if grep -qiE "Build failed|ERROR|error.*build|failed.*build|exit code 1" /tmp/flyctl-deploy.log 2>/dev/null; then
      echo "❌ Build failed detected in deployment log"
      echo "Last 20 lines of build output:"
      tail -20 /tmp/flyctl-deploy.log
      return 1
    fi
    
    # Check if deployment command succeeded
    if [ $deploy_exit_code -eq 0 ]; then
      # Verify app is actually running (not just that status command works)
      echo "Checking deployment status..."
      local status_output=$(flyctl status --app "$app_name" 2>&1)
      if [ $? -eq 0 ] && echo "$status_output" | grep -q "running\|started"; then
        echo "✅ Deployment verified: $app_name is running"
        return 0
      else
        echo "⚠️  Deployment command succeeded but app is not running"
        echo "Status output: $status_output"
      fi
    fi

    # Check if the error is EOF or network-related (retryable)
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
      echo "Last 20 lines of error output:"
      tail -20 /tmp/flyctl-deploy.log
      return 1
    fi
  done

  # Final check: sometimes deployment succeeds despite EOF error
  echo "⚠️  All retries exhausted. Checking if deployment actually succeeded..."
  local status_output=$(flyctl status --app "$app_name" 2>&1)
  if [ $? -eq 0 ] && echo "$status_output" | grep -q "running\|started"; then
    echo "✅ Deployment actually succeeded despite errors! App is running."
    return 0
  fi

  echo "❌ Deployment failed after $max_retries attempts"
  echo "Last 20 lines of error output:"
  tail -20 /tmp/flyctl-deploy.log
  return 1
}

echo "🚀 Deploying all MaiaOS services to Fly.io..."
echo ""

# Build bundles locally before Docker builds
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building kernel and vibes bundles..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! bun run bundles:build; then
  echo "❌ Failed to build bundles. Aborting deployment."
  exit 1
fi

echo ""
echo "✅ Bundles built successfully!"
echo ""

# Deploy sync service first (dependency)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1/2: Deploying sync service (sync-next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "sync-next-maia-city" \
  "services/sync/Dockerfile" \
  "services/sync/fly.toml"; then
  echo "❌ Failed to deploy sync service after retries"
  exit 1
fi

echo ""
echo "✅ Sync service deployed!"
echo "   Health check: https://sync-next-maia-city.fly.dev/health"
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
echo "   Sync:     https://sync-next-maia-city.fly.dev/health"
echo ""
echo "⚠️  IMPORTANT: Verify environment variables are set:"
echo "   flyctl secrets list --app next-maia-city"
echo "   flyctl secrets list --app sync-next-maia-city"
echo ""
echo "   Required secrets:"
echo "   - next-maia-city: PUBLIC_API_DOMAIN (REQUIRED for sync)"
echo ""
echo "🔍 Verify deployment:"
echo "   flyctl status --app next-maia-city"
echo "   flyctl status --app sync-next-maia-city"
echo ""
