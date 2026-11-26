# Árváltozás-értesítő levél — JÓVÁHAGYOTT TERV (2026-11-26)

`plan.html` a tulaj által elfogadott terv. A koordinátoron (`cit9b4690e3`) keresztül döntött, 2026-11-26-án:
- az **A** változat (táblázatos) marad;
- a lemondásra utaló mondat kikerül;
- az „Előfizetés kezelése” gomb marad;
- a szüneteltetett előfizető mondata marad.

Ez a fájl **KONTRAKTUS** az „Országok / Árazás” 5. fázisának levelére (`src/email/priceChangeNotice.ts`). A kész levelet ehhez mérjük. A fekete vezérlősáv (előfizető, ciklus, méret) és a jobb oldali kártyák nem részei a levélnek. A számok (Lidó Wellness és Bor Villa, +1 000 Ft) valós dev adatból készült minták.

Képek:
- `asztali-aktiv-havi.png`;
- `mobil-aktiv-havi.png`.

A többi kombinációt (szünetel, éves) a `plan.html` váltói mutatják.

> A kötő feliratokat (vastag, idézőjeles alak, a `contract-drift-check` ezeket keresi a kódban) a levél kódja teszi be, amikor elkészül. A befagyasztáskor még nincs kód, amiben élhetnének.

## Amit a terv KÖT

1. **Mikor megy ki:** csak **áremelésnél**, a díjváltozás **mentésének napján**. A kezdő dátum legkorábban a mentés + 30 nap. Árcsökkenésnél nincs levél, a következő terheléstől olcsóbb (ütemezett árváltozás, B döntés, 2026-11-26).
2. **Kinek:** minden előfizetőnek, akit az emelés érint (a régió előfizetői), a **szüneteltetetteknek is**. Előfizetőnként egyszer.
3. **Keret:** a platform-levelek közös kerete (`src/email/platformLayout.ts` `platformMail`: logó, cím, lábléc, belépési sor). A feladó a platform neve.
4. **Tárgy:** Változik a honlap-előfizetése díja — [oldal neve].
5. **Cím a levélben:** Változik az előfizetése díja.
6. **Bevezető mondat:** A Citoviso díjai [kezdő dátum] napjától változnak. Az Ön előfizetésére ez így vonatkozik: (a mockban „-tól” állt; a formázott dátum ponttal végződik — „2026. 12. 26.” —, ezért a kód a „napjától” alakot használja, a tartalom ugyanaz).
7. **Tábla** (`mailDetails`), sorrendben:
   - Mostani díj — [összeg] / hó vagy / év;
   - Új díj — [összeg] / hó vagy / év, kiemelve, mellette (+különbség);
   - Első terhelés az új díjjal — az előfizető saját napja: a kezdő dátum utáni első megújulás. Szüneteltetett előfizetőnél: a folytatás utáni első terhelés (legkorábban [kezdő dátum]);
   - Fizetés — havonta / évente.
8. **Szüneteltetett előfizetőnél** a tábla alatt megjegyzés (`mailNote`): Az előfizetése most szünetel. Ha folytatja, a [kezdő dátum] utáni első terheléstől az új díj érvényes.
9. **Gomb:** Előfizetés kezelése → a tenant belépési oldala.
10. **Nincs** lemondásra utaló szöveg a levélben (tulaj, 2026-11-26).
11. **Számok:** az összegek a megújítás saját számításából jönnek (`renewableModuleIds`, a régió ársora a dátumra), a pénznem az előfizetés pénzneme, minor egységből formázva (`formatMinor`), a dátum `formatDay`-jel.
12. **Nyelv:** a tenant nyelve. Minden mondat `T()` alatt, Bábel fordítja, a hiány magyar fallback (a fordítás nem blokkol).
