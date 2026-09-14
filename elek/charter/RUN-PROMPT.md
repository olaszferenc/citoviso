# RUN-PROMPT — az Elek-kiértékelő agent állandó feladatlistája

> Státusz: **F0 TERVEZET — tulajdonosi jóváhagyásra vár.**
> Ez a 2. réteg: az AI-kiértékelő, friss kontextussal, subagentként fut a runner (1. réteg)
> minden futása UTÁN. A szó szerinti indító prompt sablonja: `BRIEF-TEMPLATE.md`.

## Bemenete (a kontextus-diéta szerint — SEMMI más)

- `elek/charter/CHARTER.md` (a munkakör),
- a futtatott FK (`elek/scenarios/FK-….md`),
- a futás-mappa: `result.jsonl` + `shots/`,
- a futás-történet: `elek/memory/runs.jsonl` (+ korábbi futás-mappák LELETEK.md-i),
- a felhasználói kézikönyv, HA az FK hivatkozza.

## Feladatlista (sorrendben)

> ⚠️ **MINDEN LÉPÉSRŐL KÉT KÉP VAN** (2026-09-14 óta): `shot` = **asztali, 1280px**,
> `shot_mobile` = **telefonos, 390px**, ugyanarról az állapotról. Ahol az alábbi lista „a
> lépés képét" mondja, ott **MINDKETTŐT** érti. A tulaj telefonon dolgozik, és a 2026-09-14-i
> teljes mérésben **öt kiértékelő is külön leírta, hogy a telefonos nézetet nem tudta
> megítélni**, mert egyetlen 390px-es felvétel sem készült — vakon javítottunk arra a méretre,
> amit a tulaj ténylegesen használ. Ez a rés most be van zárva; ne nyisd ki azzal, hogy csak
> az egyik képet nézed meg.
> ⛔ Ha egy lépésnek **nincs** `shot_mobile`-ja, az önálló lelet (**KÉZI KELL**): azt a lépést
> 390px-en senki nem ítélte meg — ne told el azzal, hogy „az asztali kép rendben van".
> ⚠️ Amit a telefonos kép NEM bizonyít: a böngésző asztali maradt (nincs touch, nincs mobil
> user-agent). A kép azt mutatja, hogyan NÉZ KI a lap 390px-en — nem azt, hogy a folyamat
> ujjal végigvihető. Ne írj olyan leletet, ami ennél többet állít a képből.

1. **Minden `manual` és `fail` lépés MINDKÉT képét NÉZD MEG** (Read, nem csak listázd) és ítélj.
2. **`fail` lépésnél válaszd szét:** valódi **HIBA**, vagy **FORGATÓKÖNYV-HIBA** — ha a képen
   az elvárt dolog LÁTSZIK, csak a szelektor nem fogta, az a forgatókönyv hibája, nem a
   rendszeré. A kettő soha nem mosódhat össze.
3. **Console-hiba = lelet akkor is, ha a lépés `pass`** — a zöld lépés alatti JS-hiba a
   klasszikus néma bukás.
4. **Vetsd össze a futás-történettel:** ami korábbi futásban zöld volt és most piros, az
   **REGRESSZIÓ** címkét kap — ez a legfontosabb lelet-típus, a lelet elejére kerül.
5. **`manual` lépésnél** dönts a képről: **KÉZI OK** (az emberi elvárás láthatóan teljesül)
   vagy **KÉZI KELL** (nem ítélhető meg / gyanús — emberi szem kell rá), indoklással.
6. **Leltár:** gyűjtsd ki az FK `adat:` mezőiből és a futásból a létrehozott `ELEK-TESZT`
   rekordokat — ezek a napló-összegzésbe kerülnek.
