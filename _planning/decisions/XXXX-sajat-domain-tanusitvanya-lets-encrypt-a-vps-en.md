## ADR-XXXX — Saját domain tanúsítványa: Let's Encrypt (HTTP-01) a VPS-en, gyökér-időzítővel és generált nginx-blokkal

**Dátum:** 2026-10-17 · **Kontextus:** a tulaj aggodalma („az alapcsomag tartalmazza a saját domaint, de soha nem
teszteltük, hogy a mi tárhelyünkre automatizáltan tudjuk-e irányítani”), brief `domain-20261017-095752.md`.
**Kiegészíti:** ADR-0071 (beszerzés-állapotgép), ADR-0103 (Websupport, terv-B: DNS a regisztrátornál, TLS a VPS-en),
ADR-0362 (www → 301), ADR-0372 (ragadt beállítás riasztása), ADR-0276 (OnFailure riasztó).

### Kiváltó (mérve 2026-10-17, élesi olvasás)
- Élesen a lánc VALÓDI: `REGISTRAR_PROVIDER=websupport`, `DNS_PROVIDER=websupport`, `DOMAIN_TARGET_IP` = a VPS.
  A vétel pénzes, a DNS-lépés az apex és a `www` A-rekordját a VPS-re írja.
- A `tls_pending` lépés valódi TLS-kapcsolattal mér (`src/domains/dns/websupport.ts` `certificateStatus`), de
  **tanúsítványt semmi nem kért**: nincs certbot/acme/caddy, `/etc/letsencrypt` nincs; az nginx egyetlen
  tanúsítványa önaláírt `CN=citoviso.com`, ami csak a Cloudflare mögött működik. Egy saját domain nincs a
  Cloudflare mögött → a böngésző elutasítja.
- Következmény: az első valódi rendelés megveszi a nevet, átírja a DNS-t, majd örökre `tls_pending`-ben áll
  (24/72 h riasztás, ADR-0372) — a vevő fizetett, a saját címén nincs oldal. Élesen 0 `domain_provisioning` sor:
  valódi domainnel a lánc soha nem futott; minden domain-kapu mock regisztrátorral és mock DNS-sel fut.

### Döntés
1. **Let's Encrypt, HTTP-01, webroot, a Debian `certbot` csomaggal** (a megújítást a csomag saját időzítője végzi;
   a deploy-hook újratölti az nginxet). Nem Caddy (nem cseréljük le a működő nginx-et), nem Cloudflare for SaaS
   (a terv-B szerint a DNS a regisztrátornál marad, a NS-váltásra nincs API).
2. **Gyökér-időzítő** `citoviso-tenant-tls.timer` (2 perc, prod, a deploy GATE 6 telepíti):
   `deploy/tenant-tls/citoviso-tenant-tls.sh`. Az adatbázist NEM érinti: a névlistát az app-user adja
   (`scripts/tenant-tls-domains.mts`: `tls_pending` beszerzések + `site.custom_domain`); olvashatatlan lista →
   piros, semmi nem változik (soha nem „üres”). Tanúsítványt csak akkor kér, ha az apex már a VPS-re mutat;
   a `www`-t akkor veszi fel, ha az is ide mutat; bukott kérés után 15 percig nem próbálja újra (LE-korlát).
3. **Generált, domainenkénti nginx-blokk** (`deploy/tenant-tls/tenant-site.conf.tmpl` → `/etc/nginx/citoviso-tenants/<név>.conf`):
   :80 → ACME + 301 https; :443 → a saját tanúsítvány, az útválasztás BETŰRE a citoviso.com blokké (az
   `edge-routing-check` piros, ha eltér). Változás után `nginx -t`; piros → az előző blokkok vissza, nincs reload,
   a unit elbukik (ház-riasztás). A listáról kikerült név blokkja lekerül (a tanúsítvány marad).
   Változó-útvonalú `ssl_certificate` helyett statikus blokk: a kulcsot így a root master olvassa, nem a worker.
4. **:80 catch-all** (`deploy/tenant-tls/acme-default.conf`, `default_server`): a még blokk nélküli név ACME-
   ellenőrzése itt fut; minden más 404. A citoviso.com / *.citoviso.com / admin név szerint a saját blokkjába megy.
5. **Egyszeri root-telepítés** `deploy/tenant-tls/install.sh --go` (certbot, webroot, mappa, catch-all, renew-hook) —
   élesi írás, tulaj-engedéllyel. Amíg nincs telepítve, az időzítő 0 névnél zölden kilép; ha egy név tanúsítványra
   vár és certbot nincs → piros (ez a helyes riasztás).

### Bizonyíték
`deploy/tenant-tls/selftest.sh`: valódi nginx 1.26.3 (a VPS-ével azonos Debian csomag), a repó konfigjaival,
magas portokon; a certbot-csonk a HTTP-01 kört a valódi nginx-en át futtatja és eldobható CA-val ír alá.
22 ág zöld (kiadás, érvényes lánc, www, :80 → 301, idempotencia, DNS-várakozás, backoff, olvashatatlan lista,
piros `nginx -t` visszaállítás, levétel, certbot hiánya). Dev-ben a valódi névlistával (`nyugalomvendeghaz.hu`) a
public a tenant oldalát adta (200, „Nyugalom Vendégház”), a `www` 301-gyel a csupasz névre ment.

### Nyitott
- Valódi éles próba a saját `citoviso.hu`-val (teszt-tenant, `registered` állapotú beszerzés, a vétel kimarad) —
  élesi írás, külön tulaj-engedéllyel; utána a teljes lánc vétellel egy ~2 600 Ft-os .hu-n.
- A korábban `www` nélkül kiadott tanúsítványt a feladat nem bővíti utólag (a DNS-lépés a kettőt együtt írja).
