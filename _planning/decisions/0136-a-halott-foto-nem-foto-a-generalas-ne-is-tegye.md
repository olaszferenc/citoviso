## ADR-0136 — A halott fotó nem fotó: a generálás ne is tegye a lapra (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0134 (kiküldés-kapu a
törött képes mockra), ADR-0131 (MMS-előnézet), ADR-0097 (adat-éhezés), 0060/0061 (nyitókép-
választás), 03-INVARIANTS §A (provenance) + §B.17.

**Kontextus.** A tárolt portál-fotó-URL nem örök. Mérve 2026-09-13: a hovamenjek.hu átírta a
fájlneveit (73 tárolt URL-ből **59 halott**, 11 leadet érint — az adatlapok ÉLNEK, csak a
fájlnevek változtak), a balaton.hu pedig a **saját lapján** hivatkozik 404-es i.szalas.hu
képekre. Az ELEK-TESZT lead 13 fotójából 11 volt halott, és **a nyitókép is közülük került ki**:
a leadnek kiküldött lapon törött-kép ikon, az MMS-előnézet pedig egyáltalán nem állt elő
(Elek FK-004 H1). Egy 40 leades véletlen minta szerint ez nem egyedi: **27 mért nyitóképből 6
halott (22%)**.

**Döntés.** A generálás a fotó-halmaz eldőlésének EGYETLEN pontján (`resolveGatedPhotos`)
kiszűri a **véglegesen** halott képeket — a fizetős vision-pontozás ELŐTT. Így halott URL nem
lehet nyitókép, galéria-csempe, JSON-LD `image` vagy levél-illusztráció, és nem is fizetünk
azért, hogy nem létező képet osztályozzunk.

**Két réteg, két munka (nem ugyanaz).**
- **ADR-0134 kiküldés-kapu:** a KISZÁLLÍTOTT artefaktumot méri, és megtagadja a jóváhagyást/
  kiküldést. Az AJTÓBAN fog — mert a tárolt URL a generálás UTÁN is elrohadhat.
- **Ez az ADR:** ilyen lap ELŐ SE ÁLLJON. A kettő nem helyettesíti egymást.

**⚠️ Csak a VÉGLEGES hiba ejt** (404 / nem-kép). Egy 429-es vagy hálózati döccenés miatt fotót
dobni fordítva ugyanakkora kár: üres galéria egy élő szállásnak — és a portál épp a mi
kérés-sorozatunkra ad 429-et. A múlandót meghagyjuk; arra való a kiküldés-kapu. A mérés
ugyanazzal a `fetchPhoto`-val (és cache-sel) megy, amit a kapu és a kurátor csempéje használ:
egy képernyőn egy igazság.

**⚠️ Amit a változás ELTÖRT, és hogyan zártuk.** A szűrés hálózatot használ, a
`portal-photo-check` viszont a saját fejlécében mondja ki, hogy **offline és determinisztikus,
„mert minden commitnál fut"** — a kitalált `cdn.booked.hu` URL-jeit a szűrő (helyesen) halottnak
mérte, és 4 esete elbukott. A fixture kimondott varratot kapott (`checkLiveness: false`), és
hogy ez ne váljon csendes kiskapuvá, az őr **szerkezetileg tiltja**, hogy `src/**` alatt bárki
kikapcsolja. (A tiltás első változata a SAJÁT magyarázó kommentemre illeszkedett és a definíció
fájlját jelentette sértőnek — a detektor előbb kikommentez, aztán mér; piros ikerrel mindkét
irányban.)

