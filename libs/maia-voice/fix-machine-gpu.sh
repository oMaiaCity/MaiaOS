#!/bin/bash
# Fix machine to use L40S GPU instead of shared-cpu-1x
# Usage: ./fix-machine-gpu.sh

set -e

APP_NAME="voice-maia-city"
REGION="ord"

echo "🔧 Updating machine to L40S GPU configuration..."

# Get machine ID
MACHINE_ID=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$MACHINE_ID" ]; then
    echo "⚠️  No machine found"
    exit 1
fi

echo "Found machine: $MACHINE_ID"
echo "Current size: shared-cpu-1x:256MB (wrong!)"
echo "Updating to: performance-8x CPU/RAM + l40s GPU"
echo ""

# Stop machine first
echo "Stopping machine..."
flyctl machine stop "$MACHINE_ID" --app "$APP_NAME" || true
sleep 3

# Update machine to GPU (per Fly.io docs: use performance-8x size + gpu_kind)
echo "Updating machine to L40S GPU..."
flyctl machine update "$MACHINE_ID" \
    --app "$APP_NAME" \
    --vm-size "performance-8x" \
    --vm-gpu-kind "l40s" \
    --region "$REGION" || {
    echo "⚠️  Machine update failed"
    echo "   Trying to destroy and recreate..."
    
    # Get image reference
    IMAGE_REF=$(flyctl releases --app "$APP_NAME" 2>/dev/null | grep -oE "registry\.fly\.io/[^[:space:]]+" | head -1 || echo "")
    
    if [ -z "$IMAGE_REF" ]; then
        echo "⚠️  Could not determine image reference"
        exit 1
    fi
    
    echo "Destroying old machine and creating new GPU machine..."
    flyctl machine destroy "$MACHINE_ID" --app "$APP_NAME" --force || true
    sleep 5
    
    # Get volume ID
    VOLUME_ID=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "personaplex_data" | awk '{print $1}' | head -1 || echo "")
    
    if [ -z "$VOLUME_ID" ]; then
        echo "⚠️  No volume found"
        exit 1
    fi
    
    echo "Creating new GPU machine with volume..."
    flyctl machine create \
        --app "$APP_NAME" \
        --region "$REGION" \
        --vm-size "performance-8x" \
        --vm-gpu-kind "l40s" \
        --volume "personaplex_data:/data" \
        "$IMAGE_REF" || {
        echo "⚠️  Machine creation failed"
        exit 1
    }
}

echo ""
echo "✓ Machine updated to L40S GPU"
echo ""
echo "Verifying..."
flyctl machine list --app "$APP_NAME"
