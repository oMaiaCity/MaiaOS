#!/bin/bash
# Set Fly.io secrets for sync-next-maia-city from .env (single source for which keys are synced).
# Run from monorepo root. Requires: PEER_SYNC_DB_URL (Neon), AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET in .env
#
# Usage:
#   ./scripts/fly-secrets-from-env.sh           # apply
#   ./scripts/fly-secrets-from-env.sh --dry-run  # show keys + diff vs Fly (no values)
#
# NEVER push to Fly: VITE_AVEN_TEST_ACCOUNT, VITE_AVEN_TEST_SECRET, VITE_AVEN_TEST_MODE, VITE_AVEN_TEST_NAME
# (client-only test credentials for local dev; sync server must never receive them)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT/.env"
APP="sync-next-maia-city"

# Keys this script sets on Fly (names only; order for display)
EXPECTED_KEYS=(
	PEER_SYNC_STORAGE
	PEER_SYNC_DB_URL
	AVEN_MAIA_ACCOUNT
	AVEN_MAIA_SECRET
	AVEN_MAIA_GUARDIAN
	AVEN_MAIA_NAME
	RED_PILL_API_KEY
)

DRY_RUN=false
for arg in "$@"; do
	if [ "$arg" = "--dry-run" ]; then
		DRY_RUN=true
	fi
done

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

AVEN_MAIA_GUARDIAN=$(get_env AVEN_MAIA_GUARDIAN)
AVEN_MAIA_NAME=$(get_env AVEN_MAIA_NAME)
RED_PILL_API_KEY=$(get_env RED_PILL_API_KEY)

if [ "$DRY_RUN" = true ]; then
	echo "Dry run — no secrets written. App: $APP"
	echo ""
	echo "Keys this script would set (values not shown):"
	echo "  PEER_SYNC_STORAGE=postgres"
	echo "  PEER_SYNC_DB_URL=(set)"
	echo "  AVEN_MAIA_ACCOUNT=(set)"
	echo "  AVEN_MAIA_SECRET=(set)"
	[ -n "$AVEN_MAIA_GUARDIAN" ] && echo "  AVEN_MAIA_GUARDIAN=(set)" || echo "  AVEN_MAIA_GUARDIAN=(empty)"
	echo "  AVEN_MAIA_NAME=${AVEN_MAIA_NAME:-Maia}"
	[ -n "$RED_PILL_API_KEY" ] && echo "  RED_PILL_API_KEY=(set)" || echo "  RED_PILL_API_KEY=(empty)"
	echo ""
	if command -v flyctl >/dev/null 2>&1; then
		if REMOTE=$(flyctl secrets list -a "$APP" 2>/dev/null); then
			echo "Fly secrets currently on $APP (names only):"
			echo "$REMOTE" | tail -n +2 | awk '{print $1}' | sort -u | sed 's/^/  /' || true
			echo ""
			echo "Expected keys from this script:"
			for k in "${EXPECTED_KEYS[@]}"; do
				echo "  $k"
			done
		else
			echo "⚠️  Could not list Fly secrets (run flyctl auth login?). Skipping diff."
		fi
	else
		echo "⚠️  flyctl not in PATH; skipping remote diff."
	fi
	echo ""
	echo "To apply: ./scripts/fly-secrets-from-env.sh"
	exit 0
fi

echo "Setting secrets for $APP..."

flyctl secrets set \
	PEER_SYNC_STORAGE=postgres \
	PEER_SYNC_DB_URL="$PEER_SYNC_DB_URL" \
	AVEN_MAIA_ACCOUNT="$AVEN_MAIA_ACCOUNT" \
	AVEN_MAIA_SECRET="$AVEN_MAIA_SECRET" \
	AVEN_MAIA_GUARDIAN="${AVEN_MAIA_GUARDIAN:-}" \
	AVEN_MAIA_NAME="${AVEN_MAIA_NAME:-Maia}" \
	RED_PILL_API_KEY="${RED_PILL_API_KEY:-}" \
	--app "$APP"

echo "✅ Secrets set. Deploy with: ./services/sync/deploy.sh"
