# Tenant-aktivitás és látogatottság — JÓVÁHAGYOTT TERV (2026-11-04)

Tulaj-döntés (2026-11-04, a koordinátoron át): **1A** (partner-blokk) és **2A** (összesítő) jóváhagyva.
A 3. pont (kattintás-mérő script, új adatkezelés) és a 4. pont (a tenant-admin „Forgalom” fülének
bővítése) NEM kapott igent → **csak a már mért adatból dolgozunk**, új mérés, új adatkezelés,
migráció nincs.

Fájlok: `blokk.html` (a partner-adatlap blokkja; az A változat a jóváhagyott), `osszesito.html`
(Riport › Tenantok; az A változat a jóváhagyott). A mockok B/C változata és a „MINTA” nézet csak a
döntés anyaga volt, NEM köt. Képek: `blokk-A-*.png`, `osszesito-A-*.png` (mobil 390 + asztali).

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

### Partner-blokk (A) — `src/console/partnerActivity.ts` → `partnerActivityHtml({partnerId, tenantId})`
1. Fejléc: „Aktivitás és látogatottság” + egy ítélet-címke (Alvó / Még nem lépett be / Új / Aktív / Teszt).
2. Egy ítélet-mondat: a tulaj belépései és mentése + az élő oldal megnyitásai, kimondva, ha a szám
   bizonytalan (pl. „vendég még nem azonosítható”).
3. Négy szám: Belépés 7/30 nap (+ utolsó) · Utolsó mentés (+ fül) · Látogató 7/30 nap · Érdeklődés 30 nap.
4. Két oszlop (mobilon egymás alatt): **bal** — a tulaj utolsó eseményei (belépés, admin, mentés, saját
   oldal, Megrendelem, próba indulása, belépő levél); **jobb** — vendégek naponta (30 nap oszlopdiagram),
   honnan jönnek (a küldő oldal csoportja), eszköz-arány.
5. Lábjegyzet: mi a „látogató” és mi az „alvó” szabálya.
6. Beszállító (tenantId = null) → nincs blokk (null).

### Összesítő (A) — `GET /report/tenants` (a Riport „Tenantok” füle)
1. Szűrő-chipek: Aktív (fizető + próba) · Fizető · Próba · Alvó · Mind; „teszt-tenantok is” kapcsoló
   (alapból rejtve, a `[TESZT]` névelőtag + Elek park-lead szerint, mint a Próba fülön).
2. KPI-sáv: Aktív tenant (fizető · próba) · Belépett 7 napja · Alvó · Látogató · érdeklődés 30 nap.
3. Tábla, minden tenant egy sorban: Tenant (+ állapot) · Belépés 7/30 (+ utolsó) · Utolsó mentés ·
   Látogató 7/30 (+ 7 napos mini-oszlop) · Fő forrás · Érdeklődés 30 nap · Jelzés. Rendezhető a
   fejlécre kattintva; alapból az „Alvó” elöl. Sorra kattintva kinyílik az indoklás + link a partner-adatlapra.
4. Mobilon a tábla kártyalistává vált.

## Szabályok (a számok igazsága, §B.17)
- **Látogató** = napi lenyomat (`site_visit.visitor_hash` + nap), botok nélkül.
- **A tulaj saját megnyitása kiszűrve — a MEGLÉVŐ adatból:** ha egy lenyomat aznap a tenant-adminból
  (`referrer = citoviso.com`, ott él a `/admin`) vagy a konzolból (`referrer = admin.citoviso.com`, az
  operátor) érkezett, az aznapi összes megnyitása a tulajé/operátoré. Új mérés nincs, ez
  lekérdezés-idejű szűrés. Ami így nem szűrhető (a tulaj beírja a címet), az benne marad — a lábjegyzet kimondja.
- **Forrás** = a meglévő küldő-hosztnév csoportja (Google, Bing, Facebook/Instagram, portál, e-mail-app,
  saját oldalon belül, közvetlen, egyéb weboldal). UTM, ország, megnézett aloldal, kattintás NEM mért
  (külön döntés, nem kapott igent) — a blokk egy sorban kimondja.
- A `site_visit` csak a főoldal megnyitását számolja (ADR-0108) — a blokk ezt nem szépíti.
- **Alvó**: fizetőnél 14 napja nincs belépés és mentés; próbánál 3 nap után sincs belépés, vagy 5 napja
  nincs életjel (belépés/mentés). **Még nem lépett be**: próba, 3 napnál fiatalabb, belépés nélkül.
  **Új**: 3 napnál fiatalabb fizető/próba, aki már belépett.
- **Belépés**: `tenant_activity` (kind = login, 10-27 óta); ami előtte volt, arról csak a
  `tenant_user.last_login_at` tud (utolsó belépés), azt is figyelembe vesszük.
- **Érdeklődés** = `booking_request` a tenant oldalain (az érdeklődés és a foglalási kérés egy táblában).
