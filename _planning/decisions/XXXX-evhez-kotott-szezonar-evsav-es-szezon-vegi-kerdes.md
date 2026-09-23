## ADR-XXXX — Évhez kötött szezonár: évsáv visszaeséssel, szerkeszthető és rendezhető szezon, szezon végi kérdés (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrrel; nem élesítve) ·
**Kapcsolódó:** ADR-0208 ③ (a mért tényállás: a szezon `MM-DD`, év nélkül) és ⑥.5 (ez a tétel),
ADR-0215 ② (az évhez kötött ár adata és szabálya — migráció 0072), ADR-0193 ① (nem blokkolunk),
ADR-0067 (a tenant nyelvén), §B.17 · **Kontraktus:** `assets/design-refs/tenant-admin/season-year-price/`
· **Migráció:** 0073 · **Őr:** `scripts/season-year-price-check.mts`.

**Kiváltó.** A szezon ismétlődő `MM-DD`, ezért a 12 hónapos foglalási horizonton belül 2027
júliusára ugyanaz az ár fagyott be, mint idénre (ADR-0208 ③). Az ADR-0215 az ADATOT
(`valid_from`/`valid_to`) és a SZABÁLYT (`cit-season.cjs`: évhez kötött szezon → ismétlődő →
dátumos alapár → alapár) megadta; a felület, a honlap-ártábla és a nudge hiányzott.

### ① A DÖNTÉS (tulaj, két §2b kör)

- **Év-specifikus ár visszaeséssel** (a brief elfogadott iránya): „Főszezon 2027: 35 000", és ahol
  nincs megadva, marad az ismétlődő ár — semmi nem törik.
