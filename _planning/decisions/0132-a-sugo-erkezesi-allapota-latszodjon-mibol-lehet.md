## ADR-0132 — A súgó ÉRKEZÉSI ÁLLAPOTA: látszódjon, miből lehet választani (2026-09-13)

- **Dátum:** 2026-09-13
- **Kiváltó / Kontextus:** az ADR-0126 ② szelete (2026-09-12, commit `37ed329`) a 35 cikkes súgó-falat
  9 összecsukható csoportra bontotta, **alapállapotban mind csukva** — ez a tulaj akkori, §2b körben
  hozott döntése volt. Az Elek FK-000 újramérés (ERG-2/3/6) mérte, hogy ez a másik végletet adja:
  **érkezéskor NULLA cikkcím látszik**, miközben a jobb hasáb ugyanazon a képernyőn azt kéri,
  „Válassz témát a listából" — a felület olyat kér, amit maga nem kínál. Mellette: elvágott kereső-
  helyőrző, keskeny bal oszlop 4 törött csoportnévvel, ~70% üres képernyő, és a **főmenüben nincs
  „Súgó" menüpont** (a központi súgó csak URL-ből vagy egy ⓘ-ikonból nyílt).
- **⛔ Miért csúszott át a §2b kapun:** a jóváhagyott vázlat (`help-collapse/approved-A.html`)
  **EGYHASÁBOS** volt, az éles lap **kéthasábos**. A vázlat soha nem mutatta meg a jobb oldali
  felszólító dobozt és a mellette üresen álló ~70%-ot. A kapu végigfutott, a tulaj döntött — egy
  olyan képen, amelyről a bejelentett hiba **hiányzott**. A vázlat SZERKEZETE (hány hasáb, mi áll a
  másikban) ugyanúgy a terv része, mint a szín; ha a vázlat egyszerűsít, pont a hibát egyszerűsítheti ki.
- **Döntések (tulaj-választás új §2b körben, három működő vázlat mobil+asztali képpel — „C"):**
  - **A) ÉRKEZÉSKOR LÁTSZIK TARTALOM.** A lista **első csoportja NYITVA** renderel, a többi csukva.
    SZERVER-oldalon (`<details open>`), nem kliens-oldali kinyitogatással — különben JS nélkül pont a
    hiba maradna meg. ⛔ Ez **felülírja** az ADR-0126 ② „alapállapotban minden csoport csukva" pontját;
    a csoportosítás indoka (a 35 cikkes fal) változatlanul áll.
  - **B) A jobb hasáb INDULÓLAP, nem felszólítás.** Amíg nincs megnyitott cikk, a konzolon kilenc
    témakör-kártya áll ott, bennük MINDEN cikkcím kattinthatóan (szerver-oldalon renderelve).
    **Telefonon nem jelenik meg**: ott a lista maga az indulólap, a kártya ugyanazoknak a címeknek a
    második példánya lenne egy képernyőn. A két méret két külön tervezői döntés.
  - **C) A súgó a FŐMENÜBŐL elérhető** — a konzol fejlécének utolsó menüpontja, a `/help` lapon
    aktívként kiemelve. Eddig a lap egyetlen menüpontot sem emelt ki: az operátor olyan felületen
    állt, ami a navigációban nem létezett.
  - **D) A gombpár ahhoz az oszlophoz igazodik, AMIRE HAT.** A „Mindet kinyitom/becsukom" a lista
    fölé került (a jobb, ÜRES hasáb fölött ült), mellette a darabszám, ami JS nélkül is látszik.
  - **E) A kereső a panel teljes szélességét kapja, és a helyőrzője BEFÉR.** ⛔ A tünet a SZÖVEGRŐL
    szólt, az ok egy szomszédos szabály: a `.con form { display: inline }` **(0,1,1)** VERI a
    `.con-kb-search { display: flex }`-et **(0,1,0)**, ezért a mező a tartalmára zsugorodott (~200 px),
    a helyőrző meg 274 px. Ugyanaz a specificitás-minta, mint a `.con a` ↔ `.citui-btn--*` ütközésnél.
    ⚠️ Telefonon a teljes szélesség SEM elég — ott a mező külön sort kap, a gomb alá kerül.
  - **F) Ugyanez a tenant-admin Súgó fülén** (`?tab=sugo`) az A) és E) pontra. Az indulólap ott nem
    értelmezett (nincs második hasáb), a Súgó pedig már fül.
- **Az őr tanulsága (ez a legfontosabb):** a `help-collapse-check.mts` ① állítása szó szerint azt
  kérdezte, *„alapállapotban MINDEN csoport csukva"* — **ZÖLDEN védte pont azt, amit a tulaj hibaként
  jelentett be.** Egy őr annyit ér, amennyit az állítása KÉRDEZ: ez a kérdés a SZERKEZETRŐL szólt,
  nem arról, hogy a felhasználó ELŐTT van-e tartalom. Az új ① a **látható cikkcímek számát** méri
  (`:visible` + valós bounding box), plusz nyolc új állítás. A visszarontott forráson mérve
  **10 valódi piros**, köztük a bejelentett tünet: „érkezéskor LEGALÁBB 3 cikkcím LÁTSZIK — 0".
- **Kontraktus:** `assets/design-refs/console/help-start/` (README + `approved-C.html`). A régi
  `help-collapse/README.md` 1. pontja áthúzva és ide mutat — egy szabály nem élhet két példányban.
