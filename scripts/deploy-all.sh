#!/bin/bash
# Deploy all MaiaOS services to Fly.io
# Deploys: sync service (sync-next-maia-city) and app (next-maia-city)

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

# Optional: compare / apply Fly secrets from .env (never automatic; stdin must be a TTY)
if [ -t 0 ] && [ -t 1 ]; then
	read -r -p "Compare Fly secrets vs .env before deploy? [y/N] " _secrets_ans || true
	if [[ "${_secrets_ans:-}" =~ ^[yY]$ ]]; then
		"$SCRIPT_DIR/fly-secrets-from-env.sh" --dry-run || true
		read -r -p "Run ./scripts/fly-secrets-from-env.sh to apply secrets? [y/N] " _apply_ans || true
		if [[ "${_apply_ans:-}" =~ ^[yY]$ ]]; then
			"$SCRIPT_DIR/fly-secrets-from-env.sh"
		fi
	fi
fi

# Sync deploy - requires manual secrets: AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET, and PEER_SYNC_DB_URL (postgres)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1/2: Deploying sync service (sync-next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "sync-next-maia-city" \
  "services/sync/Dockerfile" \
  "services/sync/fly.toml" \
  "--ha=false"; then
  echo "❌ Failed to deploy sync service after retries"
  exit 1
fi

# Enforce single machine for sync (sync service must not scale beyond 1)
echo "Enforcing single machine for sync..."
flyctl scale count 1 --app sync-next-maia-city --yes

echo ""
echo "✅ Sync service deployed!"
echo "   Health check: https://sync.next.maia.city/health"
echo ""

# Deploy app service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/2: Deploying app service (next-maia-city)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$MONOREPO_ROOT"

if ! retry_flyctl_deploy \
  "next-maia-city" \
  "services/app/Dockerfile" \
  "services/app/fly.toml" \
  "--build-arg VITE_PEER_SYNC_HOST=sync.next.maia.city"; then
  echo "❌ Failed to deploy app service after retries"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service URLs:"
echo "   Frontend: https://next.maia.city"
echo "   Sync:     https://sync.next.maia.city/health"
echo ""
echo "⚠️  Secrets are not changed by deploy. Set manually or run when ready:"
echo "   ./scripts/fly-secrets-from-env.sh --dry-run   # review"
echo "   ./scripts/fly-secrets-from-env.sh             # apply from root .env"
echo "   See scripts/fly-next-setup.md"
echo ""
echo "🔍 Verify deployment:"
echo "   flyctl status --app next-maia-city"
echo "   flyctl status --app sync-next-maia-city"
echo ""
