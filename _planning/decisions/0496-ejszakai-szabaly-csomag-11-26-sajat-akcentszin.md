## ADR-0496 — Éjszakai szabály-csomag (11-26): saját akcentszín, ismétlés-tilalom, üres sáv, településkép-galéria, dátumbélyeg, egy fotó két vágatban

- **Dátum:** 2026-11-26 (éjjel)
- **Státusz:** elfogadva (ADR-0495 ③–④ első köre: a tulaj és a mintavételes kolléga jelzéseiből EGY csomag, vak mérés, egy élesítés)
- **Forrás:** tulaj (jóváhagyó lap, 21:50: „szinte minden parallax default színkombináció”, „mind ugyanaz”, a MINTA-szakaszos üres oldal, a Monos háromszoros mondata); minőségi kolléga (minta): településkép a galéria élén (cb01b75a, af99667a), dátumbélyeg sávképen (9f61717a), azonos fotó sáv + galéria (f8412d4e)
- **Érinti:** `src/media/photoAccent.ts` (új), `src/generator/generateEngine.ts`, `src/generator/mockRefresh.ts`, `src/engine/render.ts`, `src/engine/moduleSections.ts`, `src/engine/samePicture.ts`, `src/media/photoText.ts`, `src/text/textOverlap.ts` (új), `src/outreach/mockRenderGate.ts` (v14), `src/outreach/mockPhotoGate.ts` (qafix7)

### Szabályok (mind általános, egyik sem leadre szól)
1. **Saját akcentszín minden mockon (§B.6):** a szállás fotóiból helyben, `sharp`-pal mintázott domináns élénk szín (API nélkül), a skin kontraszt-sínjeibe harmonizálva (`harmonizeAccent`). Generáláskor és a frissítő körben is; ha a fotókban nincs szín, marad a skin akcentje. Mérve: a 734 aktuális mock egyikén sem volt saját szín (a sablon-recept út nem adott), 3 fix kinézet forgott.
2. **Ugyanaz a mondat nem állhat kétszer a lapon:** renderkor, lap-sorrendben (H1 → bevezető első mondata → „Nálunk” cím → sávfelirat → galéria-cím → kiemelések) a későbbi, ismétlő sor kiesik. Mérő: `textOverlap` (tulajdonnevek nélkül, tövek, prefix-egyezés; ≥50 % vagy 4 szavas közös futam). A render-kapu ugyanezt méri a látható címeken/feliratokon (`repeat`).
3. **Üres sáv (§B 6c):** a render-kapu a telefonos lapon a leghosszabb tinta nélküli függőleges szakaszt méri; 260 px felett `gap`-bukás.
4. **Csonka minta-szekció:** külön „Amit kínálunk” minta-blokk csak ≥4 tétellel áll, ha a lap kiemelései már mutatnak felszereltséget (ADR-0486: a natív rács a modul felülete); 1–3 kártyás szekció nincs. Az ártábla-minta marad (ADR-0061/0166/0239).
5. **Településképes galéria címe semleges** („Galéria”), ha a szállásnak nincs saját fotója a lapon — a szerkesztőségi „Fotók az apartmanról” cím nem állhat a település képe fölött (terv kepnelkuli-hero).
6. **Dátumbélyeg hónapnévvel** is bélyeg (`2021. aug. 13.`, `13 Aug 2021`): a képszűrő és a kapu ugyanazt a mintát olvassa; a verdikt-cache magától újraszámol.
7. **Egy portálfotó két vágatban egy kép:** a kulcs a regisztrálható domain + méretszavak nélküli út (`Big/Huge/XL/HD` is); a kapu ezzel is csoportosít.
8. **qafix7 + frissítő:** a várakozó állomány újrarenderelődik; a frissítő mostantól a településképes (<5 saját képes) mockokat is viszi, különben a bélyeg-emelés örökre kizárná őket.

### Igazolás
Vak minta élesítés után: `scripts/gate-blind-sample.mts --n 20 --seed <friss>`; az arány a session-jegyzetben.

### Visszafordíthatóság
🔄 — szabályonként egy feltétel; a kapu-verzió visszaállítása újraítél.
