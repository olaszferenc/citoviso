# 2026-10-04 — Fotó-darabszám: a fül-mondat és a lead-fejléc a valós képszámot mondja; portál-hálózati duplikátum

**Kiváltó (tulaj, brief):** „a leaden a fotóknál nem annyi fotó jelenik meg mint amennyi ki van írva” — élesen The Boys apartman: „129 összegyűjtött kép”, a Fotók fülön 21.

## Mérés (éles, csak olvasás)
- A 129 = `material.totalImages`: **118 portál (2×59 UGYANAZ a kép** — the-boys-apartman.hotels-in-hungary.net és .lake-balaton.com, azonos `/data/Photos/OriginalPhoto/…` útvonal) + 10 Places (a felfedezés csak SZÁMOLTA, sosem kértük le) + 1 Street View.
- A rács: duplikáció-szűrés → 24-es plafon → halott link kiejtve → 21.
- Hálózati duplikátum élesen: **9 lead, 145 pár**; minden azonos-útvonalú, más-hostú pár valódi duplikátum volt (www/nem-www, hotels-in-hungary = lake-balaton, csodalatosbalaton = csodalatosmagyarorszag).

## Elvégzett (két commit, mindkettő IGAZOLTAN FENT; felület-kapu: tulaj kivétele mindkettőnél)
1. **Fotók fül-mondata** (terv ③: „mi van a megnyitott fülön”): a kirajzolt rácsból számol — „{n} kép ezen a fülön — {p} a portál-adatlapról, {q} a Google Places-ből. Ebből {m} van a legutóbbi mockban.”; betöltés alatt „Képek betöltése…”.
2. **Host-független portál-kép azonosság** (`src/scraper/portalPhotos.ts`: útvonal, host és query nélkül; <8 karakteres útvonalnál marad a host) — bekötve: `enrichMaterial` (gyűjtési számláló), `portalPhotosOf` + futás-napló (`enrichPortal`), a mock galériája (`collectPortalPhotos`), a lead-fejléc (`imageBreakdown`: a tárolt profilokból számol, az összeget a duplikátum-többlettel korrigálja → a régi leadeken is 129 → 70, újragyűjtés nélkül).
3. **„N kép nem került a mockba”** — a régi szöveg a fotó-kapunak tulajdonította és a Fotók fülre küldött (ahol a kiejtett képek NEM látszanak). Most csak a leadre fennálló szerkezeti okokat sorolja: honlap-kép nem megy mockba · Street View csak kép nélküli leadnél · Places csak lekérés után ≤6 · a mock ≤24 képet visz · halott link kimarad.

## Módosított fájlok
`src/console/views.ts`, `src/i18n/catalog.json`, `src/scraper/portalPhotos.ts` (új), `src/scraper/enrichMaterial.ts`, `src/scraper/enrichPortal.ts`, `src/generator/generate.ts`

## Nyitott
- A 9 érintett lead TÁROLT `material.totalImages/portalPhotos` értéke még a duplázott: a konzol-fejléc korrigálja, de a lista-szűrők és a `materialScore` sorrend a tárolt számot látják → deploy után egy backfill (javaslat, nem kérték még).
- Kézi nyitókép-pin a MÁSODIK portál-másolatra (ha volt) elveszhet — legfeljebb a 9 leadnél.
- Élesre csak a nagy deployjal.
