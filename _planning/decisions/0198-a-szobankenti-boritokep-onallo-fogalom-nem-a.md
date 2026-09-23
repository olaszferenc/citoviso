## ADR-0198 — A szobánkénti BORÍTÓKÉP önálló fogalom, nem a galéria-sorrend mellékterméke (2026-09-22)

**Kiváltó tulajdonosi kérés:** „A szobák modul kinézete legyen kártya típusú és kinyitható, hogy
a szállásadó jobban átlássa. A képeknél lehessen feltölteni képet, ami megy rögtön a tárolt
minden képbe. Be lehessen állítani a borítóképet, amit mutat a honlap adott szobára."
**Státusz:** a §2b terv-kör lezárva, a **D változat jóváhagyva** (2026-09-22). Kontraktus:
`assets/design-refs/tenant-admin/room-editor/`. A megvalósítás még nem indult.

### ① A DÖNTÉS

**A szobánkénti borítókép ÖNÁLLÓ, a tulaj által választható fogalom** — nem a közös galéria
sorrendjének mellékterméke.

Az ADR-0044 §15 kimondta, mi hat a galérián: **sorrend + nyitókép + képaláírás**. A HÁZ
nyitóképe ezért ma a `photos[0]`, és a „legyen ez a borító" = előrehozás. A **szobánkénti**
borító viszont ugyanezzel a mechanizmussal **nem megoldható**, és ezt nem elvi alapon mondjuk ki,
hanem mérve:

- a szoba borítója ma `src/tenant/editor.ts` — `const mine = unitPhotos.get(u.id) ?? []; const own = mine[0];`,
  ahol a `photosByUnit` a **közös galéria sorrendjét** őrzi;
- **egyetlen globális sorrend nem tud N független borítót kiszolgálni**: egy kép több szobához is
  tartozhat (ADR-0044 §11), és az előrehozás a HÁZ nyitóképét is átírja;
- a dev DB-n mérve: a `p3` kép a **Tetőtéri Appartman** ELSŐ képe és a **Kerti faház** EGYETLEN
  képe, tehát **a honlapon ma két szoba-kártya ugyanazt a fotót mutatja**, és a tulajnak nincs
  eszköze ezt orvosolni.

⛔ **A tárolás módját ez az ADR SZÁNDÉKOSAN nyitva hagyja** (jelölés a fotó-rekordon, egységenkénti
sorrend, vagy `site_unit` oszlop). A döntés a FOGALOMRÓL szól; a modell a megvalósításé.
**Amit viszont KÖT:** a borító-váltás nem írhatja át a ház nyitóképét, és nem mozdíthatja el
másik szoba borítóját.

### ② A FELTÖLTÉS HELYE — a tulaj kérése EGYEZIK az ADR-0044 §11-gyel

„…ami megy rögtön a tárolt minden képbe" pontosan az **EGY KÖZÖS KÉPTÁR, hozzárendeléssel**
szabály: a szoba-szerkesztőben feltöltött kép a **közös** tárba kerül, ÉS hozzárendelődik ahhoz a
szobához. ⛔ Egységenkénti külön képtár, ami ugyanazt a képet kétszer kéri, továbbra is tilos.
A felület **mindkét felét kimondja**, különben a tulaj nem érti, miért látja a képet másik
szobánál is.

**KÖT: a feltöltés nem írja át a meglévő borítót** — az némán megváltoztatná, amit a honlap
mutat. Ha nem volt borító, az első feltöltött lesz az, és ezt az üzenet kimondja.

### ③ A FELÜLET — D változat (kártyarács + felugró + fülek)

A §2b kör három változatot vitt a tulaj elé (A lista · B kártyarács · C fülek); a tulaj a
**B rácsát a C füleivel, felugróban** kérte. A mért kiindulópont, amit ez javít: a 4 szoba ma
**9 103 px hosszú görgetés** mobilon (asztalin 6 422), egy szoba **két külön űrlapon**
szerkeszthető, és a felszereltség-választó mind a négy szobánál kinyitva ül.

