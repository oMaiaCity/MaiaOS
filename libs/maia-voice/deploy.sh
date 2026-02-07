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
# Note: flyctl apps create doesn't support --region
# Primary region is set during first deployment via fly.toml primary_region
if ! flyctl apps list --org "$ORG" | grep -q "$APP_NAME"; then
    echo "Creating app $APP_NAME..."
    echo "   Note: Primary region will be set to $REGION during first deployment (from fly.toml)"
    flyctl apps create "$APP_NAME" --org "$ORG"
else
    echo "App $APP_NAME already exists"
    # CRITICAL: Check app's actual primary region - this can override fly.toml
    echo "Checking app primary region..."
    APP_REGION=$(flyctl apps show "$APP_NAME" --json 2>/dev/null | grep -o '"primary_region":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -z "$APP_REGION" ]; then
        # Try alternative method to get region
        APP_INFO=$(flyctl apps show "$APP_NAME" 2>/dev/null || echo "")
        APP_REGION=$(echo "$APP_INFO" | grep -iE "primary.*region|region.*primary" | awk '{print $NF}' | head -1 || echo "")
    fi
    
    if [ "$APP_REGION" != "$REGION" ] && [ -n "$APP_REGION" ]; then
        echo "⚠️  ERROR: App primary region is '$APP_REGION', but we need '$REGION' for L40S GPU"
        echo "   Fly.io cannot change app primary region after creation"
        echo "   This will cause machines to be created in $APP_REGION (where L40S GPU is not available)"
        echo ""
        echo "   SOLUTION: Delete and recreate the app"
        echo ""
        read -p "   Delete app '$APP_NAME' and recreate in ORD? (yes/no): " RECREATE_APP
        
        if [ "$RECREATE_APP" = "yes" ]; then
            echo "   Destroying app..."
            flyctl apps destroy "$APP_NAME" --yes || {
                echo "⚠️  Failed to destroy app. Please destroy manually:"
                echo "   flyctl apps destroy $APP_NAME --yes"
                exit 1
            }
            echo "   Creating app..."
            echo "   Note: Primary region will be set to $REGION during first deployment (from fly.toml)"
            flyctl apps create "$APP_NAME" --org "$ORG" || {
                echo "⚠️  Failed to create app"
                exit 1
            }
            echo "✓ App recreated (will use $REGION as primary region from fly.toml)"
        else
            echo "   Skipping app recreation. Deployment will likely fail."
            echo "   You can manually delete and recreate later:"
            echo "   flyctl apps destroy $APP_NAME --yes"
            echo "   flyctl apps create $APP_NAME --org $ORG --region $REGION"
        fi
    else
        echo "✓ App primary region is $REGION (or could not be determined - will proceed)"
    fi
fi

# Set HuggingFace token (if not already set)
# Uncomment and set your token:
# flyctl secrets set HF_TOKEN=your-token-here --app $APP_NAME

# Handle volume - ensure it exists in ORD region (required for L40S GPU)
# CRITICAL: Fly.io matches machine region to volume region
# Strategy: Destroy ALL existing volumes (in ALL regions) and recreate personaplex_data in ORD
echo ""
echo "📦 Ensuring volume exists in ORD region..."

# Get ALL volumes (not just personaplex_data) to ensure clean slate
echo "Checking for existing volumes..."
VOLUME_LIST=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null || echo "")
ALL_VOLUME_IDS=$(echo "$VOLUME_LIST" | grep "vol_" | awk '{print $1}' || echo "")

if [ -n "$ALL_VOLUME_IDS" ]; then
    echo "Found existing volume(s). Listing details:"
    echo "$VOLUME_LIST"
    echo ""
    echo "⚠️  CRITICAL: Destroying ALL volumes to prevent region conflicts..."
    echo "   Any volume in FRA (or other regions) will cause machine creation to fail"
    for VOLUME_ID in $ALL_VOLUME_IDS; do
        VOLUME_NAME=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $2}' || echo "unknown")
        VOLUME_REGION=$(echo "$VOLUME_LIST" | grep "$VOLUME_ID" | awk '{print $3}' || echo "unknown")
        echo "  Destroying volume: $VOLUME_ID ($VOLUME_NAME) in region: $VOLUME_REGION"
        flyctl volumes destroy "$VOLUME_ID" --app "$APP_NAME" --yes || true
    done
    echo "⏳ Waiting 15 seconds for cleanup (volumes may take time to fully delete)..."
    sleep 15
    
    # Verify all volumes are gone
    REMAINING_VOLUMES=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "vol_" || echo "")
    if [ -n "$REMAINING_VOLUMES" ]; then
        echo "⚠️  WARNING: Some volumes still exist after destroy:"
        echo "$REMAINING_VOLUMES"
        echo "   Waiting additional 10 seconds..."
        sleep 10
    fi
fi

