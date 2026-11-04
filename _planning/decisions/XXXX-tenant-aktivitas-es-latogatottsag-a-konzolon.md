## ADR-XXXX — Tenant-aktivitás és látogatottság a konzolon, csak a már mért adatból; a tulaj saját megnyitása nem vendég

**Dátum:** 2026-11-04 · **Státusz:** elfogadva (tulaj: 1A + 2A; a 3. és 4. pont nem kapott igent — lokál, nem élesítve) · Épít: ADR-0108 (first-party látogatás-mérés), ADR-0407 (tenant-aktivitás napló), ADR-0418 (partner-adatlap, az „Aktivitás” fül helye)

### Kontextus

A tulaj (2026-11-03): „nem látszik, mennyire aktív a tenant az oldalon, vagy mennyien nézik az oldalt,
honnan jönnek, semmi”. Felmérve élesen (11-03): a mérés MÁR VOLT — `tenant_activity` (10-27 óta, 4 sor)
és `site_visit` (10-13 óta, sütimentes napi lenyomat) —, csak a konzolon semmi nem olvasta (a tenant-
admin „Forgalom” füle és a havi forgalmi levél igen). A meglévő számláló viszont a tulaj és az operátor
saját megnyitását is vendégnek vette: a Duna Vibe House első „látogatója” a konzolból jött.

### Döntés

1. **Partner-adatlap → „Aktivitás” fül: 1A** (két oszlop: a tulaj eseményei | a vendégek napi görbéje,
   forrása, eszköze; fölötte ítélet-címke, egy mondat, négy szám). Terv: `assets/design-refs/console/tenant-aktivitas/`.
2. **Riport → „Tenantok” fül: 2A** (`/report/tenants`, minden tenant egy sorban, rendezhető, szűrő:
   Aktív / Fizető / Próba / Alvó / Mind, teszt alapból rejtve, mobilon kártyák).
3. **Csak a már mért adatból.** Nincs új mérés, nincs új adatkezelés, nincs migráció: a kattintás-mérő
   script (telefon / e-mail / CTA) és a tenant-admin „Forgalom” fülének bővítése NEM kapott igent.
   Ország, UTM, megnézett aloldal, kattintás ezért nem látszik — a blokk lábjegyzete kimondja.
4. **A tulaj / operátor saját megnyitása nem vendég** — lekérdezés-időben, a tárolt adatból: ha egy
   napi lenyomat aznap a tenant-adminból (`citoviso.com`) vagy a konzolból (`admin.citoviso.com`)
   érkezett, az aznapi összes megnyitása saját. Amit így nem látunk (a tulaj beírja a címet), az bent
   marad — kimondva.
5. **Forrás = a tárolt küldő-hosztnév csoportja** (Google, Bing, egyéb kereső, közösségi, portál,
   e-mail-app, az oldalon belül, közvetlen, egyéb). Az „az oldalon belül” nem lehet fő forrás.
6. **„Alvó” szabály egy helyen** (`verdictOf`): fizetőnél 14 napja, próbánál 5 napja nincs belépés vagy
   mentés, vagy 3 nap után sem lépett be. 3 napnál fiatalabb: „Új” (belépett) / „Még nem lépett be”.
   Lejárt / megszűnt: „Lezárult”, nem alvó. Teszt (`[TESZT]` + Elek park-lead): „Teszt”, alapból rejtve.

**Visszafordíthatóság:** 🔄 — tiszta olvasó-réteg, adatot nem ír, nem gyűjt.

**Elvetett alternatívák:** B (közös idősáv) és C (kompakt) a blokkra; B (ítélet-csoportok) az
összesítőre — a tábla 50+ tenantnál is skálázik. Az nginx-napló visszamenőleges használata: Host
nélküli, 14 napos, tenantonként nem bontható.

**Nyitott (nem ebben a körben):** a kattintás-mérés és a bővebb forrás (ország, UTM, aloldal) új
adatkezelés → a jogi csomag (adatkezelési tájékoztató) előbb; a linkes belépés nem írja a
`tenant_user.last_login_at`-ot (a blokk a naplóból olvas, így nem érinti).

**Őr:** `scripts/tenant-activity-check.mts` (pre-commit).
