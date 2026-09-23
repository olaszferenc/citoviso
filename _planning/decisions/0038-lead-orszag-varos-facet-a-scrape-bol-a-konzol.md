## ADR-0038 — Lead ORSZÁG + VÁROS facet a scrape-ből (a konzol földrajzi szűrője)

- **Kiváltó (tulaj, 2026-08-19):** a leadek-listán legyen ORSZÁG és VÁROS szűrő. A meglévő
  `RÉGIÓ` oszlop az operátor által rajzolt scrape-terület (`krk-50`), NEM közigazgatási hely; a
  `scraper_definition.country` fixen `"HU"` (a horvát régiók leadjei is HU-ként), a `city` mindig
  `null`. Naív rákötés ezekre → az ország-szűrő csak „HU"-t, a város-szűrő semmit mutatna.
- **Döntés:** az ország+város leadenkénti tény, a SCRAPE nyeri ki (OSM/Google Maps úgyis visszaadja):
  1. **Forrás-kinyerés:** OSM `addr:country` (ISO-2) + `addr:city|town|village|municipality`;
     Google Places `addressComponents` → `country.shortText` (ISO-2) + `locality`
     (fallback: `postal_town`→`admin_area_2/3/1`). A Places field-mask kibővítve
     (`places.addressComponents`), a `resolveOne` text-search maszkjai szintúgy.
  2. **Adatmodell:** `RawLead`/`QualifiedLead` kap `country?`+`city?` mezőt; a dedupe `firstDefined`-del
     viszi tovább. Perzisztálás a lead `raw` jsonb-be (a teljes QualifiedLead), **nincs DB-migráció** —
     a konzol a `raw`-ból olvas (mint a material/contact).
  3. **Konzol:** két új oszlop (Ország, Város) a megszokott fejléc-`colFilter` multi-select mintával;
     az üres-string vödör címkéje „ismeretlen" (a facetet még nem hordozó leadek).
- **Legacy:** a meglévő leadek `raw`-ja nem hordoz country/city-t → „ismeretlen" vödör, amíg újra nem
  scrape-elődnek. (Backfill címből/koordinátából megbízhatatlan → nem csináljuk; új scrape tölti.)
- **Normalizálás:** ország = ISO-3166-1 alpha-2 kód (mindkét forrás így ad → egy vödör HR-re/HU-ra).
- **Visszafordíthatóság:** 🔄 könnyű — additív mezők + raw-olvasás, séma érintetlen.
- **Státusz:** ELFOGADVA + IMPLEMENTÁLVA (tulaj, 2026-08-19). Érintett: `scraper/types.ts`,
  `scraper/sources/{osm,googleMaps}.ts`, `scraper/resolveOne.ts`, `scraper/dedupe.ts`,
  `console/{data,views,server}.ts`.