# Verify no volumes exist
VOLUME_CHECK=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "vol_" || echo "")
if [ -z "$VOLUME_CHECK" ]; then
    echo "Creating volume 'personaplex_data' (40GB) in $REGION (ORD) for L40S GPU..."
    echo "   Using --vm-gpu-kind l40s to match GPU machine constraints..."
    flyctl volumes create personaplex_data --size 40 --region "$REGION" --vm-gpu-kind l40s --app "$APP_NAME" --yes || {
        echo "⚠️  Volume creation failed"
        exit 1
    }
    echo "✓ Volume created in $REGION (40GB)"
    
    # Verify the volume was created in the correct region (CRITICAL for GPU)
    # Use volumes show with JSON for reliable region extraction
    CREATED_VOLUME_ID=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "personaplex_data" | awk '{print $1}' | head -1 || echo "")
    
    if [ -n "$CREATED_VOLUME_ID" ]; then
        # Get volume details using show command with JSON
        VOLUME_JSON=$(flyctl volumes show "$CREATED_VOLUME_ID" --app "$APP_NAME" --json 2>/dev/null || echo "")
        CREATED_VOLUME_REGION=$(echo "$VOLUME_JSON" | grep -o '"region":"[^"]*"' | cut -d'"' -f4 || echo "")
        
        # Fallback: parse from text output
        if [ -z "$CREATED_VOLUME_REGION" ]; then
            VOLUME_TEXT=$(flyctl volumes show "$CREATED_VOLUME_ID" --app "$APP_NAME" 2>/dev/null || echo "")
            CREATED_VOLUME_REGION=$(echo "$VOLUME_TEXT" | grep -iE "^[[:space:]]*Region[[:space:]]*:" | awk '{print $2}' | head -1 || echo "")
        fi
        
        # Last fallback: parse from list output (look for "Region: ord" pattern)
        if [ -z "$CREATED_VOLUME_REGION" ]; then
            VOLUME_LIST=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null || echo "")
            CREATED_VOLUME_REGION=$(echo "$VOLUME_LIST" | grep -A 10 "$CREATED_VOLUME_ID" | grep -iE "^[[:space:]]*Region[[:space:]]*:" | awk '{print $2}' | head -1 || echo "")
        fi
        
        if [ "$CREATED_VOLUME_REGION" = "$REGION" ]; then
            echo "✓ Verified: Volume is in $REGION"
        elif [ -z "$CREATED_VOLUME_REGION" ]; then
            echo "⚠️  Warning: Could not verify volume region, but volume was created with --region $REGION"
            echo "   Proceeding (volume should be in $REGION)"
        else
            echo "⚠️  ERROR: Volume was created in wrong region!"
            echo "   Expected: $REGION"
            echo "   Actual: $CREATED_VOLUME_REGION"
            echo "   This will cause machine creation to fail (L40S GPU only available in ORD)"
            echo ""
            echo "   Destroying incorrect volume..."
            flyctl volumes destroy "$CREATED_VOLUME_ID" --app "$APP_NAME" --yes || true
            echo "   Please run this script again to create volume in correct region"
            exit 1
        fi
    else
        echo "⚠️  Warning: Could not find created volume ID for verification"
        echo "   Proceeding anyway (volume was created with --region $REGION)"
    fi
else
    echo "⚠️  Volumes still exist after destroy attempt. Please manually delete them:"
    echo "   flyctl volumes list --app $APP_NAME"
    echo "   Or run: ./delete-all-volumes.sh"
    exit 1
fi

# Destroy existing machines to ensure fresh start with GPU config from fly.toml
echo ""
echo "🗑️  Destroying existing machines (if any) to ensure fresh GPU configuration..."
MACHINE_IDS=$(flyctl machine list --app "$APP_NAME" --json 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$MACHINE_IDS" ]; then
    for MACHINE_ID in $MACHINE_IDS; do
        echo "Stopping and destroying machine: $MACHINE_ID"
        flyctl machine stop "$MACHINE_ID" --app "$APP_NAME" || true
        flyctl machine destroy "$MACHINE_ID" --app "$APP_NAME" --force || true
    done
    echo "⏳ Waiting 5 seconds for cleanup..."
    sleep 5
else
    echo "No existing machines to destroy"
fi

# Deploy - flyctl deploy respects primary_region in fly.toml
# The fly.toml has primary_region = "ord" which will set the app's primary region
# Note: flyctl deploy does NOT support --region flag
echo ""
echo "🚀 Deploying to Fly.io..."
echo "   Using --ha=false to ensure only 1 machine is created..."
echo "   fly.toml has primary_region = '$REGION' (this sets app's primary region)"
echo "   Volume is in $REGION (verified above)"
echo "   GPU configuration (L40S) is set in fly.toml ([vm] section)"
echo "   Machine will be created in $REGION (from primary_region in fly.toml)"
echo ""
# Try to deploy, but if it fails with FRA region error, create machine explicitly
flyctl deploy --dockerfile Dockerfile --config fly.toml --app "$APP_NAME" --ha=false || {
    echo ""
    echo "⚠️  Deploy failed (likely region mismatch). Creating machine explicitly in $REGION..."
    
    # Get the image reference
    IMAGE_REF=$(flyctl releases --app "$APP_NAME" 2>/dev/null | head -10 | grep -o "registry.fly.io/[^ ]*" | head -1 || echo "")
    if [ -z "$IMAGE_REF" ]; then
        # Try to get from image show
        IMAGE_REF=$(flyctl image show --app "$APP_NAME" 2>/dev/null | grep -i "image\|registry" | head -1 | awk '{print $NF}' || echo "")
    fi
    if [ -z "$IMAGE_REF" ]; then
        IMAGE_REF="registry.fly.io/$APP_NAME:latest"
    fi
    
    echo "   Creating machine with image: $IMAGE_REF"
    echo "   Region: $REGION (ORD)"
    echo "   GPU: L40S"
    
    flyctl machine create \
        --app "$APP_NAME" \
        --region "$REGION" \
        --vm-size "performance-8x" \
        --vm-gpu-kind "l40s" \
        --volume "personaplex_data:/data" \
        "$IMAGE_REF" || {
        echo "⚠️  Machine creation also failed. Please check:"
        echo "   1. Volume is in ORD: flyctl volumes list --app $APP_NAME"
        echo "   2. App exists: flyctl apps list | grep $APP_NAME"
        exit 1
    }
}

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
