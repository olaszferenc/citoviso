## ADR-0187 — A kurátor kiküldési szándékát a gépi lelet NEM gátolhatja meg — és a képernyő nem nevezhet meg rossz kaput (2026-09-19)

**Dátum:** 2026-09-19 · **Státusz:** ELFOGADVA (tulajdonosi rendelet, szó szerint: *„Megtiltom,
hogy a kurátor kiküldeni szándékát bármi meggátolja”*) · **Visszafordíthatóság:** 🔄
**Kapcsolódó:** ADR-0126 (őr-verdikt kapu), ADR-0134/0150 (kép-egészség kapu), ADR-0129 (a kapu a
kiküldést őrizze, ne a fizető vevőt), Elek FK-004 Z1/Z2 (a lap a küldő-út verdiktjét mondja).

**A bejelentés.** A tulaj a piszkozat-lapon ezt látta egyszerre, egy képernyőn:
`E-mail: most NEM küldhető — a jogszerűségi kapu tiltja (az okok lent)` — és közvetlenül
alatta `Jogszerűségi kapu: PASS`. **Három hazugság egy sorban:** (1) nem a jogszerűségi kapu
szólt (az PASS-olt), hanem a dizájn-őr tárolt lelete; (2) „az okok” NEM voltak lent — a §C-nek
nem volt mondanivalója, tehát üres lista; (3) **nem is tiltás volt**: a küldés gomb felugrója
megkérdezi, és a megerősítés kiküldi. A kurátor egy hamis tiltást olvasott egy ártatlan kapu
nevével, ezért meg sem nyomta a gombot, ami küldött volna.

**Miért volt eddig ZÖLD minden mérés.** Az `outreach-sendability-check` azt mérte, hogy a lap
állítása egyezik-e a küldő-út verdiktjével. Egyezett: a küldő-út tényleg nem küldött EGY
kattintásra. **Egy tiltás és egy kérdés azonban nem ugyanaz az állítás** — az őrnek két
állapota volt (mehet / nem mehet) ott, ahol háromnak kell lennie.

**A döntés.**
1. A `flagged` kimenet **megnevezi a kaput** (`gate: "legal" | "photo" | "verdict"`) és azt,
   hogy **a kurátor vállalhatja-e** (`confirmable`). A képernyő nem következtet, hanem idéz.
2. A sávnak **három** állapota van: zöld („megy egy kattintásra”), **sárga** („kiküldhető — a
   küldés gomb megmutatja a leletet, és a megerősítéssel kimegy”) és piros („tényleg nem megy,
   ezért:”). Ami egy második kattintással kimegy, arra a lap nem mondhatja, hogy nem küldhető.
3. A **kép-egészség lelete** (törött kép / nulla fotó) is a **küldés gomb felugrójába** kerül —
   eddig a kurátort egy MÁSIK képernyőre küldte kötelező indoklásért, miközben a kezében ott
   volt a küldés gomb. Az indoklás itt **nem kötelező** (a tulaj gyors utat kért); a napló azt
   rögzíti, ami történt: a kurátor a küldés felugrójában, a lelet ismeretében vállalta.
   ⚠️ Az ADR-0150 kötelező indoklása a **lead-lapi** úton változatlanul él — ott a kurátor nem a
   küldés pillanatában, a lelet mellett dönt.
4. **Két eset marad kemény, és egyik sem a kurátor felülbírálása:**
   **(a) §C jogszerűségi kapu** — leiratkozó link, feladó-azonosítás: ez törvény (Grt. 6. § /
   Eker.tv. 4. §), nem gépi vélemény. **(b) Nincs mit kiküldeni** — nincs renderelt lap, vagy egy
   újabb generálás felülírta a fájlt (a link más mock tartalmát vinné). Ott nem egy lelet áll a
   szándék útjában, hanem hiányzik a termék: azt újragenerálni kell, nem lenyugtázni.

**Elvetett alternatíva:** „minden kapu megerősíthető, a jogi is”. Egy leiratkozó link nélküli
hideg levél nem a tulaj kockázata elvben — a **nevére** megy ki. A kapu ott nem a döntését
bírálja felül, hanem egy olyan levelet tart vissza, amit a jog nem enged kiküldeni.

**Az őr, ami ezt ezentúl fogja.** Az `outreach-sendability-check` három állapotot mér, és két új
szabályt kapott: ⑤ a megerősíthető lelet nem jelenhet meg „NEM küldhető”-ként, ⑥ a „jogszerűségi
kapu tiltja” mondat csak §C-FLAG mellett állhat. Mindkettő **önteszttel bizonyítja, hogy lát**:
a 2026-09-19-én kiment sáv szövegén pirosra kell mennie — különben olyan sor lenne, amiről soha
nem igazoltuk, hogy megfog valamit. (Pont az fedte el a hibát, hogy minden mérés zöld volt.)

**Mellék-lelet, mérve 390px-en.** A `.pill` alap `white-space: nowrap`-je egy SZÓKÉP-címkére való
(„✓ kiküldve”), nem egy egész mondatra: a sáv mobilon „…a küldés gomb előbb megmut…”-nál
elvágódott — vagyis **pont az a fél mondat veszett el, ami megmondja, hogy ki lehet küldeni**.
A mondat-vivő pirulák (`pill--claim`) ezért tördelnek. A levágás mindig a VÉGÉT viszi el.
