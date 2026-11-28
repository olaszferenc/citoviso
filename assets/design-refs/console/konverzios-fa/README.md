# Riport — Konverziós mechanizmusfa szekció (ADR-0510 felülete)

Tulajdonosi jóváhagyás: 2026-11-28 („folyamt", majd „nem kell az animáció" és „ok"). A vázlat
`konverzios-fa.html` (A/B/C egy fájlban, váltó a fejlécben; **a B · Folyam köt**, az A · Gerinc és a
C · Térkép elvetve; közvetlenül: `konverzios-fa.html#v=B`), képek: `B-asztali.png`, `B-mobil.png`.
**Ez a terv KÖT**: elvárt viselkedés, nem stílus-javaslat. A vázlat számai VALÓS éles számok
(2026-11-28), a feladatok MINTA-jelölésűek.

⛔ **Animáció NINCS** (tulaj, 11-28): se részecske-áram, se pulzálás, se felpörgő szám. Csak a működéshez
kellő rövid átmenet (panel nyitás-csukás, sávszélesség-váltás szűrésre), `prefers-reduced-motion` alatt
az sem.

**Hatókör:** `src/console/reportViews.ts` · `src/console/reportData.ts`

A megvalósításkor ide kerül még: a fa szerkezetét hordozó új modul, az aktív feladatok táblája és a
tudásbázis-entry (a Hatókör-sort a megvalósító bővíti).

## Miért létezik
A konverzió javítása addig ötletenként ment. A fa (`_planning/DOMAIN/07-CONVERSION-TREE.md`, ADR-0510)
közös modell: állapot → ok → mérés → kar. A szekció ezt mutatja a riport szűrőire számolva, és
megmutatja, melyik csomóponton ki dolgozik, mi volt az arány előtte és mi most.

## Amit a terv KÖT
1. **Helye:** a Riport → Tölcsér lap tetején, összecsukható szekció. Csukva egy sorban összegzi a tölcsért
   (`1797 kiküldve → 339 tervet nyitott → 32 ajánlathoz nyúlt → 1 próba → 0 fizetett · legnagyobb mért esés: 6→7`).
   A Tölcsér lap meglévő panelei változatlanul alatta.
2. **Szűrők:** időszak · postafiók (Mind/Gmail/Egyéb) · ország. Ugyanazt a fold-ot használják, mint a lap
   többi része (két panel sosem mondhat mást). Ha egy kombinációra nincs kiszámolt szám, azt kimondja,
   nem talál ki számot. Ország, ahová nem ment levél: üres állapot („Ebben a szűrésben nem ment ki levél").
3. **Folyam (B):** asztalon VÍZSZINTES, mobilon FÜGGŐLEGES (két külön elrendezés, `@container`).
   A sáv szélessége ∝ a továbbjutó leadek száma az 1 · Kiküldve → 9 · Fizetett állapotokon.
   - A lemorzsolódás leváló ág, rajta a veszteség (−N, esés %). Az ágra (vagy az alatta lévő esés-chipre)
     kattintva nyílik az átmenet panelje: okok (igazolt/feltevés), mérés-chip (mérve/részben/vakfolt), karok,
     a karon az aktív feladat.
   - **1 → 5 egy közös ág**, rajta a 2 · 3 · 4 jelölő: itt vész el a lead, de nem tudjuk, melyik lépésben.
     A 4 · Levelet nyitott külön, „részben" jelöléssel áll (követett levelekből, „11-23 óta mérve; a Gmailen
     kívül alulszámol").
   - A **vakfolt** (0, 2, 3, 10) csíkozott „lyuk", SOHA nem nulla. A 0 és a 10 a jelmagyarázatban.
4. **Oldalkijárat** külön panel: Válaszolt · Leiratkozott · Visszatért másik napon, számmal és aránnyal.
5. **Nézet-váltó Fa / Feladatok:** a Feladatok nézet asztalon tábla, mobilon kártya (csomópont · kar · ki ·
   mióta · szülő-arány előtte · most). Egy kattintással a fában a csomópontra ugrik.
   ⛔ Az „után" csak akkor mutat számot, ha a kar indulása után eltelt annyi idő, hogy legyen mért kohorsz;
   addig „fut, még nincs" — a fa élő aránya nem tűnhet a kar hatásának.
6. **Mérési napló:** összecsukható; a heti trend (pl. tervnyitás / kiküldés hetente) a fold-ból élőben
   számolódik, nem kézi bejegyzés.

## Adat-definíciók
- Állapotok és mérés-forrásuk: `07-CONVERSION-TREE.md` §B; a már meglévő definíciók (kiküldve, megnyitva,
  próba, rendelés, fizetés, levélnyitás) a `reportData.ts` fejlécéé — újra nem definiáljuk.
- Új számok: **6 · Végignézte** = egy látogatásban `scroll` ≥ 50 %; **7 · Ajánlathoz nyúlt** = `mock_event`
  `trial_open` · `plan_view_click` · `pkg_open` · `panel_open` · `checkout_step` bármelyike;
  **visszatérő** = ≥2 különböző napon látogatás a küldés után; levélnyitás postafiók szerint (Gmail / egyéb).
- Okok és karok szövege: a `07-CONVERSION-TREE.md` §C a forrás. Egy helyen éljen (kódmodul), és egy őr
  ellenőrizze, hogy a doksi és a modul nem tér el.
- Aktív feladat: DB-tábla (csomópont, kar, gazda, kezdet, szülő-arány előtte, állapot), szkripttel írható
  (a koordinátor írja), a konzol olvassa — deploy nélkül változik.
