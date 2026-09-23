## ADR-0126 — A fejlesztői azonosító nem felhasználói szöveg; és a súgó csoportosítása ADAT (2026-09-12)

**Kontextus.** Az Elek FK-000 újramérése két leletet adott, mindkettő az operátor szemén:

- **①** A konzol Árazás-képernyőjén ez állt: **„Egyedi domain — feltételek (ADR-0109)"**, a
  magyarázó bekezdés pedig további két ADR-számot idézett. Az ADR-szám a FEJLESZTÉS könyvtári
  jele — az operátor nem tudja kikeresni, a vevő (ahol átlátszik) zsargonnak olvassa. A
  végigmérés 132 találatot adott: a megkeresés-kapu `§C-kapu` feliratai, a kapu-ok-listák
  `§A demo-framing` sorai, a súgó-cikkek, a teszt-forgatókönyvek címei — és **két ADR-szám egy
  MIGRÁCIÓS SEEDBŐL** (`0057_market.sql`), ami a /settings lapon jelent meg. Az utóbbit
  egyetlen forrás-grep sem találhatta meg: a szöveg ADAT volt, nem literál.
- **②** A súgó (`/help`) 35 cikke egyetlen, kategória nélküli fal volt.

**Döntés.**

1. **A FELHASZNÁLÓ-FELÉ NÉZŐ SZÖVEGBEN NINCS BELSŐ AZONOSÍTÓ.** Sem ADR-szám, sem saját
   doktrína-szakasz (`§C`, `§B.17`), sem belső dokumentum-név. **Az INDOKLÁS marad, emberi
   nyelven** — nem a magyarázatot vesszük el, hanem a könyvtári jelet. A kód-KOMMENT (és a
   fejlesztői napló, és a migráció `--` kommentje) ellenben MEGTARTJA: ott a hivatkozás
   hasznos, ott keresi ki a fejlesztő.
   ⚠️ **A JOGSZABÁLYI § NEM ESIK IDE:** a „2001. évi CVIII. törvény 4. §-a" helyesen van a jogi
   szövegben. A megkülönböztetés szerkezeti: a saját szakaszainknál a § után NAGYBETŰ áll, a
   jogszabálynál SZÁM.
2. **A kapu neve emberi lett:** a `§C-kapu` mostantól **„jogszerűségi kapu"** minden felületen —
   a verdikt-pill, a küldés-visszautasítások, a súgó és az Elek-forgatókönyv elvárása EGYÜTT
   mozdult (egy átnevezés, ami a súgóban idézett feliratot nem követi, csak új hazugságot szül).
3. **ŐR: `scripts/internal-ref-check.mts`, három rétegben** — mindegyik ott lát, ahol a másik vak:
   - **① RENDERELT:** a valódi konzol + tenant-admin lapok (59 + 30 lap) bejelentkezve,
     `innerText`-tel. **Ez találta meg a migrációs seedet.** A lefedettség nem emlékezetből jön:
     a route-listát a szerver saját forrásából származtatjuk, a fülekét az admin-nézetéből, és
     ami se nem látogatott, se nem indoklással kihagyott → BUKÁS.
   - **② TERMELŐK:** a csak HIBÁS ágon megjelenő kapu-ok-sorok (43 sor, 5 forgatókönyv). Egy zöld
     körbejárás egyetlen ilyet sem renderel — a boldog úton mért zöld olyan képernyőt
     „bizonyítana", aminek a piros fele tele van hivatkozással.
   - **③ STATIKUS IKER:** a felhasználó-felé néző forrás-literálok (AST-ből, így a komment
     szerkezetileg marad ki), a súgó-cikkek, a teszt-forgatókönyvek RENDERELT mezői (a gépi
     `út/tedd/várd` nem az), és a migrációk **BEÍRT** szövege (`INSERT`/`UPDATE`, a `COMMENT ON`
     és a `WHERE` nem — az egyik séma-doksi, a másik a régi értéket IDÉZI).
   - Negatívan igazolva: kód-literálba visszatett ADR-szám → piros ①+③-ban; a DB-be visszatett
     seed-szöveg → piros CSAK ①-ben (a statikus iker vakon maradt, ahogy kell).
   - A commit-kapu a `--fast` módot futtatja (②+③, böngésző nélkül), és a kihagyást KIMONDJA.
