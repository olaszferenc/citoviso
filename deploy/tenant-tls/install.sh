#!/usr/bin/env bash
# One-time root setup of the tenant-domain HTTPS edge on the live VPS (ADR-0394).
#
#   bash deploy/tenant-tls/install.sh        # dry-run: what is missing, nothing changes
#   bash deploy/tenant-tls/install.sh --go   # as root, from /opt/citoviso/app (deployed commit)
#
# ⛔ A live-server write: only with the owner's explicit, current permission (CLAUDE.md §0).
# Installs: certbot (Debian package — its own timer renews), the ACME webroot, the
# generated-blocks directory, the port-80 catch-all (acme-default.conf) and a renewal
# deploy hook that reloads nginx. The per-domain work itself is the timer
# (citoviso-tenant-tls.timer, installed by deploy-prod.sh GATE 6 like every prod timer).
# A red `nginx -t` removes the catch-all again — the running nginx is never reloaded broken.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE=/etc/nginx/sites-enabled/citoviso-acme-default
HOOK=/etc/letsencrypt/renewal-hooks/deploy/citoviso-reload-nginx

echo "① certbot:        $(command -v certbot || echo 'HIÁNYZIK')"
echo "② webroot:        $([[ -d /var/www/acme ]] && echo megvan || echo 'HIÁNYZIK') (/var/www/acme)"
echo "③ blokk-mappa:    $([[ -d /etc/nginx/citoviso-tenants ]] && echo megvan || echo 'HIÁNYZIK') (/etc/nginx/citoviso-tenants)"
if [[ -f "$SITE" ]] && cmp -s "$HERE/acme-default.conf" "$SITE"; then s=azonos; elif [[ -f "$SITE" ]]; then s=ELTÉR; else s=HIÁNYZIK; fi
echo "④ :80 catch-all:  $s ($SITE)"
echo "⑤ renew-hook:     $([[ -x "$HOOK" ]] && echo megvan || echo 'HIÁNYZIK') ($HOOK)"

if [[ "${1:-}" != "--go" ]]; then
  echo "dry-run — telepítés (rootként, tulaj-engedéllyel): bash $0 --go"
  exit 0
fi
[[ $EUID -eq 0 ]] || { echo "root kell"; exit 1; }

command -v certbot >/dev/null || { apt-get update -q && apt-get install -y -q certbot; }
install -d -m 0755 /var/www/acme /etc/nginx/citoviso-tenants
install -d -m 0755 "$(dirname "$HOOK")"
printf '#!/bin/sh\n# ADR-0394: a renewed tenant certificate is only served after a reload.\nsystemctl reload nginx\n' >"$HOOK"
chmod 0755 "$HOOK"

install -m 0644 "$HERE/acme-default.conf" "$SITE"
if ! nginx -t; then
  rm -f "$SITE"
  echo "HIBA: nginx -t piros — a catch-all levéve, nginx változatlan"
  exit 1
fi
systemctl reload nginx
echo "kész — ellenőrzés:"
curl -s -o /dev/null -w '   ismeretlen host :80 → %{http_code} (404 várt)\n' -H 'Host: tls-probe.invalid' http://127.0.0.1/
curl -s -o /dev/null -w '   citoviso.com :80 → %{http_code} (a régi blokk)\n' -H 'Host: citoviso.com' http://127.0.0.1/
