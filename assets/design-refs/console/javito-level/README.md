# Jóváhagyás → „Javító levél” fül — JÓVÁHAGYOTT TERV (tulaj, 2026-11-27: „ok”)

A tulaj a képek és a kattintható HTML alapján hagyta jóvá (a koordinátoron át, `cit96bd8170-a1`), a 7 új mockkal együtt.
Ez a terv a megvalósítás **kontraktusa** (CLAUDE.md §2b 5.): elvárt viselkedés, nem stílus-javaslat. Kód: `src/console/approvalQueue.ts`
`fixLetterPage`, adat és küldés: `src/outreach/fixLetter.ts`, levél: `src/outreach/fixLetterCopy.ts`. ADR: a javító levél ADR-je.

Fájlok: `terv.html` (a működő mock; a beágyazott tervek a `_drafts/…/regi`, `…/uj` fájlokra mutattak, azok lead-adatot
tartalmaznak, ezért nincsenek commitolva — a kép a mérvadó), `terv-desktop.png`, `terv-mobil-regi.png`, `terv-mobil-uj.png`.

## Mit köt a terv

1. **Saját fül** a Jóváhagyás lapon: „Javító levél” + a döntésre várók száma (figyelmeztető szín, ha van). Csak akkor látszik,
   ha van javító levél.
2. **Bal oldalt a lista**: név, település, mikor ment ki a hibás levél, hányszor nézte meg (nem bot), mi volt a hiba
   (mozdony / vasútállomás / űrfelvétel), állapot-címke (Döntésre vár · Mehet — kiküldésre vár · Kiment · Nem megy ki ·
   Küldéskor kimaradt · Készül).
3. **Fej**: név · település, lead lapja link, e-mail cím (adat-badge), kiment dátum, megnézte N× · először, „Ami rossz volt”
   sor (piros keretben), **Mehet** / **Nem mehet ki** gomb. Döntés után a gombok helyén az állapot mondata.
   Ha az új terv szövegén nincs Vera-ítélet: sárga figyelmeztetés („Mehet után is csak Vera ítélete után megy ki”).
4. **Egymás mellett**: balra „Régi — kiküldve <dátum>” (a ténylegesen kiküldött terv(ek), váltható), jobbra „Új — javított”
   (a két új terv: 1. Parallax, 2. Kapunyitás vagy Névből növő, váltható). Mindkettő a valódi mock-fájl (`/mock/<id>`).
5. **Alatta a levél betű szerint**, ahogy kimegy: feladó, címzett, tárgy, a tulaj szövege, aláírás, jogi sor + cégadatok —
   a küldés saját építőivel előállítva (nem másolt szöveg), és a küldéskori ellenőrzések felsorolása.
6. **Mehet** → a következő döntésre váró leadre ugrik (mint a meglévő lap); a levél az időzítővel, hétköznap 8–17 megy ki,
   a küldéskori őrökkel (sendOutreachMail javító levél mód). **Nem mehet ki** → lezárva, nem kap levelet.
7. **Mobil (≤760 px konténer)**: a lista felül, a két oldalt egy „Régi | Új” váltó mutatja (alapból az Új), a gombok teljes
   szélességűek. `@container`, nem `@media`.
