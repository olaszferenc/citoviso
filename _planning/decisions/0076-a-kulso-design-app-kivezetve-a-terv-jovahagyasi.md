## ADR-0076 — A külső design-app kivezetve; a terv-jóváhagyási kapu MARAD (tulajdonosi döntés)

**Dátum:** 2026-08-27 · **Státusz:** ELFOGADVA (tulajdonosi döntés, szó szerint: *„elhagyjuk a
Claude dizájnt, de a doktrina marad: kinézet user döntés ami meghatározza a kódot"*) ·
**Kapcsolódó:** ADR-0065/0066 (a kapu és a DesignSync-csatorna), **ADR-0068 (VISSZAVONVA)**,
CLAUDE.md §2b (3. pont cserélve).

**A döntés.** A `DesignSync` / Claude Design mint terv-bemutató csatorna KIVEZETVE. A terv-jóváhagyási
kapu VÁLTOZATLANUL ÉL: kinézeti döntést igénylő felület-munkánál előbb terv, a tulaj dönt, és a
döntése határozza meg a kódot. **A cél nem alku tárgya; csak a csatorna cserélődik.**

**Miért.** Két külön ok, és fontos szétválasztani őket:
1. **Üzemeltetési:** a DesignSync OAuth-ja ismétlődően lejárt (a `design-cred-guard.py` cron-őr sem
   oldotta meg tartósan), a kártya-index (`_ds_manifest.json`) kézi frissítést igényelt, és a
   tulaj ideje a „nem látom / még nem frissült / hol van már" körökre ment el. A csatorna többe
   került, mint amennyit adott.
2. **Fogalmi (ez a fontosabb):** a külső app SOHA nem volt az alkotás eszköze. **Két külön
   „nem látja" probléma van, és ezeket korábban ÖSSZEMOSTAM** — ebből jogosan olvasott ki a tulaj
   önellentmondást:
   - ① **Az AI nem látja, amit generál** → eszköz: `scripts/ui-shot.mts` + a képeket Read-del
     megnézni. LOKÁLIS, bejelentkezés nélkül. **Ez javította meg a „90-es évekbeli felületek
     mentek ki" problémát**, nem a design-app. (A memória ezt már rögzítette: *„nem eszköz
     hiányzott soha, hanem hogy kötelező legyen"*.)
   - ② **A tulaj nem látja a tervet, mielőtt kódolunk** → ez a CSATORNA kérdése (ADR-0066
     kiváltó oka: *„a kód megszületett anélkül, hogy a tulaj egyetlen képet is látott volna"*).
   A design-app KIZÁRÓLAG a ②-t szolgálta. Az ① érvével (az AI vakságával) eladni egy ②-t
   szolgáló eszközt hibás érvelés volt.

**Az új csatorna.** A kapu 3. lépése: a képek ÉS a kattintható, önhordó HTML-ek eljuttatása a
tulajhoz (`SendUserFile`), egy körben, azzal a magyarázattal, hogy melyik változat MIT dönt el.
A tulaj a képen dönt; módosítási kérésre ÚJ kör generálódik. Az ① lépés (ui-shot + saját szemmel
megnézni) VÁLTOZATLANUL KÖTELEZŐ — az adja a minőséget.

**Bizonyíték, hogy az ① hurok dolgozik.** A domain-UI tervkörében (ADR-0071 B blokk) a saját
képnézés két valódi hibát fogott meg, mielőtt bármi a tulajhoz került: (a) 390px-en a domain-nevek
szó közepén törtek (`napfenypanz|io.hu`); (b) a „nem sikerült" képernyőn az imént elkelt nevet
újra felkínáltuk „szabadnak tűnik" jelöléssel. Egyiket sem külső app találta meg.

**Elhatárolás az ADR-0068-tól.** A 0068 ugyanezt a csatorna-cserét akarta, és VISSZA LETT VONVA —
de nem azért, mert az irány rossz volt, hanem mert **az AI döntötte el a tulaj helyett, és
önkényesen átírta a §2b doktrínát**. Most a döntés a tulajé; a §2b-ben a CÉL szövege érintetlen
maradt, csak a 3. pont csatornája cserélődött. A `/design` konzol-felület NEM éled újra
automatikusan: ha kell, az külön, kimondott döntés.

**⛔ MÁSODIK TULAJDONOSI RENDELET UGYANEBBEN A KÖRBEN (2026-08-27): MINDIG KELL DESKTOP ÉS MOBIL
TERV IS.** Szó szerint: *„OK hogy én többnyire mobilon nézem a dolgokat. de nem nekem és a mobilnak
fejlesztünk! Szóval amit tegyél hozzá: mindig kell desktop és mobilos terv is!"*

- **A kiváltó hiba:** a domain-UI tervkörében mindkét méretben legyártottam a képeket, de **csak a
  mobilokat küldtem el** — a tulaj a döntés felét nem látta.
- **A gyökér-ok, és ezért kellemetlen:** a doktrína ÉS a memória is helyesen „desktop ÉS mobil"-t
  írt (`feedback_temp_folder_and_mobile_first`: *„desktop ÉS mobil (~390px) screenshot"*; §2b 2.
  pont: *„390px + desktop"*). **Tehát nem a leírt szabály volt hiányos — én sodródtam el tőle**:
  abból, hogy a tulaj telefonon néz, csendben az lett a gyakorlatomban, hogy a mobil az
  ELSŐDLEGES, majd az EGYETLEN SZÁLLÍTOTT nézet. Összekevertem, hogy **a tulaj min NÉZI a tervet**,
  azzal, hogy **kinek és mire készül a TERMÉK**. A generált szállás-oldal vendége ugyanúgy ülhet
  gép előtt; a belső konzolt is használják asztali gépről.
- **Tanulság a szabály-alakról:** a „X-et IS csináld" alakú szabály lassan „X-et csináld"-dá kopik,
  ha a gyakorlatban az egyik ág mindig kényelmesebb. A generálás ELLENŐRZÉSE (2. pont) helyes volt
  — a SZÁLLÍTÁS (3. pont) nem volt kimondva, és ott szivárgott el. Ezért került most explicit
  mondat a 3. pontba is, nem csak a 2.-be.
- **A szabály:** a két méret KÉT KÜLÖN TERVEZŐI DÖNTÉS (elrendezés, oszlopszám, mit visz a
  szélesebb hely) — nem ugyanaz a terv kétszer lelőve. Mindkettő legyártandó, mindkettő
  megnézendő, és **mindkettő elküldendő**.
- CLAUDE.md §2b 1. és 3. pont ennek megfelelően bővítve.

**Visszafordíthatóság:** 🔄 — a csatorna bármikor cserélhető; a tervek önhordó HTML-ek, nem
kötődnek egyetlen megjelenítőhöz sem.