- 1. kör A / B / C → **B (évsáv)**, három kéréssel: az évek **korlátlanul** görgethetők oldalra,
  mobilon is, és **látszódjon**, hogy oldalt is vannak; a szezon **mentés után is módosítható**
  (a tulaj szava: *„logikai hiba: nem lehet mentés után egy szezont módosítani"*); és legyen
  érthető az évhatáron átnyúló időszak (*„2026.11.01. – 2027.03.01."*).
- 2. kör B·1 (kilógó kártya) / B·2 (év-vonalzó) → **B·1**.
- Kérdésre: **fel/le sorrend** kell (a feljebb álló szezon nyer átfedésnél); a mezőnevek
  **`parent_id`**, **`season_nudged_year`** jóváhagyva; az éves szezon lejáratakor **nincs**
  „Hamarosan lejár egy ár" levél.

### ② AZ ADATMODELL (0073)

- `unit_price.parent_id` (uuid → `unit_price.id`, **ON DELETE CASCADE**): az éves ár melyik
  ismétlődő szezoné. Az éves ár egy évhez kötött szezon-sor (0072), tehát a szabály **nem
  változott** — a sorrend 1. rétege eddig is ezt árazta.
- `unit_price.season_nudged_year` (smallint): melyik évi alkalomról ment ki a szezon végi kérdés.
- Az „év" az alkalom **kezdő** éve; átnyúló szezonnál a címke „2026/27", az ablak 2026-11-01 …
  2027-03-01. Ezt EGY függvény számolja (`CitSeason.occurrence` + `firstOpenYear`), és ugyanott
  él a gépelt dátum normalizálása is (`normMonthDay`: „11.01", „11. 01.", „1101", „11/1" → 11-01;
  a lehetetlen napot — 02-30 — elutasítja, ahol a régi minta a 02-31-et átengedte). Az Árazás lap
  előnézete és a szerver ugyanazt a függvényt futtatja: egy eltérő előnézet olyan napokat
  ígérne, amilyeneket a mentett szezon nem tartalmaz.

### ③ A MEGVALÓSÍTÁS

- **Árazás lap** (`moduleConfigViews.ts`): évsáv szezononként (kártyánként egy űrlap — szkript
  nélkül is működik; a szkript a végtelen görgetést, a nyilakat, a fejlécet és a `#ev-…` ugrást
  adja), **„Szerkesztés"** a sor helyén, fel/le nyíl, élő előnézet + átfedés-jelzés. A hiba az
  érintett kártyán / szerkesztőn áll, nem a hosszú lap tetején.
- **Adat-réteg** (`prices.ts`): `setSeasonYearPrice` (egy szezon × év = egy sor; üres összeg saját
  nap nélkül = törlés; lezajlott év és idegen site elutasítva), `updateSeasonPrice` (a saját nap
  nélküli éves ár a szezon új napjaira költözik, a saját napos marad), `moveSeasonPrice`.
- **Honlap-ártábla** (`publicSeasons` → `moduleSections.ts`): évet csak az éves árú szezon kap, és
  akkor a foglalható horizont minden alkalma a valódi árával; év nélküli sora nem marad.
- **Szezon végi kérdés** (`seasonNudge.ts`, óránkénti tick): a záró nap utáni reggelen (06 UTC
  után), 7 napon belül, feltételes UPDATE-es bélyeggel egyszer; nem megy, ha a következő évre már
  van ár, vagy a tenantnak nincs Árak modulja. A link a következő év kártyájára visz.
- **Lejárat** (`priceExpiry.ts`): a „lejár egy ár" levél csak `date_from IS NULL` sorra megy
  (dátumos alapár) — az éves szezonra nem, mert utána az ismétlődő ár él.

### ④ AMIT A SAJÁT MÉRÉSEM FOGOTT MEG

1. **A levél-link fókusza némán elveszett**: a böngésző a `#fragment`-re ugrást a szkript UTÁN
   végzi, és a fókuszt visszateszi a `<body>`-ra. A gépi „van-e ilyen elem" zöld volt; a
   `document.activeElement` mérése mutatta meg. Javítás: a fókusz a `load` után.
2. **Dupla pont az előnézetben** („2027. 03. 01..") — kétszer, a mockban és a valódi lapon is;
  csak a KÉP mutatta. Az őr most külön állítja, hogy nincs „..".
3. **Egy idegen orákulum megvakult volna**: a `booking-price-coherence-check` a honlap-táblát
   olvassa; az éves sort („2026. 11. 01. – 2027. 03. 01.") alapárnak nézte volna. Saját,
   független ablak-olvasót kapott (a vizsgált kódot szándékosan nem importálja).
4. Az őr két saját hibája: rejtett unit-fülön az `innerText` elveszti a cella-határokat
   (→ `textContent` cellánként), és rossz elvárt hibaszám.

### ⑤ AZ ŐR

`scripts/season-year-price-check.mts` — ~99 állítás, eldobható fixtúra, valódi DB + HTTP +
böngésző, mindkét méreten; a nudge a fixtúra site-jára szűkítve (`scope.siteId`), hogy a közös
dev-DB más tenantjait ne bélyegezze és ne levelezze. Pozitív kontrollok: a nudge egyszer
tényleg kimegy; a dátumos alapár emlékeztetője tényleg kimegy. **Piros kontrollok kézzel** (6
bukás): az év nélküli sor visszatétele a honlap-táblába, a bélyeg-feltétel kivétele, a
lejárat-levél kivételének kivétele.

### ⑥ AMI NYITVA MARAD

1. A levél tárgya névelő nélkül áll („Véget ért: Főszezon — …") a mock „Véget ért a Főszezon"
   helyett — a magyar névelő a névtől függ, fordítható sablonba nem égethető (a README kimondja).
2. Több egység azonos napon záruló szezonjai egységenként külön levelet kapnak (egy szezon =
   egy levél). Ha zajnak bizonyul, napi összesítő a következő lépés.
3. A levél nem mondja meg, „mi működött" (foglaltság a szezonban) — a brief célja („amikor épp
   látta, mi működött") ma csak az időzítésben teljesül; a foglaltsági szám külön mérés után.
4. ADR-0208 ⑥.2–⑥.4 a párhuzamos szálé (nem ez a munka).