A részletes, kötő leírás a kontraktusban áll. Ami ADR-szintű:
**asztalin a felugró nem boríthatja el a listát** (középre zárt párbeszéd), és
**a szélesebb képernyő két külön tervezői döntés** (Alapok fül: űrlap + élő vendég-előnézet;
Képek fül: hatoszlopos képtár).

### ④ HAT HIBA A TERV-KÖRBEN — NÉGYET A KÉP FOGOTT MEG, KETTŐT A SAJÁT MÉRŐM HAZUDOTT

⛔ **Amit a gépi mérés átengedett, és a KÉP mutatott meg:** ① a státusz-jelvény 94 px-nyi
darabját levágta a kártya (`overflow:hidden`), és pont AZT nem lehetett elolvasni, AMI HIÁNYZIK
— a görgető-doboz túlcsordulása közben **0 px** volt ② a feltöltő csempe a kép-szalag végén
asztalin kiszorult a vízszintes görgetésbe, vagyis a tulaj LEGFŐBB kérése a képen nem is látszott
③ a terv címsora **navy-on-navy** volt (kontraszt **1,00**), mert a `citui.css` a `h1`-nek saját
sötét színt ad, és a sötét sáv `color` öröklése ezt nem írja felül ④ a felugró Felszereltség
füle üres szobánál egy nagy fehér semmi volt (**21 %** kitöltöttség).

⛔⛔ **És KÉT hamis zöld a saját mérőmben — mindkettő MÁS okból:**

- **Az „eltűnt az ütközés-figyelmeztetés" állítás ZÖLDRE ment**, miközben a két jelvény ott volt a
  DOM-ban, helyesen frissítve: a kattintás **auto-görgetése** tolta ki őket a keret látható
  ablakából (y = −275 px). Egy keret-metszetre épülő mérés **alkalmatlan annak bizonyítására,
  hogy valami MEGSZŰNT** (`feedback_autoscroll_hides_offscreen_control`).
- **A kontraszt-mérőm rosszul olvasta a színt:** a `color-mix()` a böngészőből
  `color(srgb 0.97 0.94 0.87)` alakban jön — **0–1 lebegőpontos** —, amit 0–255-ként olvasva egy
  világos háttér majdnem feketének mérődik. Így a warn/clash jelvény **3,32-re és 3,21-re** jött
  ki: „éppen átment" értékek, amik valójában mérési hibák voltak. A javított mérés 5,53 és 5,57.
  ⭐ A gyanú pontosan onnan jött, hogy a küszöb körüli érték önmagában gyanús
  (`feedback_barely_passing_value_hides_a_dead_rule`) — a szabály másodszor is fizetett.
- **Egy harmadik állítás önmagát tette lehetetlenné:** a „kitölti-e a felugrót" mérés
  `scrollHeight/clientHeight`-tal dolgozott, ami **100 %-ra csuklik**, ha a tartalom rövidebb a
  doboznál — tehát az ÜRES lapra is zöldet adott.

⭐ **Egy negyedik lelet CSAK a szigorított mérésből jött elő:** a kártya státusz-jelvényének
színét egy leíró-szöveg szabály **(0,1,1) verte** a jelvény (0,1,0) színe fölött, ezért mind a 4
jelvény semleges szürke lett és a kontraszt 5,5-ről 4,2-re esett — ugyanaz a specificitás-ütközés,
mint amikor egy link-szabály ette meg a gomb színét (`feedback_link_rule_eats_button_label`).

Mindegyik javításhoz **negatív kontroll** készült (a javítás előtti állapoton piros), a záró
mérés **103 állítás zöld, 0 JS-hiba**, valós adaton, mobil és asztali méreten.

### ⑤ AMI NYITOTT

- a megvalósítás (a kontraktus a szerződése); a **kötő feliratok és horgonyok megjelölése a
  megvalósítás UTOLSÓ lépése** — a terv előtt megjelölni nem létező szöveget a kapu jogosan buktatná
- a szobánkénti borító **tárolási modellje** (①)
- a **JS nélküli út** megtartása: a mai szerkesztő űrlap-alapú és `<details>`-szel működik JS
  nélkül; a terv a JS-sel gazdagított viselkedést mutatja, a szállított felület nem veszítheti el
  a másikat

