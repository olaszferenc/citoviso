#!/usr/bin/env bash
# End-to-end self-test of the tenant-domain HTTPS job WITHOUT root and without the internet
# (ADR-0394). A REAL nginx (the Debian package, unpacked — same 1.26 as the VPS) runs on
# high ports with the repo's own config files; certbot is a stub that performs the HTTP-01
# round-trip THROUGH that nginx and signs with a throw-away CA; the upstreams are a stub
# that echoes the Host header. Proves: issuance, the generated block, HTTPS with a
# verifiable chain, www/plain-HTTP behaviour, idempotency, backoff, DNS-not-here,
# fail-closed list, red `nginx -t` rollback, removal, unclean names, missing certbot.
#
#   bash deploy/tenant-tls/selftest.sh
set -uo pipefail

R="$(cd "$(dirname "$0")/../.." && pwd)"
P="$(mktemp -d)"
NG="${NGINX_BIN:-}"
fails=0
ok() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fails=$((fails + 1)); fi; }

cleanup() {
  [[ -f "$P/nginx.pid" ]] && kill "$(cat "$P/nginx.pid")" 2>/dev/null
  [[ -n "${UP:-}" ]] && kill "$UP" 2>/dev/null
  rm -rf "$P"
}
trap cleanup EXIT

if [[ -z "$NG" ]]; then
  if command -v nginx >/dev/null; then NG="$(command -v nginx)"; else
    (cd "$P" && apt-get download nginx nginx-common >/dev/null 2>&1) || { echo "nginx nem tölthető le"; exit 2; }
    for f in "$P"/*.deb; do dpkg -x "$f" "$P/pkg"; done
    NG="$P/pkg/usr/sbin/nginx"
  fi
fi
HTTP=18980 HTTPS=18943 UPC=18960 UPP=18981
mkdir -p "$P"/{sites,tenants,live,state,webroot,logs,tmp,ca}

# Upstream stub: answers every request with "<port> <Host>" (console and public apart).
python3 -I - "$UPC" "$UPP" >/dev/null 2>&1 <<'PY' &
import sys, threading, http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        b = f"{self.server.server_port} {self.headers.get('Host')}".encode()
        self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
for p in sys.argv[1:]:
    s = http.server.ThreadingHTTPServer(("127.0.0.1", int(p)), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
threading.Event().wait()
PY
UP=$!

openssl req -x509 -newkey rsa:2048 -nodes -keyout "$P/ca/ca.key" -out "$P/ca/ca.crt" -days 2 -subj "/CN=selftest CA" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$P/ca/cit.key" -out "$P/ca/cit.crt" -days 2 -subj "/CN=citoviso.com" 2>/dev/null
cat >"$P/nginx.conf" <<EOF
worker_processes 1; pid $P/nginx.pid; error_log $P/logs/error.log;
events {}
http { access_log off; client_body_temp_path $P/tmp; proxy_temp_path $P/tmp; fastcgi_temp_path $P/tmp; uwsgi_temp_path $P/tmp; scgi_temp_path $P/tmp;
 include $P/sites/*; }
EOF
port() {
  sed -e "s/listen 80;/listen $HTTP;/; s/listen 80 default_server;/listen $HTTP default_server;/; s/listen 443 ssl;/listen $HTTPS ssl;/" \
    -e "s/127.0.0.1:4600/127.0.0.1:$UPC/; s/127.0.0.1:4800/127.0.0.1:$UPP/" \
    -e "s#/var/www/acme#$P/webroot#; s#/etc/nginx/citoviso-tenants#$P/tenants#; s#/etc/letsencrypt/live#$P/live#; s#/etc/nginx/ssl/citoviso#$P/ca/cit#"
}
port <"$R/deploy/nginx/citoviso.conf" >"$P/sites/citoviso"
port <"$R/deploy/tenant-tls/acme-default.conf" >"$P/sites/citoviso-acme-default"
port <"$R/deploy/tenant-tls/tenant-site.conf.tmpl" >"$P/tenant-site.conf.tmpl"
"$NG" -p "$P" -c "$P/nginx.conf" -t 2>/dev/null || { echo "FAIL: az alap-konfig nginx -t piros"; exit 1; }
"$NG" -p "$P" -c "$P/nginx.conf" 2>/dev/null

cat >"$P/certbot" <<EOF
#!/usr/bin/env bash
set -e; names=(); while [[ \$# -gt 0 ]]; do case "\$1" in -w) W=\$2; shift;; --cert-name) N=\$2; shift;; -d) names+=(\$2); shift;; esac; shift; done
echo "\$N \${names[*]}" >>$P/certbot.calls
[[ -f $P/certbot.fail ]] && exit 1
mkdir -p "\$W/.well-known/acme-challenge"
for d in "\${names[@]}"; do t=\$RANDOM\$RANDOM; echo \$t >"\$W/.well-known/acme-challenge/\$t"
  [[ "\$(curl -s -H "Host: \$d" http://127.0.0.1:$HTTP/.well-known/acme-challenge/\$t)" == "\$t" ]] || exit 1; done
mkdir -p $P/live/\$N; san=\$(printf 'DNS:%s,' "\${names[@]}")
openssl req -newkey rsa:2048 -nodes -keyout $P/live/\$N/privkey.pem -out $P/live/\$N/r.csr -subj "/CN=\$N" 2>/dev/null
openssl x509 -req -in $P/live/\$N/r.csr -CA $P/ca/ca.crt -CAkey $P/ca/ca.key -CAcreateserial -days 2 -out $P/live/\$N/fullchain.pem -extfile <(echo "subjectAltName=\${san%,}") 2>/dev/null
EOF
printf '#!/bin/sh\ncase "$1" in *teszt-panzio.hu) echo "127.0.0.1 STREAM $1";; *) exit 2;; esac\n' >"$P/resolve"
chmod +x "$P/certbot" "$P/resolve"

export TLS_CONF_DIR="$P/tenants" TLS_LIVE_DIR="$P/live" TLS_WEBROOT="$P/webroot" TLS_STATE_DIR="$P/state"
export TLS_TEMPLATE="$P/tenant-site.conf.tmpl" CERTBOT="$P/certbot" TARGET_IP=127.0.0.1 TLS_RESOLVE="$P/resolve"
export NGINX_BIN="$NG -p $P -c $P/nginx.conf" NGINX_RELOAD="$NG -p $P -c $P/nginx.conf -s reload"
JOB="$R/deploy/tenant-tls/citoviso-tenant-tls.sh"
run() { TLS_LIST_CMD="$1" bash "$JOB" >"$P/out" 2>&1; local rc=$?; sleep 1.5; return $rc; }
get() { curl -s -o "$P/body" -w '%{http_code} %{redirect_url} %{ssl_verify_result}' --cacert "$P/ca/ca.crt" "$@"; }
D=teszt-panzio.hu

echo "① kiadás + HTTPS"
ok "az első futás zöld" "run 'echo $D'"
ok "a blokk elkészült" "[[ -f $P/tenants/$D.conf ]]"
ok "a tanúsítvány a www-t is fedi" "grep -q 'www.$D' $P/certbot.calls"
ok "https://$D → 200, érvényes lánc" "[[ \"\$(get --resolve $D:$HTTPS:127.0.0.1 https://$D:$HTTPS/)\" == '200  0' ]]"
ok "a public kapja, a Host megmarad" "[[ \"\$(cat $P/body)\" == '$UPP $D' ]]"
ok "konzol-előtag (/pay/) a konzolra megy" "get --resolve $D:$HTTPS:127.0.0.1 https://$D:$HTTPS/pay/x >/dev/null; [[ \"\$(cut -d' ' -f1 $P/body)\" == '$UPC' ]]"
ok "https://www.$D → érvényes lánc" "[[ \"\$(get --resolve www.$D:$HTTPS:127.0.0.1 https://www.$D:$HTTPS/)\" == '200  0' ]]"
ok "http://$D → 301 https" "[[ \"\$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: $D' http://127.0.0.1:$HTTP/x)\" == '301 https://$D/x' ]]"
ok "ismeretlen host :80 → 404" "[[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: x.invalid' http://127.0.0.1:$HTTP/)\" == 404 ]]"
ok "citoviso.com :80 változatlanul a publicra" "[[ \"\$(curl -s -H 'Host: citoviso.com' http://127.0.0.1:$HTTP/)\" == '$UPP citoviso.com' ]]"
echo "② idempotencia, várakozás, hibák"
ok "második futás: nginx változatlan, nincs új kérés" "run 'echo $D' && grep -q 'nginx változatlan' $P/out && [[ \$(wc -l <$P/certbot.calls) -eq 1 ]]"
ok "DNS nem ide mutat → nincs kérés, zöld" "run 'printf \"$D\nmashol.hu\n\"' && grep -q 'mashol.hu: a DNS még nem ide' $P/out && [[ \$(wc -l <$P/certbot.calls) -eq 1 ]]"
touch "$P/certbot.fail"
ok "bukott kérés → zöld, megjegyzi" "run 'printf \"$D\nuj.teszt-panzio.hu\n\"' && grep -q 'elbukott' $P/out"
ok "15 percen belül nem próbálja újra" "run 'printf \"$D\nuj.teszt-panzio.hu\n\"' && grep -q 'nem próbálom újra' $P/out"
rm -f "$P/certbot.fail"
ok "olvashatatlan lista → piros, semmi nem változik" "! run 'exit 3' && [[ -f $P/tenants/$D.conf ]]"
ok "nem tiszta név kimarad" "run 'printf \"$D\na/../b.hu\n\"' && grep -q 'nem tiszta név' $P/out"
cp "$P/tenant-site.conf.tmpl" "$P/good.tmpl"; echo 'broken_directive;' >>"$P/tenant-site.conf.tmpl"
ok "nginx -t piros → piros, az előző blokk vissza" "! run 'echo $D' && diff -q <(sed s/__DOMAIN__/$D/g $P/good.tmpl) $P/tenants/$D.conf >/dev/null"
cp "$P/good.tmpl" "$P/tenant-site.conf.tmpl"
ok "a hiba után is él a https" "[[ \"\$(get --resolve $D:$HTTPS:127.0.0.1 https://$D:$HTTPS/)\" == '200  0' ]]"
ok "certbot hiányzik + várakozó név → piros" "! CERTBOT=/nincs/certbot run 'printf \"$D\nmeg.teszt-panzio.hu\n\"'"
echo "③ levétel"
ok "a listáról kikerült név blokkja lekerül" "run 'true' && [[ ! -f $P/tenants/$D.conf ]]"
ok "utána a böngésző nem fogadná el (nincs érvényes lánc)" "[[ \"\$(get --resolve $D:$HTTPS:127.0.0.1 https://$D:$HTTPS/)\" != '200  0' ]]"
ok "üres lista, nincs blokk → certbot nélkül is zöld" "CERTBOT=/nincs run 'true'"

if [[ $fails -gt 0 ]]; then echo "❌ tenant-tls önteszt: $fails hiba"; exit 1; fi
echo "✅ tenant-tls önteszt: minden ág zöld (valódi nginx $("$NG" -v 2>&1 | cut -d/ -f2))"
