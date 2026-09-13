# 2026-09-13 — A súgó érkezési állapota: a tegnapi javítás a másik végletbe esett

**Kiváltó:** Elek FK-000 újramérés (`elek/runs/FK-000-2026-09-13T12-49-19/`), ERG-2 + ERG-3 + ERG-6 lelet.
**Munkafa:** `~/wt/sugokezd` (ág: `wt/sugokezd`). **Élesítés: NINCS.**

## A bejelentés

A tegnap épített „35 cikkes fal → 9 összecsukható csoport" (commit `37ed329`) érkezéskor **mind a
kilenc csoportot csukva** adta, vagyis **NULLA cikkcím** látszott — miközben a jobb hasáb ugyanazon
a képernyőn azt kérte: „Válassz témát a listából". Mellette a kereső helyőrzője mondat közepén
elvágva („Mit keresel? (pl. mock,"), a bal oszlop keskeny (4 csoportnév két sorba tört), a képernyő
~70%-a üresen. Külön lelet (ERG-6): a **főmenüben egyáltalán nincs „Súgó" menüpont**.

## Amit ez a kör MEGTANÍTOTT

### ⛔ Az őr ZÖLDEN védte azt, amit a tulaj hibaként jelentett be

A `help-collapse-check.mts` ① állítása szó szerint ez volt: *„alapállapotban MINDEN csoport csukva"*.
Zöld volt, és pontosan a hibás állapotra volt zöld. **Az őr annyit ér, amennyit az állítása KÉRDEZ** —
ez a kérdés a SZERKEZETRŐL szólt (csukva-e), nem arról, hogy a felhasználó ELŐTT van-e tartalom.
Az új ① a **látható cikkcímek számát** méri (`:visible` + valós bounding box), és a visszarontott
forráson `érkezéskor LEGALÁBB 3 cikkcím LÁTSZIK — 0`-t ír.

### ⛔ A jóváhagyott vázlat NEM azt a felületet modellezte, amit jóváhagytunk

A tegnapi `help-collapse/approved-A.html` **egyhasábos** volt; az éles `/help` **kéthasábos**. A vázlat
soha nem mutatta meg a jobb oldali felszólító dobozt („Válassz témát…") és a mellette üresen álló
~70%-ot. A §2b kapu végigfutott, a tulaj döntött — **egy olyan képen, amiről a bejelentett hiba
hiányzott.** Tanulság: a vázlat SZERKEZETE (hány hasáb, mi áll a másikban) ugyanúgy a terv része,
mint a szín; ha a vázlat egyszerűsít, pont a hibát egyszerűsítheti ki.

### ⛔ A tünet a SZÖVEGRŐL szólt, az ok egy szomszédos CSS-szabály volt

Az „elvágott helyőrző" nem szöveg-hossz kérdés: a `.con form { display: inline }` **(0,1,1)** VERI a
`.con-kb-search { display: flex }`-et **(0,1,0)** → a form a tartalmára zsugorodik (~200 px), a
helyőrző meg 274 px. Ugyanaz a specificitás-minta, mint a `.con a` ↔ `.citui-btn--*` ütközésnél
(2026-09-11). **Ha egy felirat „el van vágva", előbb a DOBOZT mérd, ne a szöveget rövidítsd.**

### ⭐ A saját vázlatom fogott meg egy továbbit

A `display:flex` javítás után **telefonon a helyőrző MÉG MINDIG nem fért ki** (a gomb mellett a mező
~200 px marad). Ezt a mock 390 px-es képe mutatta meg, nem a kód. Megoldás: keskenyen a mező egész
sort kap, a gomb alá kerül. **Egy javítás „elvileg helyes" lehet, és a felhasználó képernyőjén mégis
hatástalan.**

### ⭐ Két hibát a KÉP fogott meg, nem a kód

1. Az indulólap-kártyán a jelölés elvesztette a pirula-formáját (a `.tag` szabály csak a
   lista-fejlécre volt scope-olva), és a nagybetűs csoportcím **folytatásaként** olvasódott:
   „AZ OLDALAM ÜGYFÉL IS LÁTJA" — vagyis a témakör NEVÉNEK látszott.
2. Az üres tudástár fixture-jén (kb-shot) **kétszer** állt ugyanaz a mondat, ráadásul „Nincs találat
   a **keresésre**" olyankor, amikor a felhasználó nem keresett semmit.

### ⭐ A tudásbázis-őr két valós hibát talált a SAJÁT súgó-szövegemben

- „Minden képernyő fejlécében kör alakú súgó-ikon van" — **mérve HAMIS**: a `partnerViews.ts`-ben
  **6 `data-kb-anchor`, 0 `helpLink`** (Partnerek · Partner-lap · Új partner · Bizonylatok ·
  Új bizonylat). A horgony LÁTHATATLAN attribútum: a lefedettség-kapu zöld, az IKON nincs kitéve.
- Az entry `updated:` mezője a mai módosítás mellett `2026-09-06`-on maradt, és ezt a felület
  **kiírja** („Frissítve:") — a lap a saját frissességéről mondott valótlant.

## Amit szállítottunk (tulaj-döntés: „C" változat + a Súgó a menüsor VÉGÉN)

1. **Az első csoport NYITVA renderel** — szerver-oldalon (`<details open>`), tehát JS nélkül is.
2. **A jobb hasáb INDULÓLAP:** kilenc témakör-kártya MIND a 35 cikkcímmel. **Telefonon nem jelenik
   meg** (ott a lista maga az indulólap — a két méret két külön tervezői döntés).
3. **„Súgó" főmenüpont** a konzol fejlécében, utolsóként; a `/help` lapon aktívként kiemelve.
4. **A „Mindet kinyitom/becsukom" a LISTA fölé** került (eddig a jobb, ÜRES hasáb fölé volt igazítva),
   mellé a darabszám-sor, ami JS nélkül is látszik.
5. Bal hasáb **300 → 360 px**; kereső teljes szélességben, telefonon külön sorban.
6. **Tenant-admin `?tab=sugo`:** ugyanígy nyitva érkezik az első csoport, kereső ugyanígy tördel.

**Kontraktus:** `assets/design-refs/console/help-start/` (README + `approved-C.html`). A régi
`help-collapse/README.md` **1. pontja áthúzva** és ide mutat — hogy ne legyen két igazság.

**Őr:** `scripts/help-collapse-check.mts` — 27 állítás a két felületen + 11 konzol-specifikus
(főmenü-elérés `elementFromPoint`-tal, indulólap-teljesség, gombpár-igazítás, helyőrző-befér mérés,
pirula-jelölés, telefonos elrejtés), 8 negatív önteszt. **A visszarontott forráson 10 valódi piros.**

## UTÓSZÁL ugyanaznap (tulaj-kérésre): a Pénzügy súgó-ikonjai

A nyitott tétel LEZÁRVA: mind az öt képernyő (Partnerek · Partner-lap · Új partner · Bizonylatok ·
Új bizonylat) megkapta a `helpLink()`-et a fejlécben, és a puszta konténer-horgony megszűnt.

**A szerkezeti javítás:** a `kb-check --coverage` mostantól **elutasítja a nem-`<a>` elemen ülő
`data-kb-anchor`-t**. Enélkül a kapu azt méri, hogy létezik-e ATTRIBÚTUM, nem azt, hogy az operátor
el tud-e jutni a súgóhoz — pontosan ez tartotta zölden az öt lapot. Visszarontva mérve: pirosra megy.

### ⛔⛔ A pixel-mérés olyat talált, amit nem kerestem

A rendered-őr kiszámolta az ikon kontrasztját: **2,41** — fehéren, **ciánnal**. Ok: a `.con a`
link-szabály **(0,1,1)** VERI a `.con-help`-et **(0,1,0)**, tehát a súgó-ikon **MINDEN**
konzol-képernyőn a link-cián színt hordta a szánt `--citui-muted` helyett, a nem-szöveges vezérlők
3,0-s WCAG-küszöbe alatt. **Ugyanaz a csapda, mint a fizetés-gomb színénél — harmadszor.**
Nem a javítandó helyen találtam: a kérés öt képernyőről szólt, a hiba az egészet érintette.

### ⛔⛔ A javításom előállította a KÖVETKEZŐ csapdát

Az új `.con a.con-help` **(0,2,1)** verte a sötét-sáv szabályt (`.con-phead__band .con-help`,
**(0,2,0)**), így a partner-lap navy fejlécén az ikon muted maradt: **3,03**. Ezt is a mérés fogta
meg, nem a szem — és a küszöb (3,0) **átengedte volna**. Tanulság: **a „még éppen átment" érték
gyanús** — pont azt fedheti el, hogy a szándékolt szabály nem ért hatályba. A küszöb 4,5 lett, a
sötét-felület szabály (0,3,1). Végleges: **4,81 fehéren, 14,57 a navy sávon.**

### ⭐ Két mérés-technikai fogás

1. **A kontrasztot az OPACITY-vel EGYÜTT kell számolni.** A `getComputedStyle().color` nem tud a
   `opacity: 0.8`-ról, tehát nélküle a mérés szebb számot ad, mint amit a szem lát.
2. **A számolás Node-ban fut, nem a lapon:** a `tsx`/esbuild `keepNames`-e `__name(...)` hívást
   injektál a `page.evaluate`-be ágyazott függvényekbe → `ReferenceError` a böngészőben. A lapból
   csak NYERS érték jöjjön ki.

**Őr-bővítés:** 20 rendered állítás az öt képernyőre (betöltés · horgony · `elementFromPoint`-festés ·
a link célja · kontraszt) + 2 új negatív önteszt (eltűnő ikon, visszatérő cián). Önteszt **10/10**.


## HARMADIK KÖR — Elek FK-000 újramérés (friss kontextusú kiértékelő)

A három bejelentett lelet (ERG-2/3/6) **megszűnt** — de a kiértékelő **négy újat** talált a saját
javításomban. Ez a kör tanulsága: **a javítást ne az ítélje meg, aki elvégezte.**

### ⛔⛔ Az elrendezés-csere NÉMÁN vitt el információt

Az indulólap-kártyákkal EGYÜTT kidobtam a régi doboz szövegét is („…a cikk itt nyílik meg, a lista
közben kéznél marad"), és a lapról eltűnt az EGYETLEN mondat, ami megmondta, HOVA nyílik a
kattintott cikk. **Miért nem vettem észre:** a kép mindkét állapotban rendezett. Egy hiányzó ELEM
feltűnik (lyuk marad a helyén); egy hiányzó MONDAT nem — a helyére beköltözik a következő tartalom.
A screenshot-ellenőrzés erre szerkezetileg vak.
→ **Szabály:** felület-rész CSERÉJEKOR előbb írd össze, milyen INFORMÁCIÓT hordozott a régi, és
tételenként döntsd el: átkerül, feleslegessé vált, vagy pótolni kell.

### Tulaj-döntés ①: asztalon a bal lista CSUKVA érkezik

A „C" terv következménye volt, hogy ugyanaz a 9 csoport és 35 cikk **kétszer** állt egy képernyőn.
Mostantól: ha a rács látszik, ő a tartalomjegyzék, a bal oszlop a kilenc csoportfejre zár (a fejek
LÁTSZANAK). Kereséskor nem zár be.

⛔ **A DEGRADÁCIÓ IRÁNYA KÖTÖTT.** A becsukás JS-es, mert a szerver nem ismeri a képernyő
szélességét. Fordítva (alapból csukva + JS nyit telefonon) a JS nélküli telefonos olvasó **nulla**
cikkcímet kapna — pontosan a bejelentett hiba. Így JS nélkül **fölösleg** keletkezik, nem **hiány**.
A feltétel a rács TÉNYLEGES láthatósága (`display`), nem egy ide másolt töréspont-szám.

### Tulaj-döntés ②: az FK-000 5. lépése egy MÁSIK kérdésre válaszolt

A lépésnek nem volt `út:` mezője, ezért a runner a 4. lépés lapján maradt: a képe **bitre azonos**
lett a 4.-kel (md5-egyezés). Az „összkép rendezett?" kézi ítélet ugyanazt a lapot minősítette
kétszer, a kör négy képernyő helyett hármat fedett le — miközben a napló ötöt mutatott.
→ **Kézi ítélet-lépés MINDIG mondja meg, MELYIK képernyőről ítél.** Most a `/report`-ra megy
(eltérő elrendezés-típus), gépi `várd:`-dal. Újrafuttatva a két kép md5-je eltér.

### ⚠️ A saját öntesztem is elavult a viselkedés-változástól

Az ① eset („mind csukva → nulla cikkcím") 1280px-en futott — ahol a mind-csukva **mostantól a
HELYES állapot**. Vagyis egy legitim állapotról állította, hogy megfogja a hibát. Áttéve 390px-re,
ahol nincs rács. **Egy viselkedés-változás a NEGATÍV tesztet is elavulttá teheti.**

### ⚠️ Kapu-ütközés, nem lelet

A `mock-photo-gate-check` 8 bukással állította meg a commitot, majd ENOENT-tel elszállt: a kapu a
KÖZÖS `sites/`-be írja a fixture-jét, és párhuzamos sessionök egymás alól törlik. Szabad kapun
újrafuttatva zöld. ⚠️ A saját várakozóm 52 percig állt, mert a `pgrep -f` a SAJÁT parancssorát is
illesztette — a CLAUDE.md §8-ban dokumentált self-match csapda, most nem `pkill`-ként, hanem
`pgrep`-ként. Helyes minta: `pgrep -f 'mock-photo-gate-check\.mts$'`.
