#!/bin/bash
# Destroy and recreate machine in FRA with GPU configuration
# Usage: ./recreate-machine.sh

set -e

cd "$(dirname "$0")"

APP_NAME="voice-maia-city"
ORG="maia-city"
REGION="fra"
VM_SIZE="gpu-l40s"

echo "🔍 Listing current machines..."
flyctl machine list --app "$APP_NAME" || echo "No machines found or app doesn't exist"

echo ""
echo "🗑️  Destroying all existing machines..."
# Get machine IDs and destroy them
MACHINE_IDS=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

if [ -z "$MACHINE_IDS" ]; then
    echo "No machines to destroy"
else
    for MACHINE_ID in $MACHINE_IDS; do
        echo "Destroying machine: $MACHINE_ID"
        flyctl machine destroy "$MACHINE_ID" --app "$APP_NAME" --force || true
    done
fi

echo ""
echo "⏳ Waiting 5 seconds for cleanup..."
sleep 5

echo ""
echo "🚀 Creating new GPU machine in FRA region..."
echo "   VM Size: $VM_SIZE"
echo "   Region: $REGION"

# Create a new machine with GPU configuration
flyctl machine create \
    --app "$APP_NAME" \
    --region "$REGION" \
    --vm-size "$VM_SIZE" \
    --image registry.fly.io/"$APP_NAME":deployment-$(date +%s) || {
    echo ""
    echo "⚠️  Machine creation failed. This might be because:"
    echo "   1. No image exists yet - deploy first with: ./deploy.sh"
    echo "   2. Or create machine after deployment"
    echo ""
    echo "Alternative: Deploy first, then update machine size:"
    echo "   flyctl deploy --app $APP_NAME"
    echo "   flyctl machine update --vm-size $VM_SIZE --app $APP_NAME"
    exit 1
}

echo ""
echo "✅ Machine recreation complete!"
echo ""
echo "Current machine status:"
flyctl machine list --app "$APP_NAME"

echo ""
echo "📋 Next steps:"
echo "   1. Deploy the app: flyctl deploy --app $APP_NAME"
echo "   2. Verify GPU allocation: flyctl machine list --app $APP_NAME"
echo "   3. Check logs: flyctl logs --app $APP_NAME"
echo ""
echo "💡 To scale to zero: flyctl scale count 0 --app $APP_NAME"
