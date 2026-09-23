## ADR-0046 — A `reviews` modul: FIRST-PARTY vélemény a gerinc, a Google-ból CSAK a szám jön át

> **Számozás:** a 0045-öt egy párhuzamos szál vitte el (tudásbázis-doktrína), ezért lett ez 0046.

- **Kiváltó (tulaj, 2026-08-21):** „Az eseteknek a nagyon nagy részében van a találati listában
  Google Maps-es jelenlét. Onnan miért nem emeljük át a felhasználói véleményeket? Vagy csak adott
  esetben az átlagot, meg pár kommentet." A kérdés jogos volt: a `reviews` volt az EGYETLEN modul,
  ami még kivétel volt a renderelés-őrben, és az indok („nincs vélemény-adatunk") a DATA-hiányt
  írta le, nem azt, hogy a megjelenítés ne lenne mérhető — vagyis egy vakfolt volt, cetlivel.
- **Második kiváltó (tulaj, ugyanaznap):** az első javaslatomat — „690 Ft/hó-ért linkeljünk át a
  Google-véleményekre" — joggal utasította el mint üzleti képtelenséget. A modul értelme, hogy a
  bizalmi jel AZ OLDALON maradjon; egy puszta link a látogatót viszi el, akit épp konvertálnánk.

**Döntés**

1. **A gerinc a FIRST-PARTY vélemény** (`site_review`). Ez a MI adatunk: tárolható, moderálható,
   a statikus snapshotba renderelhető, és nulla marginális költségű — ami illik a volumen-alapú
   árazáshoz. A vendég az oldalon ír, a tulaj dönt, a szöveg kint marad.

2. **A Google-ból CSAK A SZÁM jön át** (`site_place_rating`: átlag + darabszám + `place_id`).
   Két szabály EGYÜTT zárja be a szöveg átemelését — bármelyik önmagában megkerülhető lenne:
   - **tárolni tilos** („You must not pre-fetch, cache, or store Places API content"); az egyetlen
     korlátlanul tárolható mező a `place_id`. A tenant-oldal STATIKUS SNAPSHOT, tehát a beégetett
     vélemény-szöveg = tárolt tartalom;
   - **futásidőben drága**: a review-szöveg az Enterprise+Atmosphere sáv (~$25/1000 ≈ 9 Ft/hívás),
     ami egy 690 Ft/hó-s modult **~77 oldalletöltés** után veszteségessé tesz.

   A **szám más jogi kategória**: az átlag és a darabszám TÉNY, nem szerzői mű — és a resolve
   (`resolveOne.ts`) **eddig is lekérte, majd eldobta**. Tehát nulla többletköltségű.

3. **A kattintás a Google-véleményekre visz** — nem azért, hogy elküldjük a látogatót, hanem mert
   a szám mellé kell a hitelesítés lehetősége, és ez egyben a feltételek által kért ATTRIBÚCIÓ.

4. **A Google-invitálás iránya MEGFORDÍTVA.** Nem a leendő vendéget küldjük a Google-re, hanem azt,
   aki már itt járt és már írt nálunk: a köszönő-levél hívja meg Google-értékelés írására. Ez a
   tulaj Maps-láthatóságát növeli (ADR-0041), ahelyett hogy egy látogatót adna oda.

5. **Moderáció a booking mintájára:** kérés → a tulaj a LEVÉLBŐL dönt egy koppintással, belépés
   nélkül → a vendég értesül. Idempotens. Az admin a második ajtó, ahol egy kint lévő vélemény
   le is vehető. Séma-szinten előkészítve az „igazolt vendég" (`booking_request_id` + `verified`).

6. **A v1 konfig HAZUDOTT, ezért kivezettük.** A `source: google|own|both` (alapértelmezés:
   `google`!) mögött nulla adat volt, és az alapértelmezett ágat nem is szállíthattuk — ez a
   galéria elrendezés-választójának hibája újra (ál-választás = hazugság). A `minStars` is ment:
   a tulaj úgyis egyenként dönt, egy állandó „csak a 4 csillag fölöttit mutasd" szűrő pedig a
   LÁTOGATÓ megtévesztése. Helyettük csak olyan mező maradt, ami tényleg hat (v2 + migrációval).

7. **A jelvény két kapun megy át, mindkettő ZÁRVA bukik:** `match_confidence >= 0.7` (a fals
   pozitív találat a SZOMSZÉD csillagait tenné ki — ADR-0043 Piroska-esete tényhűség-sértésként)
   és 30 napos frissesség (elavult szám mai adatként = kis hazugság). Ismeretlen konfidencia NEM
   számít jó hírnek.

**Amit NEM ígérünk:** csillagos találati megjelenést (rich result). A review snippet szabály tiltja
a más oldalról aggregált értékelés jelölését, és a saját magát moderáló fél oldala eleve nem
jogosult rá. A modul értéke: **oldalon belüli bizalom + saját adat-vagyon**, nem SEO-csillag.

**Visszafordíthatóság:** 🔄 additív (új táblák, meglévő `SiteData`-mezőre ülő jelvény), nulla soron
bevezetve. Egyirányúvá akkor válik, amikor éles tenant-vélemény kerül rá.

**Bizonyíték:** `scripts/review-flow-check.mts` (24 ellenőrzés valódi DB-n, eldobható fixture-rel),
`scripts/shot-review-form.mts` (390px, mérve), a `reviews` kivétel MEGSZŰNT a
`module-render-check`-ben. Mindhárom kritikus tulajdonságot szándékos rontással pirosra futtattuk.

**⚠️ Amit az őr-írás közben tanultunk (a legfontosabb sor ebben az ADR-ben):** az őr ELSŐ változata
ZÖLD maradt egy szándékosan kibelezett kapcsolón, mert a `moduleContentFor` RÉSZEREDMÉNYÉT mérte,
nem a renderelt oldalt. Élesben a kimenet rámergelődik a meglévő `SiteData`-ra
(`{...siteData, ...moduleContent}`), így egy „semmit nem ad hozzá" ág **ott hagyja a mockból örökölt
csillagot** — a tulaj kikapcsolja, és a lapon nem változik semmi. A javított mérés a MERGELT adatot
rendereli, és csillagot SZÁMOL (a rontott kód `card-sidebar`-on 15 csillagot hagyott bent).
Ugyanez a hibaosztály negyedszer ebben a szálban.

**Mellék-lelet (külön szelet):** a `POST /api/hirlevel` végpont NEM LÉTEZIK — a hírlevél-űrlap a
semmibe küld. Ugyanaz a minta („van űrlap ≠ működik"), csak egy másik modulban.
