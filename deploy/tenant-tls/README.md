# Saját domain HTTPS — tanúsítvány + nginx-blokk (ADR-XXXX)

A beszerzés (`src/domains/provisionDomain.ts`) a név megvétele és a DNS átírása után `tls_pending`-ben vár, amíg
a név érvényes tanúsítványt nem szolgál ki. Ezt a tanúsítványt ez a mappa adja.

| fájl | hova kerül élesen | ki teszi oda |
|---|---|---|
| `citoviso-tenant-tls.sh` | a deployolt fában marad (`/opt/citoviso/app/deploy/tenant-tls/`) | deploy |
| `tenant-site.conf.tmpl` | → `/etc/nginx/citoviso-tenants/<név>.conf` (névenként) | az időzítő |
| `acme-default.conf` | → `/etc/nginx/sites-enabled/citoviso-acme-default` | `install.sh --go` |
| `../systemd/citoviso-tenant-tls.{service,timer}` | systemd, rootként, 2 percenként | deploy GATE 6 |

## Telepítés (egyszer, élesi írás → tulaj-engedéllyel)

1. A commit élesen legyen (`scripts/deploy-prod.sh`) — ez az időzítőt is felteszi; 0 névnél zölden fut.
2. A VPS-en rootként: `bash /opt/citoviso/app/deploy/tenant-tls/install.sh` (dry-run), majd `--go`.
   Felteszi a `certbot` csomagot (megújítás: a csomag saját `certbot.timer`-e), a webrootot, a catch-allt és a
   megújítás utáni nginx-reload hookot; piros `nginx -t` esetén visszavonja a catch-allt.

## Önteszt (root és internet nélkül)

`bash deploy/tenant-tls/selftest.sh` — valódi nginx (a Debian csomag, kicsomagolva), csonk certbot, ami a HTTP-01
kört a valódi nginx-en át futtatja. Az útválasztás egyezését a citoviso.com blokkal a
`scripts/edge-routing-check.mts` méri.