### ⑥ A MEGVALÓSÍTÁS — és a nyitva hagyott tárolási modell eldöntve (2026-09-22)

**A felület leszállítva** (kártyarács + `:target`-felugró + rádió-gombos fülek). Az ⑤ mindhárom
nyitott pontja lezárva:

**A tárolási modell: jelölés a FOTÓ-rekordon** — `PhotoEdit.coverFor?: string[]`, a meglévő
`units?: string[]` mintájára, **migráció nélkül**, és a `carryPhoto()` viszi tovább (e nélkül az
első átrendezés csendben ledobná, pontosan úgy, ahogy a `watermarked` mezővel megtörtént). Miért
ez, és nem a másik kettő:

- **lista, nem egy id**, mert egy kép több egység borítója is lehet (ADR-0044 §11), és mert így a
  jelölés mozgatása SOSEM nyúl másik egység borítójához — az invariánst nem betartjuk, hanem a
  modell alakja teszi megsérthetetlenné;
- a **galéria-sorrend érintetlen**, tehát a ház nyitóképe (`photos[0]`) nem mozdul — ez az a
  csapda, ami miatt a „legyen ez a borító" = előrehozás mechanizmus nem volt használható;
- **`site_unit` oszlop helyett** a fotó-rekord, mert így a megosztott képtár minden szabálya
  (hozzárendelés, sorrend, törlés) EGY rekordra vonatkozik, és a törölt kép magával viszi a
  jelölését — külön oszlopnál árva sor maradna.

**Feloldás EGY függvényben** (`unitCoverPhoto`), amit a publikus render ÉS az admin is hív; jelölés
hiányában a MAI szabály a tartalék (az első hozzárendelt kép), tehát aki soha nem nyúl hozzá,
pontosan azt látja, amit eddig. ⭐ Ez teszi a bevezetést visszamenőleg is némává: nincs migráció,
nincs „minden szoba borítója eltűnt" pillanat.

**A JS nélküli út MEGMARADT, és mérve is van:** a felugró `:target`-tel nyílik, a fülváltás
rádió-gomb + CSS, a hozzárendelés/borító-váltás/mentés pedig ugyanannak az egy űrlapnak a
submitja. Kikapcsolt JS mellett az őr végigmegy rajta (felugrás, fülváltás, képtár, mentés). A
**helyben feltöltés** JS-t igényel — ahogy a Fotók fülön ma is, mert a terméknek nincs
multipart-értelmezője; ez tehát nem veszteség, hanem a MAI állapot megtartása. Kimondva, nem
elhallgatva.

**A levétel nem külön „×"**, hanem a pipa levétele + Mentés; a kötő üzenet („a közös képtárban
benne marad" + mi lett a borítóval) ugyanaz, és a szerver az **állapot-különbségből** ismeri fel,
nem egy szándék-mezőből — különben a legfontosabb mondat pont a szokásos úton maradna el.

**Egyetlen egységnél a mai képernyő marad:** ott nincs mit „átlátni", és saját aloldal sem
születik (annak feltétele több egység), tehát a rács `Van saját oldala` jelvénye olyat állítana,
ami egy egységnél nem igaz.

⭐ **Két lelet a saját munkámból, amit a mérés fogott meg:** ① a `history.replaceState` **nem
értékeli újra a `:target`-et** — az ESC „megtörtént", a felugró meg nyitva maradt ② a kontraktus
horgony-listájából **nulla** elem került be, mert a szakasz CÍMÉT a §9 prózája is leírta, és az őr
a korábbi előfordulást fogta meg (a regiszter kimenetéből visszaolvasva derült ki: 40 → 54).

**Őr:** `scripts/room-editor-check.mts` — a valódi felületet kattintja végig mindkét méreten,
JS-sel és JS nélkül, és a végén **hat negatív kontroll** fut (a visszarontott állapoton pirosra
kell mennie). A kontraktus kötő feliratai és horgonyai megjelölve (README §9), a
`contract-drift-check` és a KB-kapu zöld.
