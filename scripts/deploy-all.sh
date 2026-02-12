#!/bin/bash
# Deploy all MaiaOS services to Fly.io
# Deploys: moai service (moai-next-maia-city) and maia (next-maia-city)

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
  local extra_args="${4:-}"
  local max_retries=3
  local retry_count=0
  local wait_time=5

  while [ $retry_count -lt $max_retries ]; do
    echo "Attempt $((retry_count + 1))/$max_retries: Deploying $app_name..."
    
    # Run flyctl deploy with increased wait timeout and capture output
    # --auto-confirm: required when removing volumes (old PGlite) - Fly prompts to destroy machine otherwise
    flyctl deploy \
      --dockerfile "$dockerfile" \
      --config "$config" \
      --app "$app_name" \
      --wait-timeout 600 \
      --auto-confirm \
      $extra_args 2>&1 | tee /tmp/flyctl-deploy.log
    
    local deploy_exit_code=${PIPESTATUS[0]}

    # Check if deployment command succeeded first
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

    # Deploy failed - check for build failures vs retryable network errors
    if grep -qiE "Build failed|build error|failed to build image|ERROR.*build" /tmp/flyctl-deploy.log 2>/dev/null; then
      echo "❌ Build failed detected in deployment log"
      echo "Last 20 lines of build output:"
      tail -20 /tmp/flyctl-deploy.log
      return 1
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

# Moai deploy - requires manual secrets: PEER_ID, PEER_SECRET, PEER_DB_URL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1/2: Deploying moai service (moai-next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "moai-next-maia-city" \
  "services/moai/Dockerfile" \
  "services/moai/fly.toml" \
  "--ha=false"; then
  echo "❌ Failed to deploy moai service after retries"
  exit 1
fi

# Enforce single machine for moai (sync service must not scale beyond 1)
echo "Enforcing single machine for moai..."
flyctl scale count 1 --app moai-next-maia-city --yes

echo ""
echo "✅ Sync service deployed!"
echo "   Health check: https://moai-next-maia-city.fly.dev/health"
echo ""

# Deploy maia service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/2: Deploying maia service (next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/maia/Dockerfile" \
  "services/maia/fly.toml" \
  "--build-arg VITE_PEER_MOAI=moai.next.maia.city --build-arg VITE_PEER_MAIA=next.maia.city"; then
  echo "❌ Failed to deploy maia service after retries"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service URLs:"
echo "   Frontend: https://next-maia-city.fly.dev"
echo "   Moai:     https://moai-next-maia-city.fly.dev/health"
echo ""
echo "⚠️  Set secrets manually before first deploy:"
echo "   fly secrets set PEER_ID=... PEER_SECRET=... PEER_DB_URL=... --app moai-next-maia-city"
echo ""
echo "🔍 Verify deployment:"
echo "   flyctl status --app next-maia-city"
echo "   flyctl status --app moai-next-maia-city"
echo ""
