#!/bin/bash
# Manually destroy all personaplex_data volumes
# Usage: ./destroy-volumes.sh

set -e

APP_NAME="voice-maia-city"

echo "🗑️  Destroying all personaplex_data volumes..."

# List of volumes to destroy (from user's list)
VOLUMES=(
    "vol_vx2zql9d5oj8gpjr"  # Attached to machine d89411ea209178 - need to destroy machine first
    "vol_v870y15m93mdk77r"
    "vol_45lo5m8ex87lwg8r"
    "vol_re8wq0nq58oddwdr"
    "vol_4932566n2dxwk994"
    "vol_vgjk081g3lz0zjjv"
    "vol_vwjzogleze6egjmr"
)

# First, destroy the machine that has vol_vx2zql9d5oj8gpjr attached
echo ""
echo "⚠️  Volume vol_vx2zql9d5oj8gpjr is attached to machine d89411ea209178"
echo "   Destroying machine first..."
flyctl machine destroy "d89411ea209178" --app "$APP_NAME" --force || {
    echo "⚠️  Machine may already be destroyed or doesn't exist"
}

echo "⏳ Waiting 5 seconds for machine cleanup..."
sleep 5

# Now destroy all volumes
echo ""
echo "Destroying volumes..."
for VOLUME_ID in "${VOLUMES[@]}"; do
    echo ""
    echo "Destroying volume: $VOLUME_ID"
    flyctl volumes destroy "$VOLUME_ID" --app "$APP_NAME" --yes || {
        echo "⚠️  Failed to destroy $VOLUME_ID (may already be destroyed or pending)"
    }
done

echo ""
echo "✅ Volume destruction complete!"
echo ""
echo "Verifying volumes are gone..."
flyctl volumes list --app "$APP_NAME" | grep "personaplex_data" || echo "✓ No personaplex_data volumes found"
