#!/bin/bash
# Force delete all volumes for voice-maia-city app (non-interactive)
# Usage: ./force-delete-volumes.sh

set -e

APP_NAME="voice-maia-city"

echo "🗑️  Force deleting ALL volumes for app: $APP_NAME"
echo ""

# Get all volumes
VOLUME_LIST=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null || echo "")

if [ -z "$VOLUME_LIST" ] || ! echo "$VOLUME_LIST" | grep -q "vol_"; then
    echo "No volumes found for app $APP_NAME"
    exit 0
fi

# Extract all volume IDs
VOLUME_IDS=$(echo "$VOLUME_LIST" | grep "vol_" | awk '{print $1}' || echo "")

if [ -z "$VOLUME_IDS" ]; then
    echo "No volume IDs found"
    exit 0
fi

echo "Found volumes to delete:"
for VOLUME_ID in $VOLUME_IDS; do
    VOLUME_NAME=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $2}' || echo "unknown")
    echo "  - $VOLUME_ID ($VOLUME_NAME)"
done

echo ""
echo "Deleting volumes (non-interactive)..."
echo ""

for VOLUME_ID in $VOLUME_IDS; do
    VOLUME_NAME=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $2}' || echo "unknown")
    echo "Destroying: $VOLUME_ID ($VOLUME_NAME)"
    
    # Destroy with --yes flag (non-interactive)
    flyctl volumes destroy "$VOLUME_ID" --app "$APP_NAME" --yes 2>&1 || {
        echo "  ⚠️  Failed to destroy $VOLUME_ID (may already be deleted or in use)"
    }
    
    sleep 1
done

echo ""
echo "⏳ Waiting 10 seconds for cleanup..."
sleep 10

# Final verification
echo ""
echo "Final verification..."
REMAINING=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "vol_" | wc -l | tr -d ' ' || echo "0")

if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
    echo "✓ All volumes deleted successfully"
else
    echo "⚠️  $REMAINING volume(s) still remain. They may be:"
    echo "   - Attached to a running machine (stop machines first)"
    echo "   - In a locked state"
    echo ""
    echo "Remaining volumes:"
    flyctl volumes list --app "$APP_NAME" 2>/dev/null || echo "  (none)"
    echo ""
    echo "To delete remaining volumes:"
    echo "  1. Stop all machines: flyctl scale count 0 --app $APP_NAME"
    echo "  2. Wait a few minutes"
    echo "  3. Run this script again"
    echo "  4. Or delete manually from dashboard: https://fly.io/apps/$APP_NAME/volumes"
fi
