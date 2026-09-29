## ADR-XXXX — Belépés-keményítés a pilot elé: feltételes `Secure` süti, belépési fék, ÁSZF §9 kártyazárolás (2026-09-29)

- **Kiváltó:** a deploy-készenlét felderítés (koordinátor: `cit92d2a67e`, brief: `~/rc-briefs/dk-biztonsag-apro.md`)
  három apró rést mért: ① a munkamenet-süti (`tenantAuth.ts`, `operatorAuth.ts`) `HttpOnly; SameSite=Lax`, de `Secure`
  nélkül; ② a `/login` (tenant :4800 és operátor :4600) korlátlan jelszó-próbát enged; ③ az ÁSZF §9 nem mondja ki,
  hogy a webcím-rendelésnél a kártyán ZÁROLÁS történik (ADR-0251), holott a fizetési lap és a levél ezt ígéri.

**Döntés**

1. **`Secure` CSAK HTTPS-kérésre** (`src/auth/loginGuard.ts` `isHttpsRequest`): `socket.encrypted`, VAGY
   `X-Forwarded-Proto: https` (az éles nginx `$scheme`-ből írja, felülírja — mérve 2026-09-29), VAGY
   `CF-Visitor: {"scheme":"https"}` (Cloudflare). A dev sima HTTP-n fut — ott a feltétel nélküli `Secure` MINDEN
   belépést megölne. Hamisított fejléc sima HTTP-n csak a hamisítót zárja ki. Mindkét birodalom ugyanazt a
   `sessionCookieAttrs(res.req, …)`-t használja.
2. **Belépési fék: 10 SIKERTELEN próba / 10 perc / IP / birodalom → 429** a belépő lapon, felhasználói üzenettel
   (`T()`), a jelszó-ellenőrzés ELŐTT (letiltott IP a helyes jelszóval sem jut be az ablak végéig). Csak a hibás
   próba számít, így a sokszor belépő kapuk és Elek-futások (127.0.0.1) nem ütköznek bele. Memóriában, mint a
   foglalási fék (`public.ts` `throttled`); az IP-kinyerés UGYANAZ (`X-Forwarded-For` első eleme).
3. **ÁSZF §9 új bekezdés** (verzió **1.2 → 1.3**, hatályos 2026-09-29 — tartalmi változás, ADR-0056): a díjat a
   kártyán csak zároljuk, a zárolás nem terhelés; terhelés csak a sikeres regisztráció után; sikertelenségnél
   feloldás, díj nincs, a feloldott összeg a bank eljárásától függően néhány munkanapon belül elérhető (ADR-0251
   pontosítása szerint, NEM „30 nap”).

**Őrök:** `scripts/login-hardening-check.mts` (új, pre-commit, diff-scope: `src/auth/`, `public.ts`, `console/server.ts`)
— a VALÓDI két szervert indítja 0-s porton, a `/logout` Set-Cookie-ján méri a két ágat (http → nincs Secure;
XFP/CF-Visitor https → van), és 11 hibás `/login`-t küld birodalmanként (a 11. = 429, másik IP szabad).
`scripts/legal-check.mts` bővítve: a §9 zárolás-mondata + a `barion.ts` `reserve → "DelayedCapture"` kötése (Reservation
esetén a mondat hamis lenne, ADR-0228). Negatív kontroll: feltétel nélküli / soha-Secure / kikapcsolt fék → piros.

**Nyitva (szándékosan, tulaj-döntés, PILOT UTÁN):** CSRF-token, `X-Forwarded-For` hamisíthatósága (az nginx
`$proxy_add_x_forwarded_for`-t ír, az első elem a kliensé — a fék IP-rotálással megkerülhető, ugyanúgy, mint a
foglalási fék), vendég-lemondó token.

**Visszafordíthatóság:** 🔄 (a süti-attribútum és a fék egy modulban; az ÁSZF-verzió 🚪 — az elfogadott verzió köt).
**Elvetett:** feltétel nélküli `Secure` (dev-belépés halála); a sikeres belépések számolása (a kapuk falába ütközne);
a foglalási `bookingHits` térkép újrahasznosítása (IP-kulcsú KÖZÖS számláló: egy vendég-foglalás a belépést fogyasztaná).
