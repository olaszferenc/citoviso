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
