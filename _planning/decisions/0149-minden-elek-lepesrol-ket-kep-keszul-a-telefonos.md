## ADR-0149 — Minden Elek-lépésről KÉT kép készül: a telefonos nézet nem maradhat mérésen kívül

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kontextus:** Elek-mérőeszköz (1. + 2. réteg)

**A probléma, mérésből.** Az Elek runner indulása óta MINDEN képet 1280 px szélességben
készített. A tulaj viszont telefonon dolgozik és telefonon nézi a rendszert. A 2026-09-14-i
teljes mátrixban (12 kör, 110 kép) **öt kiértékelő is egymástól függetlenül leírta, hogy a
telefonos nézetet nem tudta megítélni** — szó szerint: „a futásban egyetlen 390 px-es felvétel
sincs" (FK-001), „a bukás-ágak mobilon nem lettek lefényképezve" (FK-005b), „nem ítélhető: a
mobil elrendezés" (FK-007), plusz FK-005a és FK-004b. Vagyis **vakon javítottunk arra a
méretre, amit a tulaj ténylegesen használ.**

**A döntés.** Minden lépésről két felvétel készül: `shots/NN.png` (asztali, 1280 px) és
`shots/NN-mobil.png` (telefonos, 390 px), a `result.jsonl`-ben `shot` és `shot_mobile` mezőben.
A charter kimondja, hogy a kiértékelő MINDKETTŐT megnézi, és hogy a **méret-specifikus lelet
önálló lelet** (a méretet a lelet nevezze meg). Hiányzó `shot_mobile` maga is lelet.

**Miért az ÉLŐ lap átméretezése, és nem egy második futás.** A forgatókönyvek **mutálják a
világot**: az FK-004 kiküldi a megkeresést, az FK-005a fizetést vesz fel és tenantot hoz létre.
Egy 390 px-es újrajátszás **megduplázná az összes mellékhatást**. Az átméretezés ugyanazt az
alkalmazás-állapotot tartja, tehát a két kép ugyanaz a pillanat két szélességben — pontosan ez
kell ahhoz, hogy „a telefonos nézet megítélhető" legyen.

**Mit NEM bizonyít a telefonos kép — kimondva.** A böngésző asztali marad (`isMobile`/touch csak
kontextus-létrehozáskor állítható), tehát a felvétel azt mutatja, hogyan NÉZ KI a lap 390 px-en,
nem azt, hogy a folyamat **ujjal végigvihető**. Előbb mérve: a kiszolgáló sehol nem ágazik el
user-agent alapján (csak analitikára rögzíti), és a saját CSS minden töréspontja szélesség-alapú
(520–960 px) — tehát a szélesség önmagában valódi telefonos ELRENDEZÉST ad. Az operálhatóság
külön, később megszerzendő állítás; a charter tiltja, hogy a lelet ennél többet állítson.

**Az ítélet nem változik.** A `várd:` ellenőrzések továbbra is CSAK 1280 px-en futnak; a második
méret bizonyíték, nem ítélet. Mérve: az FK-003 a változás előtt és után is 11 zöld / 0 piros /
7 kézi, és mind a 36 kép a saját szélességén született (az átméretezés `finally`-ben áll vissza,
tehát a következő lépés kattintásai nem csúsznak el).

**⛔ A rejtett aszimmetria, amit menet közben javítottunk.** A „túl magas lap → csak viewport-kép"
korlát `magasság > 12 000 px` volt — ez **nem méret-semleges**: ugyanaz a tartalom 390 px-en
magasabb, tehát a korlát a keskeny körben KEVESEBB tartalomnál csapódott volna le, vagyis a
telefonos fél némán a gyengébb bizonyíték lett volna — ugyanaz a vakfolt kicsiben. A korlát ezért
a kép TERÜLETÉRE szól, pontosan akkora budgettel, amit a régi szabály asztali szélességen
engedett (1280 × 12 000). 1280 px-en a két megfogalmazás ugyanaz a predikátum, tehát az asztali
viselkedés szerkezetileg változatlan (mérve: mind a 36 kép magassága azonos maradt); a korlát-ág
működését külön önteszt igazolta (levitt korláttal mindkét méret viewport-képre esik).

**Ára, mérve.** FK-003: 18 → 36 kép, a futás 23,5 → 43,9 mp (a telefonos felvétel 20,4 mp),
a képek 9,4 MB → 13,6 MB (a telefonos rész az összes 31 %-a — egy 390 px-es felvétel nagyjából
fele akkora, mint az asztali párja). A teljes mátrixon ez ~110 → ~220 kép.

**Visszafordíthatóság:** 🔄 a második méret egyetlen hívás kivételével kikapcsolható; a `shot`
mező jelentése és neve változatlan, tehát a régi futás-mappák és a jelentés-generáló
visszafelé olvashatók.
