## ADR-0033 — nginx: a vevő-oldali konzol-útvonalak is a citoviso.com-ról a konzolra (:4600)

- **Kiváltó (2026-08-09):** a `citoviso.com` nginx-blokkja csak a `/p/`-t proxyzta a konzolra (:4600),
  minden mást a publikus szerverre (:4800). A vevő-folyam viszont a konzol több útvonalát is hívja
  a `citoviso.com`-on át (PUBLIC_BASE_URL=https://citoviso.com): `/configure/*` (domain-javaslat,
  aldomain-check, order-request), `/pay/*` (fizetőoldal + webhook + done), `/privacy` (§C-link).
  Ezek a publikusra estek → 404. Tünetek: „nem találtunk domain javaslatot", néma aldomain-check,
  404-es fizetőoldal, halott privacy-link.
- **Javítás (ÉLES, tulaj-engedéllyel 2026-08-09):** az `/etc/nginx/sites-enabled/citoviso` blokkba a
  `/p/` mellé bekerült `/configure/`, `/pay/`, `/privacy`, `/mock/`, `/site/` → `proxy_pass :4600`.
  `nginx -t` OK + `systemctl reload nginx`. Backup: `/root/citoviso.nginx.bak.<ts>`. Ellenőrizve:
  mind a fenti út 200 a `citoviso.com`-on át, a `/` továbbra is a publikusra megy.
- **Tanulság:** a backend (domain-javaslat, aldomain-check, pay) végig HIBÁTLAN volt — tisztán
  reverse-proxy routing-hiány. A PUBLIC_BASE_URL a konzol-kiszolgálta vevő-utakat feltételezi a
  citoviso.com-on; az nginx-nek ezt le kell képeznie.
- **Visszafordíthatóság:** 🔄 könnyű — location-blokkok eltávolítása + reload (backup megvan).
- **Státusz:** ELFOGADVA / élesítve (2026-08-09).
