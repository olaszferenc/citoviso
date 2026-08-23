# 2026-08-23 — Partner-UI teljes kör + konzol-átépítés MineREAL-mintára

## Elvégzett munka (minden landolva, origin/main=700a95e)
1. **PARTNER-UI-SPEC mind az 5 szelete**: /partners lista + /partner/:id lap (fülek:
   Áttekintés · Előzmények/Aktivitás [9-forrású összefésült idővonal — a kérés lényege] ·
   Előfizetés [csak vevőnél] · Bizonylatok [korosítás+szokás SZÁMÍTVA] · Kontaktok).
2. **Globális bizonylat-réteg**: /documents (EGY tábla), /documents/new (rögzítés
   számlakép-csatolással, base64 a megosztott sites/_documents/ tárba), /partners/new
   (kézi partner, adószám-UNIQUE barátságos hibával), entitás-bootstrap configból.
3. **ADR-0064 rendeletek végrehajtva**: modul-hub kezdőlap + karcsú felső sáv;
   bizonylat-TÍPUS katalógus (irány a felületről kivezetve); oszlop-szűrős kereső;
   mineral partner-fejléc sáv + KPI-csík + havi bontás SVG-diagram; teljes konzol-skin
   a magban átállítva (navy fülecske-fejléc KI, lágy badge-ek, pill-gombok).
4. **Őr**: scripts/partner-ui-check.mts (pre-commitban, PIROSRA igazolt öntesztekkel:
   korosítás-határok 30/31..90/91 + konzerváció, szokás-előjel, CSV-alak, fül-KATTINTÁS
   böngészőben 390px-en, szerep-fülek, űrlap-hibautak, oszlop-szűrő szerkezet).
5. **KB**: 5 operátor-entry; kb-check corpus kiterjesztve (a partner-nézetek + a
   típus-címkék adatfájlja).
6. Élő E2E a fő fa konzolján (belépés, szűrés, partner+bizonylat rögzítés PDF-fel,
   Számlakép-roundtrip, takarítás) — 390px, valódi kattintás.

## Élesítés
Deploy-kísérlet 700a95e-re: a GATE 1b MEGFOGTA — az éles .env-ből hiányzik a
LEGAL_ENTITY_* (5 kulcs), enélkül az Impresszum/ÁSZF [KITÖLTENDŐ]-vel menne ki.
A lokál .env-ben TESZT-értékek vannak — a valós jogi adat a tulajtól kell.
7 új migráció menne ki (0029–0035, mind A-státuszú = tiszta előre-út).

## Csapdák (memóriába is)
- A worktree-portőr hook FALS-POZITÍVOT ad, ha egy összetett parancs tartalmazza a
  tsx-futtatót ÉS a konzol-szerver forrás-útvonalát együtt (pl. tételes git add + kapu
  egy sorban, vagy ha maga a szöveg említi a mintát) → a lépéseket külön parancsba kell
  bontani.
- kb-check label-drift kapu HELYESEN fogta meg kétszer a felirat-átnevezést — az entry a
  felülettel EGY commitban frissítendő.
- Dev-DB-ben TESZT-jelölt seed él (seed-partner-demo, --clean töröl) + parttest
  teszt-operátor.

## Nyitott / következő
- LEGAL_ENTITY_* valós értékek az éles .env-be → deploy 700a95e (engedély kimondva).
- Bizonylat-SZERKESZTŐ kettéosztott nézettel (űrlap + számlakép-előnézet) — mineral minta.
- „AI import": számlakép → mező-előtöltés.
- Hub Bank/Ticketing moduljai (mock-hub távlat).
