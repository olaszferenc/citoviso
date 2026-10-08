# 2026-10-07 — OSM mint 0 Ft-os lead-forrás (Magellan-projekt, SUB)

**Brief:** `~/rc-briefs/magellan-osm-forras-20261007.md` (koordinátor: CIT Magellan-koordinátor).

## Mit találtam
Az `OsmSource` (`src/scraper/sources/osm.ts`) MÁR létezett, és `SCRAPE_PAID_APIS=off` mellett a `run.ts`
egyetlen forrása volt — ugyanazon az úton (dedupe → isSamePlayer store-szűrés → ingyenes dúsítás →
`persistLeadBatch`). Új tábla / migráció NEM kellett. Ami hiányzott, azt pótoltam.

## Elvégzett munka
- **Lekérdezés:** `"tourism"~regex` → egyenlőség-unió (`nwr["tourism"="hotel"]…;`) — a regex ma 504-et kapott
  az overpass-api.de-n (élőben igazolva). Típusok változatlanok (8, kemping + lakókocsi is).
- **Újrapróba:** tükör-lista (+ private.coffee), 3 kör (0 / 15 / 45 mp szünet), a `remark`-os (részleges)
  válasz bukásnak számít; udvarias UA; régiónként 1 kérés; szerver-timeout 60 s régió / 180 s ország.
- **Országos mód:** `Region.osmArea` → `area["ISO3166-1"="HU"][admin_level=2]`; `run.ts --country HU`
  egyelőre CSAK `--dry-run`-nal (országos mentéshez régió-döntés kell).
- **`run.ts --dry-run`:** csak OSM, csak számok, írás nélkül (se definition, se run, se lead, se checkpoint).
- **Provenance:** az `osm` discovery-sor `matched_entity`-je `{ref, url, license:"ODbL-1.0", attribution}`.
- **ODbL a konzolon — NEM landolt (§2b felület-kapu):** „© OpenStreetMap-közreműködők · ODbL” (link:
  osm.org/copyright) a Források mellett és a „Honnan jött az adat” panelen. Patch + képek:
  `assets/design-refs/_drafts/osm/` (`odbl-attribution.patch`, `osm-sources-mobil.png`, `osm-attr-*.png`) —
  tulaj-jóváhagyásra vár (koordinátoron át). A licenc addig a provenance-sorban él.
- **Őr:** `scrape-zero-paid-check` ⑤ — az OsmSource MINDKÉT állásban 0 fizetős hívás, 1 Overpass-kérés,
  egyenlőség-unió; a run.ts a kikapcsolt ágban is forrásnak veszi.

## Dev-számok
- `szekszard` dry-run: 71 objektum (2 mp) · 4 név nélküli · 64 egyedi · 13 a 8 km-es körön kívül ·
  0 ismert · 51 új · honlap nélkül 20 (tag szerint).
- `szekszard` éles dev-futás (`SCRAPE_PAID_APIS=off`): 51 új lead mentve, 28 kontaktálható
  (18 no_site + 10 outdated); 14 e-maillel, 14 telefonnal, 8 elérhetőség nélkül. 0 Ft.
- Ország dry-run (dev DB: 606 lead!): 8007 objektum (120 mp) · 902 név nélküli · 7008 egyedi ·
  535 ismert · 6473 új · ebből saját honlap nélkül 3934 (telefon 780, e-mail 319, bármelyik 873).

## Módosított fájlok
`src/scraper/sources/osm.ts` · `src/scraper/run.ts` · `src/scraper/types.ts` · `src/scraper/persist.ts` ·
`scripts/scrape-zero-paid-check.mts`

## Nyitott kérdések (koordinátornak)
1. Országos MENTÉS: melyik régióra kerüljenek a leadek (régió-sor „Magyarország”, vagy megyénkénti régiók)?
2. Elérhetőség: a honlap nélküli új OSM-leadek ~78%-ának nincs se telefonja, se e-mailje — Neónak
   kontakt-keresés kell (Q5: Neónál leadenként), vagy Magellan dúsítja.
3. ODbL a vevő-oldali mockon: egyedi rekord-tények → nem „lényeges rész”; jogi megerősítés kell-e.

---

## 2. kör (2026-10-07/08) — brief: `~/rc-briefs/magellan-osm-forras-20261007-2.md`

