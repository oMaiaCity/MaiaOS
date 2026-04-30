#!/bin/bash
# First time: fly apps create mail-next-maia-city --org maia-city
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$MONOREPO_ROOT"

flyctl deploy \
	--config services/aven/fly.toml \
	--app mail-next-maia-city \
	--wait-timeout 600 \
	--auto-confirm \
	--ha=false \
	--build-arg "GIT_SHA=${GITHUB_SHA:-$(git -C "$MONOREPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"

echo "Enforcing single machine..."
flyctl scale count 1 --app mail-next-maia-city --yes

echo ""
echo "HTTPS custom hostname (required for https://mail.next.maia.city):"
echo "  fly certs add mail.next.maia.city --app mail-next-maia-city"
echo "  # Add the DNS records Fly prints (A/AAAA and/or CNAME). Then:"
echo "  fly certs check mail.next.maia.city --app mail-next-maia-city"
echo "  (Fly's own hint omits --app; from repo root you need --app mail-next-maia-city.)"
echo ""
echo "Inbound mailbox: To inbox@mail.next.maia.city. AVEN_WHITELISTED_MAILS: @domain = whole domain, user@dom = exact envelope:"
echo "  fly secrets set AVEN_HOSTED_DOMAINS=mail.next.maia.city --app mail-next-maia-city"
echo "  fly secrets set AVEN_ALLOWED_RCPTS=inbox@mail.next.maia.city --app mail-next-maia-city"
echo "  fly secrets set AVEN_WHITELISTED_MAILS='@andert.me,fizzyfritzi@gmail.com' --app mail-next-maia-city"
echo "  fly secrets unset AVEN_ALLOWED_MAIL_FROM AVEN_ALLOWED_MAIL_FROM_DOMAINS --app mail-next-maia-city"
echo "  @domain allows that domain and subdomains (e.g. @andert.me → mail.andert.me). @gmail.com / @googlemail.com mirror each other; user@gmail also allows user@googlemail."
echo "DNS: MX for zone mail.next.maia.city must target this mail host (see provider docs)."
echo "Optional HTTP ingest:"
echo "  fly secrets set AVEN_INGEST_TOKEN=<random> --app mail-next-maia-city"
echo "Dedicated IPv4 (recommended for MX / port 25): fly ips allocate-v4 --app mail-next-maia-city"
