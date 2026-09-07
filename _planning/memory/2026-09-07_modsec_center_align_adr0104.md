# 2026-09-07 — A mock-típusok átvizsgálása: középre rendezett fejléc alatt középre rendezett tartalom (ADR-0104)

## A kérés

A tulaj a saját, ~1900px-es böngészőablakából nézte végig a fullbleed mockot
(`/configure/ff227bb6-37ff-48bd-9e9a-f8a8e33a3ef3`, „Aquilo Hotel Panoráma"), és két dolgot
kért: „nézd át a mock típusokat. A telefonszámnak nem szabad benne lennie sehol." + „ennél a
típusnál nincs sok helyen középre rendezve, kesze kusza a cucc."

## Mérés (nem szemre)

Ideiglenes audit-harness: a tárolt `mock_artifact.inputs` (recipe + SiteData) újrarenderelve
MIND A 16 sablonnal, mock fázisban, majd Playwrighttal megmérve minden modul-szekcióra, hogy a
fejléc `text-align`-ja és a tartalmi blokkok bal/jobb rése összeér-e (1900 / 1280 / 390px).

**Eredmény:** pontosan a 3 középre rendezett fejlécű sablon érintett — **fullbleed, horizontal,
artdeco** —, és mindháromnál UGYANAZ az öt hiba (1900px):

| blokk | mérés |
|---|---|
| poi („A környéken") | 3 kártya 4 sávos rácsban → 284px fantom-oszlop jobbra |
| rooms („Szobák") | ugyanaz, 284px |
| amenities („Amit kínálunk") | 2 elemű utolsó sor → 568px üres jobbra |
| pricing fül-sor | balra pakolva → 849px üres |
| hírlevél-űrlap | teljes szélességű mező középre rendezett cím alatt; 390px-en a gomb balra csúszva |

A másik 13 sablon balra zárt fejlécű — ott a balra pakolás HELYES, a hiba a fejléc és a
tartalom közötti ellentmondás.

**Gyökér-ok:** az ADR-0057 kontraktus `--cit-modsec-head-align:center` tokenje csak a `h2`-t
húzta középre; alatta a közös modul-blokk `repeat(auto-fill,minmax(220px,1fr))` rácsa maradt.
Se típus, se meglévő őr nem láthatta: LAYOUT-tény, ami csak valódi böngészőben, valódi
szélességen létezik.

## §2b kapu

3 működő változat (A feszített / B középre zárt / C hibrid) valós adaton renderelve,
`_drafts/mock-align-fullbleed-{mai,a,b,c}.html`, ui-shot 390+1280px **és** 1900px-es
összehasonlító képek elküldve → a tulaj a **C hibridet** választotta → `surface-gate approve`
→ csak ezután kód.

## Megvalósítás

- `templateKit.centredModsecCss(tpl)` — EGY forrás; a három sablon hívja (a náluk duplikált
  note/badge szabályokat is ez váltja ki). Tartalmi kártya kitölti a sort, kis ikonos csempe
  egyforma széles + középre húzó utolsó sor, 620px alatt teljes szélesség; ár-fülek, ár-táblázat,
  hírlevél- és vélemény-űrlap a középre rendezett ritmust követi.
- **A másik 13 sablon kimenete bájtazonos maradt** (16/16 render diffelve a javítás előtt/után).
- Őr: `scripts/modsec-align-check.mts` — pre-commit (`src/engine/` változásra), DB és hálózat
  nélkül, 1900/1280/390px. Az inline jelvényt (`.cit-grat`) és a táblázatot ELEMKÉNT méri, nem a
  gyerekein át — a `tbody` mérése hamis riasztást adott (-388/1512; az elem valójában 112/112).
  RED-kontroll (`--red`): a szabályokat kivéve 26 eltolódást fog.
- ADR-0104 a `_planning/DECISIONS.md`-ben.

## A telefonszám — nem hiba volt, hanem teszt-adat

Mérve: 8 lead (mind 2026-08-21) visel `olaszferenc@gmail.com`-ot, ebből 5 a tulaj mobilját is —
ezt a **2026-09-05-i Elek-kör seed-semlegesítése** írta be (a klón-forrásból valódi IDEGEN
számok jöttek), és az MMS/SMS öntesztek `lead.raw.phone`-ból dolgoznak. Éles körben a lead saját
nyilvános száma, tenant-oldalon a tulaj által megadott szám jelenik meg. A megjelenítési helyek
(JSON-LD `telephone`, kapcsolat-blokk, `data-cit-phone` + `tel:` fallback, lábléc) mind
szándékosak. **Tulaj-döntés: nem kell szabály.**

⚠️ Tanulság: mielőtt szabályt írunk a KIMENETRE, nézzük meg, honnan jött a BEMENET — kis híján
egy helyes mechanizmust bénítottunk volna le teszt-adat miatt.

## Módosított fájlok

- `src/engine/templateKit.ts` (új: `centredModsecCss`)
- `src/engine/templates/fullbleed.ts`, `horizontal.ts`, `artdeco.ts`
- `scripts/modsec-align-check.mts` (új őr) + `hooks/pre-commit`
- `_planning/DECISIONS.md` (ADR-0104)

Landolva: `f275aad` (IGAZOLTAN FENT). Élesítés NEM történt (§0.3).

## Nyitott

- A tulaj `/configure/ff227bb6…` linkje **még a régi képet mutatja**: a route a legyártott
  statikus fájlt szolgálja ki, a motor-javítás nem propagál visszamenőleg. Vagy újragenerálás a
  konzolon, vagy determinisztikus újrarenderelés a tárolt recipe+adatból (AI-költség nélkül) —
  tulaj-döntésre vár.
- A fő fa (:4600) 2 committal le van maradva, mert egy generált `_planning/DOMAIN/_tools/.distill-manifest`
  piszkos benne, ezért a `land.sh` nem húzta be.
