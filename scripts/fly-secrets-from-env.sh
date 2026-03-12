#!/bin/bash
# Set Fly.io secrets for sync-next-maia-city from .env
# Run from monorepo root. Requires: PEER_SYNC_DB_URL (Neon), AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET in .env
#
# NEVER push to Fly: VITE_AVEN_TEST_ACCOUNT, VITE_AVEN_TEST_SECRET, VITE_AVEN_TEST_MODE, VITE_AVEN_TEST_NAME
# (client-only test credentials for local dev; sync server must never receive them)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT/.env"

get_env() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/^"//;s/"$//'
}

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env not found at $ENV_FILE"
  exit 1
fi

PEER_SYNC_DB_URL=$(get_env PEER_SYNC_DB_URL)
AVEN_MAIA_ACCOUNT=$(get_env AVEN_MAIA_ACCOUNT)
AVEN_MAIA_SECRET=$(get_env AVEN_MAIA_SECRET)

if [ -z "$PEER_SYNC_DB_URL" ]; then
  echo "❌ Add PEER_SYNC_DB_URL (Neon connection string) to .env"
  exit 1
fi
if [ -z "$AVEN_MAIA_ACCOUNT" ]; then
  echo "❌ Add AVEN_MAIA_ACCOUNT to .env"
  exit 1
fi
if [ -z "$AVEN_MAIA_SECRET" ]; then
  echo "❌ Add AVEN_MAIA_SECRET to .env"
  exit 1
fi

PEER_SYNC_SEED=$(get_env PEER_SYNC_SEED)
AVEN_MAIA_GUARDIAN=$(get_env AVEN_MAIA_GUARDIAN)
AVEN_MAIA_NAME=$(get_env AVEN_MAIA_NAME)
RED_PILL_API_KEY=$(get_env RED_PILL_API_KEY)

echo "Setting secrets for sync-next-maia-city..."

flyctl secrets set \
  PEER_SYNC_STORAGE=postgres \
  PEER_SYNC_DB_URL="$PEER_SYNC_DB_URL" \
  PEER_SYNC_SEED="${PEER_SYNC_SEED:-true}" \
  AVEN_MAIA_ACCOUNT="$AVEN_MAIA_ACCOUNT" \
  AVEN_MAIA_SECRET="$AVEN_MAIA_SECRET" \
  AVEN_MAIA_GUARDIAN="${AVEN_MAIA_GUARDIAN:-}" \
  AVEN_MAIA_NAME="${AVEN_MAIA_NAME:-Maia}" \
  RED_PILL_API_KEY="${RED_PILL_API_KEY:-}" \
  --app sync-next-maia-city

echo "✅ Secrets set. Deploy with: ./services/sync/deploy.sh"
