## ADR-0043 — A honlap-ellenőrzés geo-horgonya a lead VÁROSA (nem a régió-címke) + törött link javítása

- **Kiváltó (tulaj, 2026-08-20):** „Beírom a két alap lead adatot a keresőbe — Tekergő balatonberény —
  és azonnal találok honlapot, míg a leadnél faszság van." Ugyanaznap, ettől függetlenül, a keszthelyi
  éles backfill 6 talált honlapjából 4 hibásnak bizonyult és vissza kellett vonni.
- **Lelet: a két hiba EGY gyökérből nő.** A sugaras régió sok települést fog át, ezért a régió-címke
  rossz horgony egyetlen leadhez:
  - **fals negatív** — a `verify()` megkövetelte a régió szavát az oldalon. A balatonberényi Tekergő
    valódi honlapja soha nem írja le, hogy „Keszthely" → a helyes oldalt ELDOBTUK, és a lead
    „nincs honlapja" címkét kapott. Ez a §F hitelesség-bug (olyannak írnánk, hogy „nincs honlapod",
    akinek van).
  - **fals pozitív** — ugyanez fordítva: keszthelyi cégek oldalai „igazolódtak" révfülöpi,
    badacsonytomaji, balatonboglári leadekre, mert az oldal is és a régió is azt mondta: Keszthely.
- **Második, független hiba:** a keresési lekérdezés `„<név> <régió-címke> szállás hivatalos oldal"`
  volt. Brave-en mérve: `Tekergő Balatonberény hivatalos oldal` → a valódi oldal az **1. találat**;
  a `szállás` töltelékszóval 3 foglalóportál előzi meg; a régió-címkével a lead teljesen eltűnik
  (a `szállás` szóra a portálok optimalizálnak, a többszavas címke kinyomja a cégnevet).
- **Harmadik lelet — a forrás rothad:** az OSM `website` tagje a Tekergőnél egy 404-es mélylinket
  tárolt (`/Satorozas`), miközben a gyökér 200-zal él. Ettől a lead `has_own` lett → a webes keresés
  RÁ SEM NÉZETT (az csak `none`/`portal_only` leadeket célzott) → a konzol döglött URL-t mutatott.

**Döntés**
1. **Geo-horgony = a lead saját `city`-je** (ADR-0040 facet), és az **HELYETTESÍTI**, nem kiegészíti a
   régió-tokeneket. Az unió megtartotta volna mind a 4 fals pozitívot a régió szaván keresztül.
   Régió-fallback csak akkor, ha a leadnek nincs városa. A cím szabad szövegét szándékosan NEM
   használjuk: a badacsonyi állományon `hungary` 40/56 leadnél szerepel — egy olyan szó, amit minden
   magyar oldal leír, KIKAPCSOLNÁ az ellenőrzést, nem szigorítaná. (`enrichPresence.geoTerms`)
2. **Lekérdezés-alak:** `„<név> <város> hivatalos oldal"` — a kereső-mag `findOwnSite()`-ba emelve, így
   a felfedezés és a javító-ág ugyanazt használja.
3. **Törött-link javítás** (`enrichOutdated`): egy nem válaszoló oldal nem ítélet, hanem kérdés. Kétszer
   kérdezünk, olcsóbbal kezdve — (a) ugyanazon domain GYÖKERE (ingyenes, 1 HTTP), (b) nyílt webes
   keresés. **Mindkét választ geo-igazoljuk** adopció előtt: egy lejárt, más által újraregisztrált
   domain különben pusztán azért lenne „a lead saját oldala", mert válaszol.
4. **A források legyenek őszinték és nyithatók:** a per-lead Places-lookup mostantól bejelöli magát
   forrásként (eddig egy OSM-ből felfedezett lead „Források: osm"-öt mutatott, miközben minden fotó a
   Places-től jött — a címke ellentmondott a képernyőnek), és a `sourceId` túléli a dedupe-ot
   (`sourceRefs`), így a forrás egy kattintással megnyitható. Régi leadnél a koordináta a tartalék.
5. **Per-lead újragyűjtés a konzolból** (`POST /lead/:id/reenrich`): eddig a dúsítás CSAK scrape-kor
   futott, a CLI-backfill pedig csak `no_site` leadre — vagyis pont az a rekord nem volt frissíthető,
   amit az operátor épp hibásnak lát. Átvéve a backfill **lifecycle-őrét**: kiment megkeresés után
   néma újraminősítés tilos.

- **Regressziós kapu:** `scripts/geo-verify-check.mts` — a 4 visszavont fals pozitív + a Tekergő fals
  negatív + egy helyes találat + a város nélküli fallback fixture-ként rögzítve, és külön assert tiltja
  az unió-visszaesést. Offline, hálózat és kulcs nélkül fut. Ez a tanulság lényege: a hibát annak
  idején egyik pipeline-őr sem kapta el (márka+régió verify, portál-katalógus, sekély-útvonal,
  korroboráció mind ZÖLD volt egy rossz eredményen) — csak az utólagos emberi mintavétel.
- **Bizonyítva élesben:** Tekergő `…/Satorozas` (404) → `https://tekergobalaton.hu/` (élő, mobilbarát,
  8 kép) → a lead helyesen NEM lead. Borbaratok Panzio `http://www.borbaratok.hu/` (elérhetetlen) →
  `https://borbaratok.hu/`, e-mail megtalálva, kép 11 → 43, minősítés `outdated` → `modern`.
- **Visszafordíthatóság:** 🔄 könnyű — a horgony egy tiszta függvény, a javító-ág additív pass.
- **Státusz:** ELFOGADVA / implementálva lokálban (2026-08-20). `tsc` + dizájn-token-lint tiszta,
  konzol 1440px és 390px vizuálisan verifikálva. **Éles DB-re NEM ment ki semmi.** Kapcsolódó:
  ADR-0026 (Brave), ADR-0037 (platform-registry), ADR-0040 (ország/város facet), 03-INVARIANTS §F.
