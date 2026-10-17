# Éles nginx — OLVASOTT MÁSOLAT (referencia)

Az éles VPS `/etc/nginx/sites-enabled/` két fájlja, betűre, 2026-10-11-én olvasva (ADR-0366).

- `citoviso.conf` ← `/etc/nginx/sites-enabled/citoviso` (`citoviso.com`, `www.`, `*.citoviso.com`)
- `citoviso-admin.conf` ← `/etc/nginx/sites-enabled/citoviso-admin` (`admin.citoviso.com` → konzol)

⛔ **Ez NEM a deploy forrása.** Élesre innen semmi nem megy; az éles fájlt ez a repó nem írja.
Azért van itt, hogy a dev-útválasztás (`src/server/edgeRoutes.ts`) ehhez legyen mérve:
a `scripts/edge-routing-check.mts` összeveti a kettőt, és bukik, ha eltérnek.

Ha élesen változik az nginx (tulaj-engedéllyel), ezt a másolatot ÉS az `edgeRoutes.ts`-t
ugyanabban a commitban kell frissíteni — különben az őr piros.

## Saját domainek (ADR-0394)

A tenantok saját domainjeit NEM ez a két fájl szolgálja ki, hanem a `deploy/tenant-tls/` alatt leírt
generált, névenkénti blokk (`/etc/nginx/citoviso-tenants/`) és a :80 catch-all (`citoviso-acme-default`).
Az útválasztásuk betűre ezé a blokké — az `edge-routing-check` ezt is méri.
