#!/bin/bash
# Deploy PersonaPlex to Fly.io
# Usage: ./deploy.sh

set -e

cd "$(dirname "$0")"

# Check if app exists, create if it doesn't
if ! flyctl apps list --org maia-city | grep -q "voice-maia-city"; then
    echo "Creating app voice-maia-city..."
    flyctl apps create voice-maia-city --org maia-city
else
    echo "App voice-maia-city already exists, skipping creation"
fi

# Set HuggingFace token (if not already set)
# Uncomment and set your token:
# flyctl secrets set HF_TOKEN=your-token-here --app voice-maia-city

# Deploy
flyctl deploy --dockerfile Dockerfile --config fly.toml --app voice-maia-city

echo ""
echo "Deployment complete!"
echo ""
echo "To scale to zero (stop machine, prevent costs):"
echo "  flyctl scale count 0 --app voice-maia-city"
echo ""
echo "To start machine:"
echo "  flyctl scale count 1 --app voice-maia-city"
echo ""
echo "To set GPU machine type (first time only):"
echo "  flyctl machine update --vm-size gpu-l40s --app voice-maia-city"
