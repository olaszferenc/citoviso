# KONTRAKTUS — az egész ház, egyszerűsítve

**Jóváhagyta:** a tulaj, 2026-10-15 (§2b; a tulaj szava: „csináld és mehet élesre”). Előzmény: a
háromállású „Az egész szállás egyben” kártya és a „melyik szoba” választó — a tulaj: „Olyan szinten túl
van bonyolítva”, és: „egy szobát és az egész házat hogy tudná már egyben foglalni” (a vendég VAGY egy
szobát, VAGY az egész házat foglalja; ez magától értetődő, nem kérdés).
**ADR:** ADR-XXXX · **Felülírja:** a `whole-property-choice` kártyáját, a `whole-property-second-question`
második kérdését, a `tenant-site/whole-only` admin-részét (5–6. pont) ·
**Terv:** `plan.html` (önhordó, kattintható, Mobil 390 / Asztali váltó) · **Képek:** `shots/terv-*.png`
(a terv), `shots/kesz-*.png` (a kész felület, az őr fixtúráján) ·
**Hatókör:** `src/server/moduleConfigViews.ts` · `src/server/public.ts` · `src/tenant/units.ts` · `src/tenant/bookingSetup.ts` · `src/server/bookingSetupViews.ts` ·
**Őr:** `scripts/whole-property-choice-check.mts` (újraírva erre a kontraktusra).

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.**

## KÖT

1. **Az egész ház külön tétel, sosem az egyik szoba.** Nincs „melyik szoba” választó. Két vagy több szobánál
   a háznak MINDIG van egysége (ha nincs, a rendszer létrehozza, ár nélkül → a vendég árajánlatot kér).
2. **A vendég egy szobát VAGY az egész házat foglalja** — ez az alapállapot, nem választás. Ha a házat
   foglalják, minden szoba betelik arra az időre; ha egy szobát, a ház nem foglalható arra az időre.
3. **A Szobák lapon a rács fölött a ház kártyája:** cím **„Az egész ház”**, a szobák száma és férőhelye,
   „Képek, leírás” link a ház szerkesztőjére, és a ház **alapára** ugyanitt (**„Ár mentése”**; hibás ár →
   kimondott hiba, üres → törölve). A ház NEM kártya a rácson.
4. **Egyetlen választás: egy pipa** — **„Csak egyben adom ki”** („…akkor csak az egész ház foglalható”).
   JS-sel magától ment, JS nélkül „Mentés” gomb. Bepipálva a szobák csak bemutatásra látszanak (ADR-0257).
5. **A 2. szoba felvételekor** csak akkor van kérdés, ha az eddigi egyetlen egység a tulaj által ÁTNEVEZETT
   „egész hely”: két kötelező válasz — „az egész ház” (marad a ház) / „az első szobám” (szoba lesz, a ház
   külön jön létre). Az alapnevű egység a ház, nincs kérdés. Válasz nélkül a szerver semmit nem ír.
6. **Több szobánál a ház nem törölhető** („Az egész ház nem törölhető, amíg több szobája van.”); egy
   szobánál igen.
7. **A foglalás-beállító varázsló** is két választ ad: „Egyben, egy egységként” / **„Szobánként”** (a ház
   is foglalható). A régi „csak szobánként” válasz megszűnt.
8. **A régi adat magától rendbe jön** (`settleHouse`, minden `ensureUnits`-nál): a régi választóval szobára
   tett jelölés, a rejtett („nem adom ki egyben”) ház, a ház nélküli két szoba.

## Eltérés a tervtől (szándékos)

- A tervben a pipa alatt „Ezt foglalhatja a vendég” doboz állt: az a TERV magyarázata volt, a termékben nincs.
- A tervben az ár mezője üresen indult; a termékben a meglévő alapár áll benne. Ha a háznak időszakos ára is
  van, egy link visz az Árak lapra.
