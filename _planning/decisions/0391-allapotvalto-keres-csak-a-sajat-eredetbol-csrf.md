## ADR-0391 — Állapotváltó kérés csak a saját eredetből (CSRF)

**Dátum:** 2026-10-14 · **Kontextus:** IT-tesztelő S-1 (éles 0038426a). Élőben igazolta: egy idegen Origin-fejléces POST átírta egy tenant árát.

### A rés
A session-sütik (`cit_session`, `cit_op_session`) `SameSite=Lax`-ok és host-only-k. A böngésző viszont minden `*.citoviso.com` hostot ugyanannak a site-nak tekint. Így egy tenant-aldomain vagy előnézeti címke lapja a tulaj sütijével POST-olhatott a `citoviso.com/admin/*`-ra, és ugyanez igaz a konzolra is. A Lax ez ellen nem véd. CSRF-token vagy Origin-ellenőrzés eddig sehol nem volt.

### Döntés
Mindkét szerver (publikus :4800, konzol :4600) az útválasztás előtt, egyetlen ponton ellenőriz (`src/server/originGuard.ts`):
- **Minden nem-GET/HEAD/OPTIONS kérésnél** az `Origin` hostjának (ha nincs Origin, a `Referer`-ének) egyeznie kell a kérés `Host`-jával. Az összevetés porttal történik, az alapport (80/443) nélkül, a séma nélkül, mert a TLS a Cloudflare-nél ér véget. Egy tenant hostja így csak a saját tenantjára érvényes, és egy testvér-aldomain is idegennek számít.
- **`Origin: null` tilos.**
- **Ha egyik fejléc sincs, a kérés átmegy.** Ez a nem-böngésző kliens esete (Barion, relay, a saját őreink). Böngésző cross-origin POST-nál mindig küld Origint.
- **Kivételek útvonal szerint:** `/pay/webhook/` (Barion), `/api/sms-relay/`, `/api/mms-relay/`, `/api/replies/ingest` (bearer-titokkal azonosítanak).
- **A `Host` forrása:** élesen az nginx `proxy_set_header Host $host` értéke, ami a böngésző hostja (mérve 2026-10-14, minden blokkban, a saját domaines tenantoké is). Az `X-Forwarded-Host`-ot soha nem használjuk, mert az nginx nem írja felül, így hamisítható (ADR-0278).
- **Elutasításkor** 403 a válasz, és egy `[csrf]` naplósor.

### Őr
`scripts/csrf-origin-check.mts`: szabálytáblázat (benne a hamisított proxy-fejlécek, a saját domain, a testvér-aldomain, a null, a Referer és a kivételek), valamint a két szerver élő kérésekkel, negatív kontrollal. A meglévő szerveres őrök (whole-only, guest-link-host, booking-offer, free-trial, snapshot-propagation stb.) zöldek maradtak.

### Visszafordíthatóság
🔄 könnyű: egyetlen előellenőrzés két helyen. Ha egy valódi böngészős út elakad, a naplóban a `[csrf] elutasítva` sor megmondja, melyik.
