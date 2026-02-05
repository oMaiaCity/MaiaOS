#!/bin/bash
# Check GPU availability across Fly.io regions
# Usage: ./check-gpu-availability.sh

echo "🔍 Checking GPU availability across Fly.io regions..."
echo ""

# Check L40S availability
echo "📊 L40S GPU (48GB) - Preferred for PersonaPlex:"
curl -s 'https://api.machines.dev/v1/platform/regions?size=gpu-l40s' 2>/dev/null | \
  jq -r '.Regions[] | select(.capacity > 0) | "  ✓ \(.code) (\(.name)) - Capacity: \(.capacity)"' 2>/dev/null || \
  echo "  ⚠️  Could not check L40S availability (jq may not be installed)"

echo ""
echo "📊 A100 80GB SXM - Alternative (more expensive, available in EU):"
curl -s 'https://api.machines.dev/v1/platform/regions?size=gpu-a100-sxm4-80gb' 2>/dev/null | \
  jq -r '.Regions[] | select(.capacity > 0) | "  ✓ \(.code) (\(.name)) - Capacity: \(.capacity)"' 2>/dev/null || \
  echo "  ⚠️  Could not check A100 availability (jq may not be installed)"

echo ""
echo "📊 A100 40GB PCIe - Alternative:"
curl -s 'https://api.machines.dev/v1/platform/regions?size=gpu-a100-pcie-40gb' 2>/dev/null | \
  jq -r '.Regions[] | select(.capacity > 0) | "  ✓ \(.code) (\(.name)) - Capacity: \(.capacity)"' 2>/dev/null || \
  echo "  ⚠️  Could not check A100-40GB availability (jq may not be installed)"

echo ""
echo "💡 Using flyctl command (if available):"
echo "   flyctl platform regions --size gpu-l40s"
echo "   flyctl platform regions --size gpu-a100-sxm4-80gb"

echo ""
echo "📝 Current configuration:"
echo "   Preferred: L40S in ORD (Chicago) - $1.25/hour"
echo "   Alternative: A100 80GB in AMS (Amsterdam) - $3.50/hour (if L40S unavailable)"