### ODbL-felirat a konzolon — KÉSZ, landolva (`8fad0093`)
A Források alatt (`.con-src-lic`, az oszlopon belül tördelve) és a provenance-panelen; 390 + desktop ellenőrizve.

### Megyei régiók
- 20 régió-sor a dev DB-ben: `megye-<kód>` (Budapest = `megye-bu`), label = OSM-név, bbox = OSM bounds (csak befoglaló).
- `regions.ts` `osmAreaForRegion`: a `megye-xx` id → `area["ISO3166-2"="HU-XX"]` → az OSM-forrás a MEGYEHATÁRRA kérdez.
- ⚠️ **Hiba, javítva (`cb604ffe`):** határ-lekérdezésnél a tükör HTTP 200-zal ÜRES választ adott (remark nélkül) →
  Baranya „0 szállás”, egy perccel később 412. Most az üres határ-válasz bukás → következő tükör. Őr: `scrape-zero-paid-check` ⑤.

### Országos mentés megyénként (dev DB, `SCRAPE_PAID_APIS=off`, 0 Ft) — 19+1 megye, mind exit 0, ~7,5 óra
| Megye | OSM-objektum | már lead | új mentve | honlap nélkül | ebből tel. | ebből e-mail | semmi kontakt |
|---|---|---|---|---|---|---|---|
| Baranya | 420 | 0 | 394 | 240 | 43 | 18 | 190 |
| Borsod-Abaúj-Zemplén | 653 | 0 | 600 | 374 | 99 | 39 | 263 |
| Budapest | 532 | 0 | 509 | 158 | 20 | 8 | 136 |
| Bács-Kiskun | 255 | 0 | 234 | 127 | 26 | 17 | 93 |
| Békés | 308 | 0 | 246 | 143 | 16 | 7 | 126 |
| Csongrád-Csanád | 247 | 0 | 218 | 115 | 18 | 6 | 96 |
| Fejér | 260 | 1 | 200 | 108 | 23 | 10 | 84 |
| Győr-Moson-Sopron | 445 | 0 | 386 | 180 | 26 | 9 | 154 |
| Hajdú-Bihar | 285 | 0 | 256 | 150 | 24 | 8 | 125 |
| Heves | 558 | 1 | 489 | 245 | 77 | 31 | 155 |
| Jász-Nagykun-Szolnok | 204 | 0 | 172 | 113 | 23 | 12 | 84 |
| Komárom-Esztergom | 225 | 0 | 184 | 108 | 15 | 6 | 92 |
| Nógrád | 275 | 0 | 256 | 135 | 37 | 17 | 90 |
| Pest | 567 | 0 | 501 | 237 | 42 | 22 | 188 |
| Somogy | (578 szereplő, checkpointból) | 269 | 287 | 169 | 29 | 13 | 137 |
| Szabolcs-Szatmár-Bereg | 262 | 0 | 146 | 81 | 12 | 2 | 69 |
| Tolna | 172 (dry-run) | 51 | 95 | 47 | 11 | 4 | 34 |
| Vas | 400 | 0 | 352 | 182 | 27 | 11 | 152 |
| Veszprém | 860 | 229 | 553 | 312 | 81 | 23 | 229 |
| Zala | 413 | 37 | 343 | 185 | 49 | 18 | 131 |
| **Ország** | **7341 (+Somogy)** | **588** | **6421** | **3409** | **698** | **281** | **2628** |

- „már lead” = a napló `Store-dedup` sora; a határ menti átfedés a sorrendben KORÁBBI megyénél számít.
- „honlap nélkül” = `qualification = no_site` (az elavult honlapúak nincsenek benne). A honlap nélküliek **77%-a (2628/3409) kontakt nélküli**.

### Elérhetőség — mérés (Tolna)
A $0-s dúsítás (saját honlap, OSM-tagek, portál-olvasó) után a honlap nélküli 47 új leadből kontaktálható 13 → 13 (+0);
az elavult honlapú 10-ből 9 → 9. A saját honlapról 2 e-mail jött, de mindkettőnek már volt telefonja; a portál-olvasó
9 adatlapot talált, kontaktot nem adott. **Következtetés:** kontakthoz Neo/Magellan kell (a Térkép-adatlapon általában van telefon).

### Módosított fájlok (2. kör)
`src/scraper/sources/osm.ts` · `src/scraper/regions.ts` · `src/scraper/types.ts` · `scripts/scrape-zero-paid-check.mts` ·
konzol (ODbL, `8fad0093`)