4. **A SÚGÓ CSOPORTOSÍTÁSA ADAT, NEM KÓDBELI TÁBLÁZAT.** Minden cikk fejlécében kötelező
   `category:` mező (`src/kb/kbCategories.ts` regiszter); a `kb-check` bukik hiányzó, ismeretlen
   vagy MÁS olvasó-körhöz tartozó kategóriára. Egy nézetbe írt slug-listánál egy ÚJ cikk némán
   egy „egyéb" kupacba esne — a csoport-felirat abból származzon, ami az adatban van.
   A csoportosítás a **MUNKAFOLYAMATOT** követi, nem a menüt (tulajdonosi választás): operátor =
   A lead útja · Pénzügy és partnerek · Mérés és napló · Rendszer és fiók; tenant = Az oldalam ·
   Foglalás és vendégek · Modulok és bővítések · Előfizetés és számlák · Fiók, jog és üzenetek.
   A kategória-feliratot a tenant is olvassa, ezért a regiszter az i18n betakarítás alá került.

**Következmény.** A `0057` seedje javítva (friss DB már tisztán születik), a meglévő sorokat a
`0065_market_note_no_internal_refs.sql` igazítja — a javító UPDATE szándékosan csak a seed
szövegét cseréli, az operátor saját megjegyzéséhez nem nyúl.

