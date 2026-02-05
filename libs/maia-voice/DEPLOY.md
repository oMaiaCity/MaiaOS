# PersonaPlex Voice Service Deployment Guide

PersonaPlex is a real-time, full-duplex speech-to-speech conversational model deployed to Fly.io with GPU support.

## Overview

This service provides PersonaPlex voice backend running on Fly.io with L40S GPU. The service can be scaled to zero when not in use to prevent costs.

## Prerequisites

1. **Accept PersonaPlex Model License**
   - Visit: https://huggingface.co/nvidia/personaplex-7b-v1
   - Log in to your HuggingFace account
   - Accept the model license

2. **Get HuggingFace Token**
   - Visit: https://huggingface.co/settings/tokens
   - Create a new token (read access is sufficient)
   - Copy the token for use in deployment

3. **Fly.io CLI**
   - Install: `brew install flyctl` (or see [fly.io/docs](https://fly.io/docs/hands-on/install-flyctl/))
   - Authenticate: `flyctl auth login`

## Initial Setup

### 1. Create Fly.io App

```bash
cd libs/maia-voice
flyctl apps create voice-maia-city --org maia-city
```

### 2. Set HuggingFace Token

```bash
flyctl secrets set HF_TOKEN=your-huggingface-token --app voice-maia-city
```

Replace `your-huggingface-token` with your actual HuggingFace token.

### 3. Configure GPU Machine

On first deployment, you'll need to set the GPU machine type:

```bash
# After first deployment, update machine to use GPU
flyctl machine update --vm-size gpu-l40s --app voice-maia-city
```

**Note:** The machine type must be set after the first deployment. The `fly.toml` file doesn't specify GPU machine type - it's set via `flyctl` commands.

## Deployment

### Deploy from libs/maia-voice Directory

```bash
cd libs/maia-voice
./deploy.sh
```

Or manually:

```bash
cd libs/maia-voice
flyctl deploy --dockerfile Dockerfile --config fly.toml --app voice-maia-city
```

### Using Deployment Script

The `deploy.sh` script handles:
- Creating the app (if it doesn't exist)
- Deploying with the correct Dockerfile and config
- Displaying scale-to-zero instructions

**Note:** The script does NOT set the HuggingFace token automatically - you must set it manually (see Initial Setup step 2).

## Scale to Zero (Cost Control)

**CRITICAL:** Scale to zero immediately after deployment to prevent costs!

### Auto-Stop Configuration

The machine is configured to:
- **Auto-stop**: Stops automatically when idle (saves costs)
- **Manual start only**: Does NOT auto-start (you must manually start it)

This ensures maximum cost control - the machine will stop when idle but won't automatically start on requests.

### Stop Machine (Scale to Zero)

```bash
flyctl scale count 0 --app voice-maia-city
```

This stops the machine completely. **No charges apply when scaled to zero.**

The machine will also auto-stop when idle (configured in `fly.toml`).

### Start Machine (Manual Only)

When you want to test or use the service, you must manually start it:

```bash
flyctl scale count 1 --app voice-maia-city
```

The machine will start and be ready in ~1-2 minutes (GPU cold start may take 30-60s).

### After Testing

Always scale back to zero after testing:

```bash
flyctl scale count 0 --app voice-maia-city
```

Or let it auto-stop when idle (configured in `fly.toml`).

## Costs

- **L40S GPU**: $1.25/hour when running
- **Scale to zero**: $0/hour when stopped
- **Estimated testing cost**: ~$0.02/minute (scale up only when testing)

**Cost Management:**
- Always scale to zero when not testing
- Scale up only when actively using the service
- Monitor usage via Fly.io dashboard

## Accessing the Service

Once deployed and scaled to 1:

- **Web UI**: `https://voice-maia-city.fly.dev` (port 8998)
- **Health Check**: `https://voice-maia-city.fly.dev/` (GET request)

The PersonaPlex web UI will be available at the Fly.io domain.

## GPU Machine Configuration

- **Machine Type**: `gpu-l40s` (NVIDIA L40S 48GB)
- **Region**: `ord` (Chicago, Illinois)
- **Cost**: $1.25/hour when running
- **Set via**: `flyctl machine update --vm-size gpu-l40s --region ord --app voice-maia-city`

**Note**: L40S GPU is currently only available in ORD (Chicago) region. The deploy script automatically configures this.

## Troubleshooting

### Machine Not Starting

If the machine fails to start:

```bash
# Check machine status
flyctl status --app voice-maia-city

# Check logs
flyctl logs --app voice-maia-city

# Verify GPU allocation
flyctl machine list --app voice-maia-city
```

### HuggingFace Token Issues

If you see authentication errors:

```bash
# Verify token is set
flyctl secrets list --app voice-maia-city

# Update token if needed
flyctl secrets set HF_TOKEN=new-token --app voice-maia-city
```

### GPU Not Available

If GPU is not allocated:

```bash
# Update machine to GPU type (L40S in ORD)
flyctl machine update <MACHINE_ID> --vm-size gpu-l40s --region ord --app voice-maia-city

# Check GPU availability
flyctl platform regions --size gpu-l40s
```

## Environment Variables

Configured in `fly.toml`:
- `NO_TORCH_COMPILE`: Set to `"1"` to disable torch compilation (improves startup time)

Set via Fly.io secrets:
- `HF_TOKEN`: HuggingFace authentication token (required)

## Architecture

```
PersonaPlex Backend (moshi/server)
  ↓
Fly.io GPU Machine (L40S)
  ↓
Web UI (PersonaPlex client)
  ↓
Browser (User)
```

The PersonaPlex backend serves both the API and the web UI on port 8998.

## Next Steps

1. Deploy the service (see Deployment section)
2. Scale to zero immediately after deployment
3. Scale to 1 when ready to test
4. Access web UI at `https://voice-maia-city.fly.dev`
5. Test voice conversation
6. Scale back to zero after testing

## References

- PersonaPlex GitHub: https://github.com/NVIDIA/personaplex
- PersonaPlex Model: https://huggingface.co/nvidia/personaplex-7b-v1
- Fly.io GPU Docs: https://fly.io/docs/gpus/
- Fly.io GPU Pricing: https://fly.io/docs/gpus/#pricing
