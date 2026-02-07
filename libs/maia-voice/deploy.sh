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

# Check if HF_TOKEN secret is set
echo ""
echo "🔐 Checking HuggingFace token..."
HF_TOKEN_SET=$(flyctl secrets list --app "$APP_NAME" 2>/dev/null | grep "HF_TOKEN" || echo "")

if [ -z "$HF_TOKEN_SET" ]; then
    echo "⚠️  HF_TOKEN secret is not set!"
    echo ""
    echo "   PersonaPlex requires a HuggingFace token to access the gated model."
    echo "   Steps to get your token:"
    echo "   1. Visit https://huggingface.co/nvidia/personaplex-7b-v1"
    echo "   2. Accept the model license"
    echo "   3. Visit https://huggingface.co/settings/tokens"
    echo "   4. Create a new token (read access is sufficient)"
    echo ""
    read -p "   Enter your HuggingFace token (or press Enter to skip): " HF_TOKEN_INPUT
    
    if [ -n "$HF_TOKEN_INPUT" ]; then
        echo "   Setting HF_TOKEN secret..."
        flyctl secrets set HF_TOKEN="$HF_TOKEN_INPUT" --app "$APP_NAME" || {
            echo "⚠️  Failed to set HF_TOKEN secret"
            exit 1
        }
        echo "✓ HF_TOKEN secret set"
    else
        echo "⚠️  Skipping HF_TOKEN setup. You can set it later with:"
        echo "   flyctl secrets set HF_TOKEN=your-token --app $APP_NAME"
        echo ""
        read -p "   Continue deployment anyway? (y/n): " CONTINUE_DEPLOY
        
        if [ "$CONTINUE_DEPLOY" != "y" ] && [ "$CONTINUE_DEPLOY" != "Y" ]; then
            echo "   Deployment cancelled. Set HF_TOKEN and run deploy.sh again."
            exit 1
        fi
    fi
else
    echo "✓ HF_TOKEN secret is already set"
fi

# Ensure 40GB volume exists (fly deploy requires it to exist before creating machine)
echo ""
echo "📦 Ensuring 40GB volume exists..."
VOLUME_EXISTS=$(flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep "personaplex_data" | grep "$REGION" | grep "40GB" || echo "")

if [ -z "$VOLUME_EXISTS" ]; then
    echo "Creating volume 'personaplex_data' (40GB) in $REGION..."
    flyctl volumes create personaplex_data --size 40 --region "$REGION" --vm-gpu-kind l40s --app "$APP_NAME" --yes || {
        echo "⚠️  Volume creation failed"
        exit 1
    }
    echo "✓ Volume created: 40GB in $REGION"
else
    echo "✓ Volume already exists (40GB in $REGION)"
fi

# Deploy - fly.toml handles everything automatically
echo ""
echo "🚀 Deploying with fly deploy..."
echo "   fly.toml will automatically:"
echo "     - Use existing 40GB volume"
echo "     - Create machine in ORD with L40S GPU (performance-8x + l40s)"
echo "     - Configure auto-stop (manual start only)"
echo ""

flyctl deploy --dockerfile Dockerfile --config fly.toml --app "$APP_NAME" --ha=false

echo ""
echo "✅ Deployment complete!"

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
