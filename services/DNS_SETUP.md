# DNS Setup Guide - Hetzner

Guide for setting up DNS records in Hetzner DNS for MaiaOS services.

## Hetzner DNS Error Fix

If you see the error: **"Record verweist auf ein Ziel innerhalb dieser Zone, das nicht existiert"** (Record refers to a target within this zone that does not exist), this means Hetzner is trying to validate the CNAME target as an internal record.

## Correct DNS Configuration

### For `sync.next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `sync.next` (or `sync.next.maia.city` depending on Hetzner's interface)
- **Value:** `sync-next-maia-city.fly.dev.` (note the trailing dot!)
- **TTL:** 3600

**Important:** The trailing dot (`.`) at the end of `sync-next-maia-city.fly.dev.` tells Hetzner that this is an **external** domain, not an internal record within the `maia.city` zone.

### For `next.maia.city` CNAME Record

**Correct Configuration:**
- **Type:** CNAME
- **Name:** `next` (or `next.maia.city`)
- **Value:** `next-maia-city.fly.dev.` (with trailing dot)
- **TTL:** 3600

## Step-by-Step Setup in Hetzner

1. **Log into Hetzner DNS Console**
   - Go to your Hetzner DNS zone for `maia.city`

2. **Add CNAME for sync subdomain:**
   - Click "Add Record" or "New Record"
   - **Type:** Select `CNAME`
   - **Name:** Enter `sync.next` (Hetzner will automatically append `.maia.city`)
   - **Value:** Enter `sync-next-maia-city.fly.dev.` (with trailing dot!)
   - **TTL:** 3600
   - **Comment:** (optional) "Sync service"
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

- `sync-next-maia-city.fly.dev` → Hetzner thinks: "sync-next-maia-city.fly.dev.maia.city" (doesn't exist!)
- `sync-next-maia-city.fly.dev.` → Hetzner knows: "sync-next-maia-city.fly.dev" (external domain)

## Verification

After setting up DNS:

1. **Check DNS propagation:**
   ```bash
   dig sync.next.maia.city CNAME
   dig next.maia.city CNAME
   ```

2. **Test connectivity:**
   ```bash
   curl https://sync.next.maia.city/health
   curl https://next.maia.city/
   ```

3. **Update Fly.io secrets:**
   ```bash
   flyctl secrets set PUBLIC_API_DOMAIN="sync.next.maia.city" --app next-maia-city
   ```

## Common Issues

### Issue: "Record refers to a target within this zone that does not exist"

**Solution:** Add trailing dot to CNAME value:
- ❌ Wrong: `sync-next-maia-city.fly.dev`
- ✅ Correct: `sync-next-maia-city.fly.dev.`

### Issue: DNS not resolving

**Solution:** 
1. Wait for DNS propagation (can take up to 48 hours, usually < 1 hour)
2. Check DNS with: `dig sync.next.maia.city CNAME`
3. Verify Fly.io app is running: `flyctl status --app sync-next-maia-city`

### Issue: SSL certificate errors

**Solution:**
1. Add SSL certificate in Fly.io:
   ```bash
   flyctl certs create sync.next.maia.city --app sync-next-maia-city
   flyctl certs create next.maia.city --app next-maia-city
   ```
2. Wait for certificate provisioning (usually < 5 minutes)
3. Verify: `flyctl certs show sync.next.maia.city --app sync-next-maia-city`