**Kiegészítés (ugyanaznap, tulaj: „az összecsukható súgó-csoportok mehetnek").** A §2b kör
lefutott: három MŰKÖDŐ vázlat (A harmonika / B exkluzív / C mobilon-csukva), valós adattal,
mobil+asztali képpel. ⚠️ A vázlat első változata a tulaj SAJÁT eszközén nem tudta volna
megmutatni a döntés felét: telefonon az „Asztali" mód fizikailag nem lehet szélesebb a
képernyőnél (mérve 354px), ezért a váltó asztali módban 1100px-en RENDEZ és arányosan
kicsinyítve mutat. Választás: **A — minden csoport csukva, több nyitható**, plusz a
**„Mindet kinyitom / becsukom"** gombpár. Kontraktus: `assets/design-refs/console/help-collapse/`.

5. **A CSOPORT `<details>`, NEM kattintás-kezelő div.** A súgó keresése sima GET, tehát a lap
   JS nélkül is használható — egy olyan összecsukott lista viszont, amit CSAK JS tud kinyitni,
   JS nélkül használhatatlan súgót adna. A nyitás/csukás így natív; a gombpár a JS-es ráadás,
   és JS nélkül NEM jelenik meg (halott gomb helyett semmi).
   ⛔ **A keresés eredménye LÁTSZIK:** aktív `?q=` esetén a találatos csoportok `open`-nel
   renderelnek — SZERVER-oldalon, tehát JS nélkül is igaz. Enélkül a lap „N találatot" írna,
   és közben csukott fejléceket mutatna: a felület a saját állításának mondana ellent.
   Őr: `scripts/help-collapse-check.mts` (mindkét felület, pixel-szinten, no-JS ággal,
   negatív önteszttel) — és **négy valódi hibát talált a saját kódomban**: a konzol gombpárja
   néma volt (a script a lista ELŐTT futott, így a lista még nem létezett), a `display:flex`
   pedig ÜTÖTTE a `[hidden]`-t, ezért JS nélkül halott gombpár látszott — mindkettő olyan,
   amit egyetlen képernyőkép sem mutatott volna.

**Kiegészítés 2. (ugyanaznap, tulaj: „a C1-C4 kódokat is cseréld emberi szövegre").** A
megkeresés-kapu ok-sorai `C1:`…`C4:` és `C-ORSZÁG:` előtaggal álltak — ezek a doktrína §C
pontjainak SORSZÁMAI voltak, az operátornak semmit nem mondtak. Helyettük **TÁRGY-prefix** áll,
ami magát a bajt nevezi meg: `LEIRATKOZÁS:` · `FELADÓ:` · `HIRDETŐ:` · `ADATKEZELÉS:` ·
`JOGALAP:` · `SZEMÉLYRE SZABÁS:` · `FÉLREVEZETÉS:` · `KERETEZÉS:` · `ÁR-HIRDETÉS:` · `PIAC:` —
a kódban MÁR MEGLÉVŐ `LINK:` prefix mintájára, tehát nem új szokás, hanem a meglévő
következetes végigvitele. 20 ok-sor. Az őr mintája kiegészült a kapu-kóddal (negatívan
igazolva), így nem jöhetnek vissza.

⚠️ **Amit ez a csere MAGÁVAL RÁNTOTT** (a rename akkor kész, ha a rá horgonyzó dolgok is
mozdulnak): a `market-gate-check.mts` ország-kapu regexe (`/C-ORSZÁG/` → `/^PIAC:/m`, továbbra
is SAJÁT literál, nem a vizsgált modulból importált konstans), az `outreach-gate-selftest.mts`
**15 elvárása**, a `console-markets` súgó-cikk idézete, és a `console-outreach-draft` súgó
FLAG-ok táblája — utóbbi három sora szó szerint a régi szöveget idézte, tehát a súgó a csere
után olyan feliratot ígért volna, ami nincs. A tábla fölé bekerült egy mondat, ami kimondja,
mit jelentenek a nagybetűs előtagok.

**Kiegészítés 3. (Elek FK-004 újrafuttatás, tulaj: „mondja ki mindkettőt").** A lead-sáv
mock-jelölése a LEGUTÓBBI mock állapotát mondta — az operátor (és a küldés-út) kérdése viszont
az, hogy VAN-E JÓVÁHAGYOTT mock. A kettő szétválik, amint egy újabb generálás születik a
jóváhagyott mellé: 2026-09-12-én az FK-004 emiatt bukott el a 2. lépésén (`nem látható
"mock: approved"`), **miközben a leadnek VOLT jóváhagyott mockja és a levél kiküldhető lett
volna** — vagyis a piros egy ÉP termékre mutatott. A sáv mostantól mindkettőt kimondja:
a meglévő állapot-pill mellett `van jóváhagyott mock` jelölés áll, ha a legutóbbi nem az.
⚠️ A felirat szándékosan NEM tartalmazza a „mock: approved" alakot — arra egy másik
forgatókönyv NEM-láthatóság-állítást mér. Őr: `mock-state-label-check.mts` (hermetikus, DB és
szerver NÉLKÜL: a nézetet három szintetikus állapottal rendereli, és bizonyítja, hogy a három
render tényleg különbözik), pre-commitban, negatív önteszttel.
**És az ELVÁRÁS is robusztusabb lett** (tulaj-kérés): az FK-004 előfeltétele a szövegre mért
`látható "mock: approved"` helyett a **TÉNY-HORGONYRA** mér — `darab "[data-cit-approved='1']"
== 1`. A sáv `data-cit-approved="1|0"` attribútuma MINDIG ott van, és azt mondja meg, van-e
jóváhagyott mock; a látható felirat viszont hol az állapotot, hol a külön jelölést mutatja,
ezért szövegre mérve az állítás park-zajtól billeg. Ugyanezen a lapon, ugyanabban a pillanatban
mérve: **a régi elvárás ELBUKNA, az új ÁTMEGY.** (A runner saját elve: „a substring proxy, a
horgony a tény".) Az FK-003b jóváhagyás-utáni állítása is a szigorúbb szelektoros alakra váltott
— ott a kör MAGA végzi a jóváhagyást, tehát ott az AKTUÁLIS állapot a helyes mérce.
