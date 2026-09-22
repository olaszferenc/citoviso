# 2026-09-22 — A tenant-admin SZOBA-SZERKESZTŐ megvalósítása (ADR-0198 ⑥)

**Mandátum:** `~/rc-briefs/room-editor-impl-brief.md` (a terv-szál GÉPI munkaátadása, nem
tulajdonosi felhatalmazás). **Kontraktus:** `assets/design-refs/tenant-admin/room-editor/README.md`
(tulaj 2026-09-22: „B tetszik. kártya kattintás popup és fülek elrendezés." → „ok jó így.").
**Élesítés nem volt feladat, és nem is történt.**

## Mi készült el

A jóváhagyott **D változat** leszállítva a `/admin?tab=modulok&m=rooms` képernyőn:

- **kártyarács** (mobil 2 oszlop, asztali 4): borító, `N kép`/`Részletek`/`nincs kép` jelvény, név,
  férőhely + `az egész ház`, `Van saját oldala`/`Hiányos`, és — ez a mai valódi hiba egyetlen
  látható jele — a **borító-ütközés jelvénye a RÁCSON**, a másik egység nevével;
- **felugró** `Alapok · Képek · Felszereltség` fülekkel; mobilon majdnem teljes képernyő látható
  kerettel, asztalin középre zárt párbeszéd, a rács mögötte marad; ESC és háttér-kattintás zár;
  a **Mentés rögzített lábazatban**;
- **Képek fül**: nagy borító-előnézet → `Kép feltöltése` → a **ház közös képtára** (halvány =
  nincs hozzárendelve, pipa = hozzárendel, csillag = borítóvá tesz ÉS hozzárendel);
- a **név és a férőhely bekerült a szerkesztőbe** (eddig egy szoba KÉT űrlapon élt);
- **üres felszereltségnél a katalógus rögtön nyitva**, meglévőnél kompakt csempék + csukott lista.

## A nyitva hagyott döntés, amit meghoztam

**A szobánkénti borító a FOTÓ-rekordon jelölve** (`coverFor?: string[]`, migráció nélkül, a
`carryPhoto()` viszi). Lista, nem egy id (egy kép több szoba borítója lehet); a galéria-sorrend
érintetlen, tehát a **ház nyitóképe nem mozdul**, és **másik szoba borítója sem**. Feloldás EGY
függvényben (`unitCoverPhoto`) — jelölés nélkül a MAI szabály a tartalék (első hozzárendelt kép),
tehát aki nem nyúl hozzá, azt látja, amit eddig. Indoklás: ADR-0198 ⑥.

## Amit a mérés fogott meg (a saját munkámból)

1. ⛔ **`history.replaceState` NEM értékeli újra a `:target`-et** — az ESC „lefutott", a felugró
   nyitva maradt. A horgonyt ténylegesen el kell hagyni (`location.hash`).
2. ⛔ **A kontraktus horgony-listájából NULLA elem került be**, mert a `## Kötő horgony` címet a
   §9 prózája is leírta, és az őr fejléc-mintája a KORÁBBI előfordulást fogta meg. Zölden, mert
   ami nincs beolvasva, azt nincs is mit buktatni. A regiszter kimenetéből visszaolvasva derült
   ki (40 → 54 horgony).
3. ⛔ **Az elem-capture a HÁROM felugró közül az elsőt (a rejtettet) fogta meg** a KB-képnél, és
   30 mp után elhasalt — a szelektornak a megcélzott felugrót kell neveznie.
4. ⚠️ A levétel üzenete elmaradt volna a **szokásos** úton: először csak egy „×" szándék-mezőre
   kötöttem, holott a tulaj a pipa levételével vesz le képet. Most az **állapot-különbségből**
   képződik.

## Őr + kapuk

- **`scripts/room-editor-check.mts`** — saját eldobható fixture (3 egység, 4 kép, a MÉRT
  ütközés reprodukálva), végigkattintja a felületet 390 és 1280 px-en, JS-sel és **JS nélkül**;
  ~95 állítás. A láthatóságot KIFESTETT téglalapon méri, a szöveg-levágást szöveg-szinten, a
  kontrasztot `rgb()` ÉS `color(srgb …)` alakból — **öntesztekkel**. A végén **hat negatív
  kontroll**: a visszarontott állapoton (specificitás-ütközés, `nowrap`, keret nélküli felugró,
  nem rögzített lábazat, lapot borító párbeszéd, halványítás kikapcsolva) az őrnek pirosra kell
  mennie — mind a hat pirosra ment.
- `contract-drift-check` (161 felirat / 54 horgony), `kb-check --coverage`, `i18n-lint`,
  `design-token-lint`, `tsc` — zöld. A KB-szócikk a KÓDBÓL újraírva, mindkét képe újragenerálva
  (`kb-shot.mts`: a rács `.rs-wrap` elem-capture, a második kép a NYITOTT felugró Képek füle).

## Módosított fájlok

- `src/tenant/editor.ts` — `PhotoEdit.coverFor`, `carryPhoto`, `unitCoverPhoto`,
  `setTenantUnitCover`, a levétel takarítja a jelölést, a render az új feloldót hívja
- `src/server/public.ts` — `/admin/units/content` (név+férőhely+borító+levétel-nyugta),
  `/admin/photos` (egységhez rendelés + MEGNEVEZETT hibák), a rooms-képernyő adatai, `fl`/`uz`
- `src/server/moduleConfigViews.ts` — a teljes szoba-szerkesztő + CSS + JS-rátét
- `scripts/room-editor-check.mts` (új), `scripts/kb-shot.mts`, `kb/entries/admin-modules-rooms/`
- `assets/design-refs/tenant-admin/room-editor/README.md` (§9 + §10), `_planning/DECISIONS.md`

## Nyitott

- **ADR-0192 ⑧.4** ugyanezt a felületet érinti (a `rooms` bekapcsolása eltüntetheti a fizetett
  `amenities` szekciót → SZÓLNI kell a tulajnak a Felszereltség lapon). **Külön §2b kör** —
  szándékosan nem tettem bele ebbe a munkába.
- A felugró **éles tenant-lapos** végigkattintása: a tulaj 2026-09-22-i rendelkezése szerint
  NEM időszerű, amíg a többi szál nem végez.