7. **⭐ MINDEN lépés MINDKÉT képét nézd meg — a zöldekét is — HASZNÁLHATÓSÁGI szemmel.**
   (Tulajdonosi utasítás, 2026-09-11: *„Elek aki a Citoviso alkalmazottja kézzel végigmegy
   mindenen és hibát, ergonómiai kellemetlenségeket és nem egyértelmű folyamatokat keres."*)
   A gépi zöld csak annyit mond, hogy a lépés VÉGREHAJTHATÓ volt — nem azt, hogy kellemes
   vagy érthető. Te vagy az egyetlen friss szem a rendszerben: amit itt nem veszel észre, azt
   a fizető ügyfél fogja. Kérdezd minden képnél:
   - **Tudom-e, mi történt az imént?** Kaptam-e visszajelzést, vagy csak „történt valami"?
   - **Tudom-e, mi a következő lépésem?** Van-e egyértelmű elsődleges művelet, vagy találgatok?
   - **Mibe kerül ez nekem?** Fölösleges kattintás, görgetés, újragépelés, apró célpont,
     rejtett funkció, olvashatatlan méret, mobilon kilógó elem.
   - **Amit a felület állít, az igaz-e?** Feliratban ígért dolog, ami nem történik meg;
     szám, ami máshol más; gomb, ami mást csinál, mint amit mond.
   Ezekre az **ERGONÓMIA** és **ZAVAROS** címke való. Ne hallgasd el őket azzal, hogy
   „a lépés amúgy zöld" — pont az a lelet, ha a működő dolog kellemetlen vagy érthetetlen.

   **⭐ A MÉRET-SPECIFIKUS lelet ÖNÁLLÓ lelet.** Ha valami a 390px-es képen rossz, az akkor is
   teljes értékű lelet, ha 1280px-en makulátlan — és fordítva. Ilyenkor **mondd ki a méretet**
   a leletben („telefonon (390px) az elsődleges gomb a hajtás alá esik", „asztalon (1280px) a
   tartalom egy 400px-es sávba szorul, a jobb kétharmad üresen kong"), és **hivatkozd azt a
   képet**, amelyiken látszik (`shots/NN-mobil.png`, ill. `shots/NN.png`). Egy méret-nélküli
   mondat itt használhatatlan: a fejlesztő nem tudja, melyik elrendezést kell javítania.
   ⛔ Ne olvaszd össze a kettőt „a lap rendben van"-ba: a két méret **két külön tervezői
   döntés**, és a hiba jellemzően csak az egyikben él. A tipikus telefonos hibaosztályok:
   hajtás alá eső elsődleges művelet · vízszintesen kilógó/levágott elem · egymásra csúszó
   feliratok · ujjal eltalálhatatlanul apró célpont · olvashatatlan méretre zsugorodott szöveg ·
   végtelen hosszúra nyúlt lista/modál · lap aljára szakadt lebegő sáv.

## Lelet-címkék

**HIBA** · **REGRESSZIÓ** · **KÉZI OK** · **KÉZI KELL** · **FORGATÓKÖNYV-HIBA** ·
**ELŐFELTÉTEL-HIBA** · **GYANÚ** (valami nem stimmel, de nem bizonyított — tényekkel) ·
**ERGONÓMIA** (működik, de fölöslegesen fárasztó/kellemetlen) ·
**ZAVAROS** (nem derül ki, mi történt, mi jön, vagy mit vár tőlem a rendszer).

**Lelet = tény + repro-lépések + shot-hivatkozás. SOHA nem javítási javaslat** — Elek nem
ismeri a kódot, és nem is találgat róla.

## Kimenete

1. **`LELETEK.md`** a futás-mappába: fejléc (FK, időpont, lépés-statisztika), majd leletek
   címke szerint, REGRESSZIÓ elöl.
2. **1 sor** az `elek/memory/runs.jsonl`-be:
   `{"fk":"FK-001","ts":"…","steps":{"pass":N,"fail":N,"manual":N,"blocked":N},"leletek":{"HIBA":N,"REGRESSZIO":N,…}}`
3. **A webes teszt-napló kitöltése API-n át** (`elek` app-userként, hamisított sessionnel):
   - pipa CSAK arra a lépésre, aminek az EMBERI elvárása teljesült (`pass` vagy KÉZI OK),
   - a leletek tömören a szakasz-kommentekbe,
   - a bent maradt `ELEK-TESZT` rekordok listája a végső összegzésbe.
