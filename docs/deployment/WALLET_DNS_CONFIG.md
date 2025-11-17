# DNS Configuration for wallet.hominio.me

This document provides DNS configuration instructions for the `hominio-wallet` service deployed to Fly.io.

## Overview

The wallet service runs on Fly.io as `hominio-wallet` and should be accessible at `wallet.hominio.me`.

## DNS Configuration

After deploying the wallet service to Fly.io, you need to configure DNS to point `wallet.hominio.me` to the Fly.io app.

### Step 1: Add Custom Domain to Fly.io

The deployment workflow automatically adds the custom domain to Fly.io. If you need to do it manually:

```bash
flyctl certs create wallet.hominio.me --app hominio-wallet
```

This will output the DNS configuration needed. Fly.io will automatically provision a Let's Encrypt SSL certificate once DNS is configured.

### Step 2: Configure DNS CNAME Record

**Add a CNAME record in your DNS provider** (wherever `hominio.me` is managed):

```
Type: CNAME
Name: wallet
Value: hominio-wallet.fly.dev
TTL: 300 (or your preferred TTL)
```

**Why CNAME?**
- Fly.io recommends using CNAME records for custom domains
- CNAME automatically handles IP address changes if Fly.io migrates infrastructure
- Let's Encrypt certificate provisioning works seamlessly with CNAME records

**DNS Provider Examples:**

**Cloudflare:**
1. Go to DNS settings for `hominio.me`
2. Add record:
   - Type: `CNAME`
   - Name: `wallet`
   - Target: `hominio-wallet.fly.dev`
   - Proxy status: DNS only (gray cloud) or Proxied (orange cloud)
   - TTL: Auto or 300

**Namecheap/Other Providers:**
1. Go to Advanced DNS settings
2. Add new record:
   - Type: `CNAME Record`
   - Host: `wallet`
   - Value: `hominio-wallet.fly.dev`
   - TTL: 300

### Step 3: Verify DNS Propagation

Check if DNS has propagated:

```bash
# Check CNAME record
dig wallet.hominio.me CNAME

# Or use nslookup
nslookup wallet.hominio.me
```

You should see `hominio-wallet.fly.dev` as the CNAME target.

**Online DNS Checkers:**
- https://dnschecker.org/
- https://www.whatsmydns.net/

### Step 4: Verify SSL Certificate (Automatic)

Fly.io automatically provisions a Let's Encrypt SSL certificate once DNS has propagated. Check the certificate status:

```bash
flyctl certs check wallet.hominio.me --app hominio-wallet
```

The certificate should show as **"Issued"** once DNS has propagated (usually 5-15 minutes after DNS configuration).

**Certificate Status:**
- ✅ **Issued**: Certificate is active and HTTPS is working
- ⏳ **Pending**: DNS hasn't propagated yet, wait a few minutes
- ❌ **Error**: Check DNS configuration and try again

### Step 5: Test the Service

Once DNS has propagated and the certificate is issued, test the service:

```bash
# Test HTTPS endpoint
curl https://wallet.hominio.me/api/auth

# Or open in browser
open https://wallet.hominio.me/api/auth
```

You should receive a response from the BetterAuth API.

## DNS Propagation

DNS changes typically propagate within:
- **Minimum:** 5-15 minutes
- **Typical:** 1-4 hours
- **Maximum:** 24-48 hours (rare)

You can check DNS propagation status using:
- https://dnschecker.org/
- https://www.whatsmydns.net/

## Troubleshooting

### Certificate Not Issuing

If the SSL certificate doesn't issue after DNS propagation:

1. Verify DNS records are correct:
   ```bash
   dig wallet.hominio.me
   dig wallet.hominio.me AAAA
   ```

2. Check certificate status:
   ```bash
   flyctl certs check wallet.hominio.me --app hominio-wallet
   ```

3. If needed, recreate the certificate:
   ```bash
   flyctl certs delete wallet.hominio.me --app hominio-wallet
   flyctl certs create wallet.hominio.me --app hominio-wallet
   ```

### Service Not Accessible

If the service is not accessible after DNS configuration:

1. Check app status:
   ```bash
   flyctl status --app hominio-wallet
   ```

2. Check logs:
   ```bash
   flyctl logs --app hominio-wallet
   ```

3. Verify the service is running:
   ```bash
   flyctl machines list --app hominio-wallet
   ```

## GitHub Secrets Required

Make sure the following secrets are configured in GitHub Actions:

- `PUBLIC_DOMAIN_ROOT` - Root domain (e.g., `hominio.me`)
- `PUBLIC_DOMAIN_APP` - App service domain (e.g., `app.hominio.me`)
- `PUBLIC_DOMAIN_WALLET` - Wallet service domain (e.g., `wallet.hominio.me`)
- `PUBLIC_DOMAIN_SYNC` - Sync service domain (e.g., `sync.hominio.me`)
- `AUTH_SECRET` - BetterAuth secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `WALLET_POSTGRES_SECRET` - PostgreSQL connection string
- `POLAR_API_KEY` - Polar API key (for customer sync only)
- `FLY_API_TOKEN` - Fly.io API token

**Note:** Polar checkout and webhooks are handled by the legacy system for now. Dedicated services will be created later. Only customer creation on signup is handled by the wallet service.

## Related Documentation

- [Fly.io DNS Documentation](https://fly.io/docs/reference/dns/)
- [Fly.io Custom Domains](https://fly.io/docs/reference/certificates/)
- [BetterAuth Cross-Subdomain Cookies](https://www.better-auth.com/docs/configuration/cookies)