- **Visszafordíthatóság:** 🔄 nézet- és CSS-szintű, additív (egy menüpont, egy `open` attribútum, egy
  szerver-oldalon renderelt kártya-blokk). Adatmodell nem változott.
- **Elvetett alternatívák:** *„B — minden csoport nyitva"* (asztalon a képernyő tetején azonos az
  elfogadottal, a különbség csak a görgetés hossza — telefonon jelentős); *„A — csak az első csoport
  nyitva"* (a jobb hasáb 70%-a továbbra is üresen maradna egyetlen felszólítással); a helyőrző
  rövidítése (a tünetet kezelte volna, az okot — a specificitás-ütközést — nem).
- **G) A HORGONY KATTINTHATÓ ELEMEN ÜL** *(utószál ugyanaznap, tulaj-kérésre — az eredetileg NYITOTT
  tétel lezárva).* A Pénzügy öt konzol-képernyőjén (`partnerViews.ts`) a `data-kb-anchor` egy néma
  `<div class="panel">`-en ült: 6 horgony, **0 `helpLink`** — a lefedettség zöld, súgó-ikon SEHOL,
  pedig az ADR-0045 B) minden szekcióra ígéri. Mind az öt megkapta a `helpLink()`-et a fejlécben, és
  a `kb-check --coverage` **strukturálisan elutasítja a nem-`<a>` elemen ülő horgonyt** — a
  láthatatlan attribútum nem lehet többé „zöld lefedettség".
  - ⛔ **A pixel-mérés olyat talált, amit nem kerestünk:** a súgó-ikon **MINDEN** konzol-képernyőn
    cián volt fehéren, **2,41** kontraszttal, mert a `.con a` (0,1,1) verte a `.con-help`-et (0,1,0).
    Ugyanaz a specificitás-csapda, mint a fizetés-gomb színénél — **harmadszor**.
  - ⛔ **A javítás előállította a következő csapdát:** az új `.con a.con-help` (0,2,1) verte a
    sötét-sáv szabályt (0,2,0), így a partner-lap navy fejlécén az ikon muted maradt: **3,03** —
    és a 3,0-s küszöb ezt **átengedte volna**. A „még éppen átment" érték pont azt fedheti el, hogy
    a szándékolt szabály nem ért hatályba: a küszöb **4,5** lett, a sötét-felület szabály (0,3,1).
    Végleges: **4,81 fehéren, 14,57 a navy sávon.**
  - ⭐ A kontrasztot az **opacity-vel együtt** kell számolni (a `getComputedStyle().color` nem tud
    róla), és a számolás **Node-ban** fusson: a `tsx` `keepNames`-e `__name`-et injektál a
    `page.evaluate`-be ágyazott függvényekbe, ami a lapon `ReferenceError`.
- **H) A RÁCS A TARTALOMJEGYZÉK — asztalon a bal lista CSUKVA érkezik** *(harmadik kör,
  tulaj-döntés az Elek FK-000 újramérésére).* A „C" terv következménye volt, hogy ugyanaz a 9
  csoport és 35 cikk **kétszer** állt egy képernyőn (bal harmonika + jobb kártya-rács). Ha a rács
  látszik, ő a tartalomjegyzék, és a bal oszlop a kilenc csoportfejre zár — a fejek LÁTSZANAK, a
  lista nem tűnik el. Kereséskor NEM zár be: ott a találat a fontosabb.
  - ⛔ **A DEGRADÁCIÓ IRÁNYA KÖTÖTT.** A becsukás JS-es, mert a szerver nem ismeri a képernyő
    szélességét. Fordítva (alapból csukva + JS nyit telefonon) a JS nélküli telefonos olvasó
    NULLA cikkcímet kapna — pontosan a bejelentett hiba. Így JS nélkül **fölösleg** keletkezik,
    nem **hiány**. A feltétel a rács TÉNYLEGES láthatósága, nem egy ide másolt töréspont-szám.
  - ⛔ **AZ ELRENDEZÉS-CSERE NÉMÁN VITT EL INFORMÁCIÓT:** a kártyákkal együtt kidobtam a régi
    doboz mondatát is („…a cikk itt nyílik meg…"), és a lapról eltűnt az egyetlen sor, ami
    megmondta, HOVA nyílik a kattintott cikk. A kép mindkét állapotban rendezett — a
    screenshot-ellenőrzés erre szerkezetileg vak. Visszatéve, őrzött állításként.
  - ⚠️ **Az őr saját öntesztje is pontatlanná vált:** a „mind csukva → nulla cikkcím" eset
    1280px-en futott, ahol ez MOSTANTÓL a helyes állapot — vagyis egy legitim állapotról
    állította, hogy megfogja a hibát. Áttéve 390px-re. **Egy viselkedés-változás a NEGATÍV
    tesztet is elavulttá teheti.**
  - **Mellékág (Elek-forgatókönyv):** az FK-000 5. lépésének nem volt `út:` mezője, ezért a
    runner a 4. lépés lapján maradt, és a képe BITRE AZONOS lett vele. A kézi „összkép
    rendezett?" ítélet ugyanazt a lapot minősítette kétszer, a kör pedig négy képernyő helyett
    hármat fedett le — miközben a napló ötöt mutatott. **Kézi ítélet-lépés MINDIG mondja meg,
    melyik képernyőről ítél.** Most a `/report`-ra megy, gépi `várd:`-dal.
