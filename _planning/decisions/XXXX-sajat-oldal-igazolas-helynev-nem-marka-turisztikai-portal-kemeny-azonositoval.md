## ADR-XXXX — Saját-oldal igazolás: a helynév nem márka; turisztikai portál csak kemény azonosítóval

- **Dátum:** 2026-11-28
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`: „a rossz kép rosszabb a hiányzónál … általános szabállyal”)
- **Folytatja:** ADR-0511 (photo-links: idegen oldal adatlapként)
- **Érinti:** `src/scraper/attachPhotoLinks.ts` (`ownSitePlaceRule`, `readOwnSitePhotos`), `src/countryLexicon/hr.json` (`placeNameWords`, `touristPortalPatterns`), `scripts/own-site-recheck.mts` (új)

### Mérve (2026-11-28)
A saját-oldal igazolás eddig elfogadott egy oldalt, ha a domain a lead nevének egy szavát viselte, és az oldalon ott volt a település. Földrajzi nevű leadnél ez a szó helynév, így turisztikai oldalak mentek át a lead saját honlapjaként:
- „Insel Brac” ↔ bracinfo.com/de/sutivan, 17 kép;
- „Villa Lapis Hvar” ↔ hvar.com/hvar-beaches/dubovica.

Élesen a 249 HR own_site profilból az új szabály 7-et vesz le, mind turisztikai vagy úti-portál oldalt. **A mai pótlásból (2026-11-28) egyet sem.**

### Döntés
1. **Kemény azonosító kell** (a lead telefonja, vagy az utcája és házszáma az oldalon):
   - ha az oldal turisztikai vagy úti-portál alakú (lexikon `touristPortalPatterns`, host + útvonal: `…info.<tld>`, `insel-`, `/destinations/`, `-tours.`, `visit`, `travel` …);
   - vagy ha a lead minden márkaszava helynév (lexikon `placeNameWords`: szigetek, régiók, országnevek, ill. a lead saját településének szavai), és a domain nem a lead TELJES nevét viseli.
   A villamorepucisca.se a „Villa More Pucisca” sajátja marad.
2. **A domain-egyezésben a helynév nem számít márkaszónak.** Csak a teljes név vagy egy nem-hely márkaszó igazol.
3. **A tárolt honlap továbbra is önmagában igazol.**
4. **Levétel kódúton: `scripts/own-site-recheck.mts`.** Alapból szárazon fut, `--go`-val vesz le, mentéssel.
   - CSAK azt veszi le, amire ez a szabály vonatkozik, és ami ma kemény azonosító nélkül bukik.
   - A szabály alá nem eső profil marad, akkor is, ha az oldal ma másképp olvasható (a `villa-romeo-julia.de` példa).
   - Olvasási hibánál marad.
   - A leadnél tárolt honlaphoz nem nyúl.
   - Mentés: a lead előző `portalProfiles` + `material` adata JSONL-ben.

### Igazolás
A HR own_site profilokon (élesen olvasva, helyben ítélve) a levétel 7 lead:
- **Valóban téves, 6:** hvar.com/destinacije, bracinfo.com (3 lead), ubytovanivchorvatsku.cz/gradac-podaca, makarska-riviera.hr;
- **Közvetítő listaoldal, kép nélkül, 1:** traveleto.com.

**Valódi saját oldal nem esett ki:** korcula-riva1.com, villagreenescapeistria.com, villamorepucisca.se, smith-getaways.com.

A kemény azonosítóval igazolt 3 profil marad.

### Visszafordíthatóság
🔄 A mentés-JSONL `before` mezői visszaírhatók. A lexikon két kulcsa üres listával kikapcsolja a szabályt.
