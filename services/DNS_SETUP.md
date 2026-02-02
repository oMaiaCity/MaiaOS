# DNS Setup Guide - Hetzner

Guide for setting up DNS records in Hetzner DNS for MaiaOS services.

## Hetzner DNS Error Fix

If you see the error: **"Record verweist auf ein Ziel innerhalb dieser Zone, das nicht existiert"** (Record refers to a target within this zone that does not exist), this means Hetzner is trying to validate the CNAME target as an internal record.

## Correct DNS Configuration

### For `api.next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `api.next` (or `api.next.maia.city` depending on Hetzner's interface)
- **Value:** `api-next-maia-city.fly.dev.` (note the trailing dot!)
- **TTL:** 3600

**Important:** The trailing dot (`.`) at the end of `api-next-maia-city.fly.dev.` tells Hetzner that this is an **external** domain, not an internal record within the `maia.city` zone.

### For `next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `next` (or `next.maia.city`)
- **Value:** `next-maia-city.fly.dev.` (with trailing dot)
- **TTL:** 3600

## Step-by-Step Setup in Hetzner

1. **Log into Hetzner DNS Console**
   - Go to your Hetzner DNS zone for `maia.city`

2. **Add CNAME for API subdomain:**
   - Click "Add Record" or "New Record"
   - **Type:** Select `CNAME`
   - **Name:** Enter `api.next` (Hetzner will automatically append `.maia.city`)
   - **Value:** Enter `api-next-maia-city.fly.dev.` (with trailing dot!)
   - **TTL:** 3600
   - **Comment:** (optional) "Sync proxy service"
   - Save

3. **Add CNAME for main domain:**
   - Click "Add Record" or "New Record"
   - **Type:** Select `CNAME`
   - **Name:** Enter `next` (Hetzner will automatically append `.maia.city`)
   - **Value:** Enter `next-maia-city.fly.dev.` (with trailing dot!)
   - **TTL:** 3600
   - **Comment:** (optional) "Frontend service"
   - Save

## Why the Trailing Dot?

The trailing dot (`.`) in DNS records indicates an **absolute domain name** (FQDN - Fully Qualified Domain Name). Without it, DNS resolvers treat the value as relative to the current zone.

- `api-next-maia-city.fly.dev` → Hetzner thinks: "api-next-maia-city.fly.dev.maia.city" (doesn't exist!)
- `api-next-maia-city.fly.dev.` → Hetzner knows: "api-next-maia-city.fly.dev" (external domain)

## Verification

After setting up DNS:

1. **Check DNS propagation:**
   ```bash
   dig api.next.maia.city CNAME
   dig next.maia.city CNAME
   ```

2. **Test connectivity:**
   ```bash
   curl https://api.next.maia.city/health
   curl https://next.maia.city/
   ```

3. **Update Fly.io secrets:**
   ```bash
   flyctl secrets set PUBLIC_API_DOMAIN="api.next.maia.city" --app next-maia-city
   ```

## Common Issues

### Issue: "Record refers to a target within this zone that does not exist"

**Solution:** Add trailing dot to CNAME value:
- ❌ Wrong: `api-next-maia-city.fly.dev`
- ✅ Correct: `api-next-maia-city.fly.dev.`

### Issue: DNS not resolving

**Solution:** 
1. Wait for DNS propagation (can take up to 48 hours, usually < 1 hour)
2. Check DNS with: `dig api.next.maia.city CNAME`
3. Verify Fly.io app is running: `flyctl status --app api-next-maia-city`

### Issue: SSL certificate errors

**Solution:**
1. Add SSL certificate in Fly.io:
   ```bash
   flyctl certs create api.next.maia.city --app api-next-maia-city
   flyctl certs create next.maia.city --app next-maia-city
   ```
2. Wait for certificate provisioning (usually < 5 minutes)
3. Verify: `flyctl certs show api.next.maia.city --app api-next-maia-city`
