# 2026-09-28 — A szomszéd elérhetőségére nem megy mock: közös-elérhetőség kapu + szigorított Places-párosítás (ADR-0258)

## Kiváltó
A tulaj: „ha a scrape-ben van területi átfedés, kezeljük a duplikátumokat?” → „mitől lesz biztos duplikátum a
duplikátum? … annál rosszabb szinte nincs, mint hogy egy mockot a rossz elérhetőség miatt a szomszéd konkurenciának
küldjünk el” → mérés → „Rád bízom”.

## Mi történt
- Mérés (dev DB): az átfedés-dedup (ADR-0039) rendben van (csak eldob). A valódi rés a Places-párosítás: szakszóra
  („apartman”) is illesztett, és a közepes sáv telefonja/honlapja ellenőrzés nélkül a leadre került → 8 szomszéd-pár
  idegen elérhetőséggel; közvetítői címek (booked.net support 3 leaden, iroda-gmail 10-en); 20 régi pontos duplikátum.
- ① Küldési kapu: `src/outreach/sharedContactGate.ts`, bekötve a levél-útba és a mobil-útba (egy függvény). Csak
  „azonos tulaj” ítélet old fel; „független” nem. Dev-állományon: 101 lead e-mailen, 110 telefonon áll meg (mind a 8
  gyanús szomszéd benne; sok a tulaj teszt-címe és a már összevont régi párok).
- ② Places: névszűrő márka-szóra (`src/scraper/genericWords.ts`, a portál-illesztő listája kiemelve), elérhetőség
  csak magas sávból, közepesnél elutasított naplósor + `raw.placesMatch` bizonyíték. Tiszta függvényekre bontva
  (`pickPlacesCandidate`, `applyPlacesMatch`).
- ③ 20 régi pár összevonva `ruleOnPair`-rel (dev DB; kizárás, nem törlés).
- Súgó: `kb/entries/console-outreach-draft/entry.hu.md` — a piros sor új oka és a feloldás útja.
- Őrök (pre-commit): `shared-contact-gate-check` (16 állítás, valódi DB, eldobható fixture) és `places-match-check`
  (12 állítás, tiszta); mindkettő negatív kontrollal igazolva (a bekötés kivétele / a régi szűrő → piros).
  Lefuttatva a fájljaim által tüzelt meglévő kapuk: oneshot, suppression, verdict-gate, pair-repair, market-gate,
  outreach-sendability, mock-photo-gate, places-outage, scrape-coverage, kb-check — mind zöld.

## Módosított fájlok
- `src/outreach/sharedContactGate.ts` (új), `src/outreach/sendBatch.ts`, `src/outreach/sendOutreachSms.ts`
- `src/scraper/genericWords.ts` (új), `src/scraper/sources/portalListing.ts`, `src/scraper/sources/googleMaps.ts`,
  `src/scraper/enrichPlaces.ts`, `src/scraper/contactLedger.ts` (`phoneKey` export), `src/scraper/types.ts`
- `scripts/shared-contact-gate-check.mts` (új), `scripts/places-match-check.mts` (új), `hooks/pre-commit`
- `kb/entries/console-outreach-draft/entry.hu.md`, ADR-0258, ez a jegyzet, `MEMORY.md`

## Nyitott
- ~115 meglévő közepes sávú lead elérhetősége a régi szabállyal került rájuk; ahol a szomszéd nem leadünk, a kapu
  nem fogja. Visszamenőleges rendezés = Places újrakérdezés (~115 hívás) — tulaj-döntés.
- Élesi állomány nincs mérve (olvasás szabad lenne) — a kapu a deploy után ott is ugyanígy fog.
- Négy régi szakszó-lista másolat maradt; összevonás külön feladat.

## Folytatás (2026-09-29) — helyesbítés: a közepes sáv nagyrészt JÓ párosítás volt
- A visszamenőleges száraz futás 70 jó telefont vett volna le → a „közepes = semmi” túl szigorú; a Jaccard a szakszót
  eltérésnek számolta. Új pontozás: márka-arány (angol szakszavak + a lead települése kiesik), Places-típus (nem
  szállás → max közepes), távolság (≤100 m, kemping ≤250 m); a mock-generálás is ezt használja.
- Kalibrálva 115 kézzel címkézett páron (fixture): jó→magas 72/85, rossz→magas 0/8, bizonytalan→magas 5/22; őr ⑨
  mindkét irányban + negatív kontroll.
- `scripts/places-medium-backfill.mts`: száraz futás 78 megerősítve, 21 telefon + 20 honlap le (mind a rossz párok
  köztük). ✅ 2026-09-29 LEFUTOTT a dev DB-n a tulaj jóváhagyásával: 105 lead kapott `placesMatch` bizonyítékot, 21-ről
  lekerült a telefon (elutasított naplósorként megmaradt). Mentés: `~/backups/places-medium-backfill-2026-09-29.json`
  (az eredeti `raw` soronként — visszaállításhoz). A küldési kapu ezután: 81 lead e-mailen, 72 telefonon állna meg
  (előtte 101 / 110). Éles állomány: a deploy után ugyanez a szkript kell (előbb száraz futás).
- Tanulság: a javítás HASZNÁT a bevezetés előtt kellett volna mérni — a „8 szomszéd-pár” állításom egy része téves volt
  (Anita = azonos család).
