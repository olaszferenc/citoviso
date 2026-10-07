## ADR-0337 — Fotó-behúzás operátor által megadott linkről, díj nélkül (új provenance: `website`)

**Dátum:** 2026-10-07 · **Döntött:** tulaj („NEM FIZETEK. FEJLESSZÜNK”), megvalósítás: CIT SUB a koordinátor briefjéből

**Kontextus.** A digitális kolléga (Neo) böngészővel megtalálja a lead portál-adatlapját vagy saját
(elavult) honlapját, de a konzolon nem tudta a képeket a leadhez kötni. Az egyetlen gomb
(„Portál-fotók újragyűjtése”, `rescrapePhotos`) az `enrichPortal`-on át FIZETŐS webes keresést
indíthat, ha a leadnek <6 ismert adatlapja van; a Places szintén fizetős.

**Döntés.**
1. Új végpont: `POST /lead/:id/photo-links` (`links` mező, 1–10 URL, soronként) — sima űrlap a
   Fotók fülön, és ugyanaz JSON-nal (`Accept: application/json`) gépi adagoláshoz. CSAK a megadott
   oldalakat olvassa: nincs webSearch, nincs Places, nincs Street View-hívás (a fotószám a tárolt
   Street View-ítéletből számolódik újra). A fizetős `rescrape-photos` változatlan.
2. Ismert portál → a meglévő `readPortalListing` (entitás-egyezés, sávok, fotószűrők változatlanul;
   a medium sáv továbbra sem tulajdonít fotót). Az operátor szava NEM írja felül a kaput (§F.17b).
   A szallas.hu link a nyílt booked.hu ikerpáron olvasódik (ugyanaz a szabály, mint a gyűjtésnél).
3. Saját honlap → új általános olvasó (`src/scraper/attachPhotoLinks.ts`): `<img>` (lazy-attribútumok,
   a srcset LEGNAGYOBB eleme), linkelt képfájl, inline háttérkép, og:image; a főoldal + legfeljebb 2
   galéria-oldal. Szűrők: a meglévő URL-tiltólista, méret/arány/hirdetésméret (`photoQuality.ts`),
   felirat-alapú idegen-szállás őr, hasonló-szállás blokk levágása; idegen domain képe eldobva,
   kivéve a Wix/Squarespace CDN-t (a googleusercontent/wp.com/Instagram NEM kivétel: Places-, proxy-
   és idegen képet hozhatnak). Azonosítás (jog-őr FLAG után szigorítva): a leadnél tárolt `has_own`
   honlap hostja, VAGY a domain a szállás nevét viseli (márka-szó / teljes név) ÉS az oldalon a lead
   SAJÁT települése áll, VAGY az oldalon a név + a lead telefonszáma. Egy márka-szó + település az
   oldalon NEM elég (városi portál / gyűjtőoldal). Az igazolt oldal a lazított (400 px)
   méretküszöböt kapja, mint a high-sávú adatlap.
4. **Új provenance-osztály: `website`** (§A.3). A saját honlapról olvasott kép nem `portal` (nem
   adatlap) és nem `owner` (egy lescrapelt oldal nem licenc). Élesítési szabálya a `portal`-éval
   azonos: csak a §A.1/b nyilatkozattal mehet élesre (`photoPolicy.ts` változatlan — a nem-owner
   osztályok így viselkednek).
5. Tárolás: a `portalProfiles`-ba kerül (`portal: "own_site"`, csak fotók — ár/szoba/leírás NEM,
   egy elavult honlap árát nem idézzük), így a fotószám, a Fotók fül és a generátor változtatás
   nélkül látja. A generátor a fotó saját provenance-ét viszi tovább (eddig fixen `portal`).

**Elvetett.** (a) Az operátor-link a kapu megkerülésével — a téves fotó-tulajdonítás a legsúlyosabb
hibánk. (b) `owner` címke a honlap-képre — élesítési jogot adna nyilatkozat nélkül. (c) A
`rescrape-photos` módosítása — működő kód, a brief kifejezetten tiltja.

**Visszafordíthatóság.** 🔄 Új, mellette élő út; migráció nincs (JSON a `lead.raw`-ban).
