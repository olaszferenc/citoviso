# 2026-11-22 — Nemzetközi A: a lead-gyűjtés országfüggő (repó + lánc-másolat)

**Session:** SUB cit0b8e32e8 (koordinátor cit9b4690e3). **ADR:** ADR-0467.

## Elvégzett munka
- Országszótár: `src/countryLexicon.ts` + `src/countryLexicon/{hu,hr}.json` (HU-listák szó szerint a kódból, HR horvát adat).
- Telefon: `src/text/phoneCountry.ts` új segédek; `+385 (0)91…` alak; `HU_PHONE_TEXT_PATTERN` a `phone.ts`-ben.
- Repó gyűjtő kód: scout-kulcsszó és csempe-szélesség az országból, régiók ISO 3166-2 bármely országra (`terulet-<cc>-<kód>`, `country-<cc>`), `run.ts --country` élesen is, `osm.ts` név-tag, ~11 szólista-másolat → szótár, contactLedger/enrichContact/enrichWebSearch/extract/attachPhotoLinks/portalPhotos országfüggő, portál-registry `country` mező; HR portálokat a generikus olvasó viszi (apartmanija.hr, direct-croatia.com, adriatic.hr mérve: telefon + kép; e-mail csak az adriatic.hr-en).
- Őr: `scripts/country-layer-check.mts` ④ 14 gyűjtő fájllal, új BURNED-minták; új `scripts/country-collect-regress.mts` (HU-azonosság + 45 HR eset).
- Lánc: országfüggő másolat `~/rc-briefs/uj-lanc-next/` (orszag.py/orszag.mjs, regresszió `regress/run-all.sh`, átállás `atallas.sh`/`ATALLAS.md`).

## Nyitott
- Lánc-átállás: koordinátori „mehet” kell.
- `fo-terv/fo-cand.sql`: a B SUB külön változata (`fo-cand.sql.nemzetkozi`) — melyik menjen.
- HR generikus képolvasó egy YouTube-bélyegképet is felvett — szűrő bővítendő.
- `scripts/foreign-market-e2e-ingest.mts` nem-szintetikus ága 6 FAIL: a csak-magyar `normalizePhone`-t méri külföldi számon (korábbi állapot, nem kapu).
- A dev DB-ben nincs HR ország-sor (0142 nincs alkalmazva).
