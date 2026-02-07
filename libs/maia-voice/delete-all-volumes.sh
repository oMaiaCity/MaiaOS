#!/bin/bash
# Delete all volumes for voice-maia-city app
# Usage: ./delete-all-volumes.sh

set -e

APP_NAME="voice-maia-city"

echo "🗑️  Listing all volumes for app: $APP_NAME"
VOLUME_LIST=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null || echo "")

if [ -z "$VOLUME_LIST" ] || ! echo "$VOLUME_LIST" | grep -q "vol_"; then
    echo "No volumes found for app $APP_NAME"
    exit 0
fi

echo ""
echo "Found volumes:"
echo "$VOLUME_LIST"
echo ""

# Extract all volume IDs
VOLUME_IDS=$(echo "$VOLUME_LIST" | grep "vol_" | awk '{print $1}' || echo "")

if [ -z "$VOLUME_IDS" ]; then
    echo "No volume IDs found"
    exit 0
fi

echo "⚠️  This will destroy the following volumes:"
for VOLUME_ID in $VOLUME_IDS; do
    VOLUME_NAME=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $2}' || echo "unknown")
    echo "  - $VOLUME_ID ($VOLUME_NAME)"
done

echo ""
read -p "Are you sure you want to delete all these volumes? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Deleting volumes..."
for VOLUME_ID in $VOLUME_IDS; do
    VOLUME_NAME=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $2}' || echo "unknown")
    echo "Destroying volume: $VOLUME_ID ($VOLUME_NAME)"
    
    # Try normal destroy first
    flyctl volumes destroy "$VOLUME_ID" --app "$APP_NAME" --yes || {
        echo "⚠️  Normal destroy failed, trying force destroy..."
        # If normal destroy fails, try with force flag (if available)
        flyctl volumes destroy "$VOLUME_ID" --app "$APP_NAME" --yes --force 2>/dev/null || {
            echo "⚠️  Force destroy also failed for $VOLUME_ID"
            echo "   You may need to delete this volume manually from the Fly.io dashboard"
        }
    }
    
    # Wait a bit between deletions
    sleep 2
done

echo ""
echo "⏳ Waiting 5 seconds for cleanup..."
sleep 5

# Verify deletion
echo ""
echo "Verifying deletion..."
REMAINING_VOLUMES=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "vol_" || echo "")

if [ -z "$REMAINING_VOLUMES" ]; then
    echo "✓ All volumes successfully deleted"
else
    echo "⚠️  Some volumes may still exist:"
    echo "$REMAINING_VOLUMES"
    echo ""
    echo "If volumes persist, try deleting them manually:"
    echo "   flyctl volumes list --app $APP_NAME"
    echo "   flyctl volumes destroy <volume-id> --app $APP_NAME --yes"
    echo ""
    echo "Or delete them from the Fly.io dashboard:"
    echo "   https://fly.io/apps/$APP_NAME/volumes"
fi

echo ""
echo "You can now run ./deploy.sh to create a new volume in ORD"
