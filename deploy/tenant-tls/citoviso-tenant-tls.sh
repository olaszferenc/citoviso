#!/usr/bin/env bash
# Tenant custom domains → Let's Encrypt certificate + nginx HTTPS block (ADR-0394).
#
#   bash deploy/tenant-tls/citoviso-tenant-tls.sh      # as root, from the app dir (timer)
#
# WHY: the provisioning chain (src/domains/provisionDomain.ts) buys the name, points its
# A records at the VPS and then WAITS in tls_pending until the name serves a valid
# certificate — but nothing ever issued one (measured 2026-10-17: no certbot, nginx only
# has the self-signed citoviso.com cert that works behind Cloudflare). A first real order
# would have charged the customer and stuck forever. This job is the missing link:
#
#   ① the app user prints the names that need/have HTTPS (scripts/tenant-tls-domains.mts);
#      if that fails, NOTHING changes (an unknown list is never read as an empty one);
#   ② a name without a certificate gets one over HTTP-01 (webroot, served by the
#      acme-default catch-all), once its apex resolves to this server — failed attempts
#      back off (Let's Encrypt limits failed validations per hostname);
#   ③ every name with a certificate gets its generated nginx block; a block whose name
#      left the list is removed; then `nginx -t` — a red test restores the previous
#      blocks and fails the unit (OnFailure → house alert), a green one reloads nginx.
# Renewal is certbot's own timer (the webroot is remembered per certificate); the
# deploy hook installed by install.sh reloads nginx after a renewal.
#
# Every path/command is overridable for the self-test (scripts/tenant-tls-check.mts).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$HERE/../.." && pwd)}"
CONF_DIR="${TLS_CONF_DIR:-/etc/nginx/citoviso-tenants}"
LIVE_DIR="${TLS_LIVE_DIR:-/etc/letsencrypt/live}"
WEBROOT="${TLS_WEBROOT:-/var/www/acme}"
STATE_DIR="${TLS_STATE_DIR:-/var/lib/citoviso-tenant-tls}"
TEMPLATE="${TLS_TEMPLATE:-$HERE/tenant-site.conf.tmpl}"
CERTBOT="${CERTBOT:-certbot}"
NGINX_BIN="${NGINX_BIN:-nginx}"
NGINX_RELOAD="${NGINX_RELOAD:-systemctl reload nginx}"
RESOLVE="${TLS_RESOLVE:-getent ahostsv4}"
RETRY_MIN="${TLS_RETRY_MIN:-15}"

log() { echo "[tenant-tls] $*"; }

list_domains() {
  if [[ -n "${TLS_LIST_CMD:-}" ]]; then
    bash -c "$TLS_LIST_CMD"
  else
    (cd "$APP_DIR" && runuser -u citoviso -- npx tsx scripts/tenant-tls-domains.mts)
  fi
}

if ! DOMAINS="$(list_domains)"; then
  log "HIBA: a domain-lista nem olvasható — semmit nem változtatok"
  exit 1
fi

TARGET_IP="${TARGET_IP:-$(grep -E '^DOMAIN_TARGET_IP=' "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)}"
NAME_RE='^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'

shopt -s nullglob
existing=("$CONF_DIR"/*.conf)
if [[ -z "$DOMAINS" && ${#existing[@]} -eq 0 ]]; then
  log "nincs saját domain — nincs teendő"
  exit 0
fi

resolves_here() {
  [[ -n "$TARGET_IP" ]] || return 1
  $RESOLVE "$1" 2>/dev/null | awk '{print $1}' | grep -qxF "$TARGET_IP"
}

mkdir -p "$CONF_DIR" "$STATE_DIR" "$WEBROOT"
BACKUP="$(mktemp -d)"
trap 'rm -rf "$BACKUP"' EXIT
cp -a "$CONF_DIR"/. "$BACKUP"/

changed=0
declare -A wanted=()
while IFS= read -r d; do
  [[ -n "$d" ]] || continue
  if [[ ! "$d" =~ $NAME_RE ]]; then
    log "kihagyva, nem tiszta név: $d"
    continue
  fi
  wanted["$d"]=1

  if [[ ! -s "$LIVE_DIR/$d/fullchain.pem" ]]; then
    if ! command -v "${CERTBOT%% *}" >/dev/null 2>&1; then
      log "HIBA: $d tanúsítványra vár, de a certbot nincs telepítve (deploy/tenant-tls/install.sh)"
      exit 1
    fi
    if ! resolves_here "$d"; then
      log "$d: a DNS még nem ide (${TARGET_IP:-?}) mutat — később"
      continue
    fi
    fail="$STATE_DIR/$d.fail"
    if [[ -n "$(find "$fail" -mmin "-$RETRY_MIN" 2>/dev/null)" ]]; then
      log "$d: az előző kérés elbukott, ${RETRY_MIN} percen belül nem próbálom újra"
      continue
    fi
    names=(-d "$d")
    if resolves_here "www.$d"; then names+=(-d "www.$d"); fi
    log "$d: tanúsítvány kérése (${names[*]})"
    if $CERTBOT certonly --webroot -w "$WEBROOT" --cert-name "$d" "${names[@]}" \
      --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring; then
      rm -f "$fail"
    else
      touch "$fail"
      log "$d: a tanúsítvány-kérés elbukott — ${RETRY_MIN} perc múlva újra"
      continue
    fi
  fi

  [[ -s "$LIVE_DIR/$d/fullchain.pem" ]] || continue
  tmp="$(mktemp)"
  sed "s/__DOMAIN__/$d/g" "$TEMPLATE" >"$tmp"
  if ! cmp -s "$tmp" "$CONF_DIR/$d.conf"; then
    install -m 0644 "$tmp" "$CONF_DIR/$d.conf"
    log "$d: nginx-blokk telepítve"
    changed=1
  fi
  rm -f "$tmp"
done <<<"$DOMAINS"

for f in "$CONF_DIR"/*.conf; do
  name="$(basename "$f" .conf)"
  if [[ -z "${wanted[$name]:-}" ]]; then
    rm -f "$f"
    log "$name: már nincs a listán — nginx-blokk levéve (a tanúsítvány marad)"
    changed=1
  fi
done

if [[ $changed -eq 0 ]]; then
  log "kész, nginx változatlan"
  exit 0
fi
if ! $NGINX_BIN -t; then
  log "HIBA: nginx -t piros — az előző blokkok visszaállítva, nincs reload"
  rm -f "$CONF_DIR"/*.conf
  cp -a "$BACKUP"/. "$CONF_DIR"/
  exit 1
fi
$NGINX_RELOAD
log "kész, nginx újratöltve"
