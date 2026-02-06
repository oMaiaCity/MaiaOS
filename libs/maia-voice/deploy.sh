#!/bin/bash
# Deploy PersonaPlex to Fly.io with L40S GPU in ORD region
# Usage: ./deploy.sh

set -e

cd "$(dirname "$0")"

APP_NAME="voice-maia-city"
ORG="maia-city"
REGION="ord"  # Chicago - L40S GPU available
GPU_TYPE="gpu-l40s"  # NVIDIA L40S 48GB

# Check if app exists, create if it doesn't
if ! flyctl apps list --org "$ORG" | grep -q "$APP_NAME"; then
    echo "Creating app $APP_NAME..."
    flyctl apps create "$APP_NAME" --org "$ORG"
else
    echo "App $APP_NAME already exists, skipping creation"
fi

# Set HuggingFace token (if not already set)
# Uncomment and set your token:
# flyctl secrets set HF_TOKEN=your-token-here --app $APP_NAME

# Create volume if it doesn't exist (required by fly.toml mounts section)
# Volume will be created automatically by fly deploy, but we check/create it here to be safe
echo ""
echo "📦 Checking for required volume..."
if ! flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep -q "personaplex_data"; then
    echo "Creating volume 'personaplex_data' (10GB) in $REGION..."
    flyctl volumes create personaplex_data --size 10 --region "$REGION" --app "$APP_NAME" || {
        echo "⚠️  Volume creation failed (may already exist or will be created by fly deploy)"
    }
else
    echo "✓ Volume 'personaplex_data' already exists"
fi

# Destroy existing machines to ensure fresh start with GPU config from fly.toml
echo ""
echo "🗑️  Destroying existing machines (if any) to ensure fresh GPU configuration..."
MACHINE_IDS=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$MACHINE_IDS" ]; then
    for MACHINE_ID in $MACHINE_IDS; do
        echo "Destroying machine: $MACHINE_ID"
        flyctl machine destroy "$MACHINE_ID" --app "$APP_NAME" --force || true
    done
    echo "⏳ Waiting 3 seconds for cleanup..."
    sleep 3
else
    echo "No existing machines to destroy"
fi

# Deploy - vm.size="l40s" in fly.toml should automatically create GPU machine
echo ""
echo "🚀 Deploying to Fly.io..."
echo "   Using --ha=false to ensure only 1 machine is created..."
echo "   GPU configuration (L40S) is set in fly.toml (vm.size = 'l40s')"
echo "   Machine should be created with GPU automatically..."
flyctl deploy --dockerfile Dockerfile --config fly.toml --app "$APP_NAME" --ha=false

echo ""
echo "Deployment complete!"
echo ""
echo "✅ Verifying GPU configuration..."
MACHINE_ID=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [ -n "$MACHINE_ID" ]; then
    echo "Found machine: $MACHINE_ID"
    MACHINE_INFO=$(flyctl machine show "$MACHINE_ID" --app "$APP_NAME" --json 2>/dev/null || echo "")
    
    # Check if machine has GPU (should be automatic from fly.toml)
    if echo "$MACHINE_INFO" | grep -q "gpu\|l40s" || echo "$MACHINE_INFO" | grep -qi "performance-8x"; then
        echo "✓ Machine has GPU configured correctly (from fly.toml)"
    else
        echo "⚠️  Machine doesn't appear to have GPU. Checking size..."
        MACHINE_SIZE=$(echo "$MACHINE_INFO" | grep -o '"size":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        if [ "$MACHINE_SIZE" != "gpu-l40s" ] && [ "$MACHINE_SIZE" != "l40s" ]; then
            echo "   Current size: $MACHINE_SIZE (should be l40s/gpu-l40s)"
            echo "   Updating machine to GPU..."
            flyctl machine stop "$MACHINE_ID" --app "$APP_NAME" || true
            flyctl machine update "$MACHINE_ID" --vm-size "$GPU_TYPE" --region "$REGION" --app "$APP_NAME" || {
                echo "⚠️  Failed to update. This shouldn't happen if fly.toml is correct."
            }
        fi
    fi
else
    echo "⚠️  No machine found. The deployment may have failed or machine creation is pending."
    echo "   Check status with: flyctl status --app $APP_NAME"
fi

echo ""
echo "Ensuring exactly 1 machine (destroying any extras)..."
# Get all machine IDs
ALL_MACHINE_IDS=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$ALL_MACHINE_IDS" ]; then
    MACHINE_COUNT=$(echo "$ALL_MACHINE_IDS" | wc -l | tr -d ' ')
    if [ "$MACHINE_COUNT" -gt 1 ]; then
        echo "⚠️  Found $MACHINE_COUNT machines. Destroying extras to keep only 1..."
        FIRST_MACHINE=$(echo "$ALL_MACHINE_IDS" | head -1)
        for MACHINE_ID in $ALL_MACHINE_IDS; do
            if [ "$MACHINE_ID" != "$FIRST_MACHINE" ]; then
                echo "Destroying extra machine: $MACHINE_ID"
                flyctl machine destroy "$MACHINE_ID" --app "$APP_NAME" --force || true
            fi
        done
    fi
    echo "✓ Ensuring scale count is 1..."
    flyctl scale count 1 --app "$APP_NAME" || true
fi

echo ""
echo "Scaling to zero to prevent costs..."
flyctl scale count 0 --app "$APP_NAME" || echo "Note: Machine may already be stopped or may need to be created first."

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Auto-scaling configured (via fly.toml):"
echo "  - Auto-stop: Enabled (stops when idle to save costs)"
echo "  - Auto-start: Disabled (manual start only for cost control)"
echo ""
echo "The machine will automatically:"
echo "  - Stop when idle (saves costs)"
echo ""
echo "Manual control (required):"
echo "  Start: flyctl scale count 1 --app $APP_NAME"
echo "  Stop:  flyctl scale count 0 --app $APP_NAME"
echo ""
echo "⚠️  Machine will NOT auto-start - you must manually start it when needed!"
echo "⚠️  Machine is currently scaled to 0 (stopped) - start manually when ready to test!"
echo ""
echo "🔍 Verify GPU allocation:"
echo "   flyctl machine list --app $APP_NAME"
echo "   flyctl status --app $APP_NAME"