**A park fotói is frissíthetők** (`seed-elek-lead.mts --refresh-photos`). ⛔ A fixture-ön a friss
begyűjtés NEM működik, és ez **így helyes**: a lead át van nevezve (`ELEK-TESZT Vendégház`),
ezért a portál-adatlap entitás-egyezése 0.44-en elbukik (név-lefedettség 0.00 — mérve). Ezt a
kaput nem lazítjuk azért, hogy egy teszt-rekord átmenjen rajta: pont az a dolga, hogy idegen
adatlapot ne ragasszon egy leadhez. A frissítés ugyanazon az úton megy, amin a fixture
**született**: a klón-forrás valódi leadet olvassuk újra (ott a név stimmel — mérve 4 adatlap ·
11 fotó · 11/11 él), és a friss anyagot a seed átíró szabályával (név/e-mail/telefon) másoljuk
át. Ami a seedben invariáns, az itt is az.

**Mérés a javítás után.** Fixture: 13 fotó (2 élő) → **10 fotó (10 élő)**. A nyitókép:
„exterior (88) — az épület szép kültéri nézete este megvilágítva". Kép-egészség: **verdikt=ok,
0 törött**. Az MMS-előnézet állapota **READY**, és a kimenő 42 kB-os JPEG a valódi nyitóképet
viszi, ráégetett „ELŐZETES LÁTVÁNYTERV" szalaggal.

**Nyitott.** A mintában mért ~22% halott nyitókép a TÖBBI leadre is áll: azokat egy szélesebb
körű friss begyűjtés hozza vissza (a portál-adatlapok élnek). Ez a döntés nem takarítja ki a
meglévő adatot, csak azt garantálja, hogy MOSTANTÓL halott kép nem kerül lapra.

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül.

### ⚠️ HELYESBÍTÉS az ADR-0136-hoz (2026-09-13 este) — a számaim egy PORTÁL-KIMARADÁST mértek

A fenti indoklás „73 tárolt URL-ből 59 halott" és „a park 8%-a halott" számai **nem állják meg
a helyüket**. A sweep futtatása közben ugyanaz a mérőeszköz, ugyanazon a — bájtra azonos, három
pillanatképből igazolt — URL-halmazon:

| időpont | hovamenjek-minta | park-szintű |
|---|---|---|
| ~19:00–21:05 | 59/73 halott | **72 halott (8%)**, 10 lead |
| 21:45 | **2/73 halott** | **21 halott (2%)**, 4 lead |

A portálnak részleges kimaradása volt. **A saját kimaradásuk nem lelet a rekordról** — és én
pontosan ezt írtam le ténynek. Ami ebből IGAZ marad: az ELEK-TESZT lead URL-jei valóban
véglegesen halottak (a fájlokat átnevezték — a régi név ma is 404, az új név 200), és a
**szabály** is áll: halott kép ne kerüljön a lapra.

**Amit a helyesbítés a KÓDBAN változtat (ez a lényeg).** Egy pillanatnyi 404 nem bizonyíték a
végleges elvesztésre. Ha elfogadnánk, egy fél órás portál-döccenés VÉGLEG kiürítené a szállás
galériáját a kiküldött (statikus) lapon. Ezért a szűrő **gazdagép-kimaradás féket** kapott: ha
egy host képeinek TÖBBSÉGE bukik egyszerre (≥3 mért képnél), az kimaradás-aláírás, nem tömeges
törlés → arról a hostról **egyet sem ejtünk**, és a kész lapról az ADR-0134 kiküldés-kapu dönt,
hangosan. Csendben elszegényíteni a lapot rosszabb, mint hangosan megállni.

**A sweep-eszköz is ebből tanult:** a `--fix` először feltétel nélkül ráírta a friss olvasatot a
leadre — és mivel a kimaradás miatt a friss olvasat sem volt jobb, több leaden KISEBB halmazt
írt a régi helyére (a Mákszem 45 élő fotója 0-ra, a Lavia 45-je 19-re esett). A park a 18:15-ös
mentésből állt vissza, bájtra igazoltan (10 lead, park-szinten 595-ből csak a 2 szándékos
javítás tér el). A `--fix` innentől: pillanatkép → írás → ÚJRAMÉRÉS → **ha nem lett TÖBB élő
fotó, VISSZAÁLLÍTÁS**. A javítás szerkezetileg nem tud rontani.
