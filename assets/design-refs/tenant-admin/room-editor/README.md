# KONTRAKTUS — tenant-admin SZOBA-SZERKESZTŐ (D változat)

**Jóváhagyta:** a tulaj, 2026-09-22 (§2b terv-jóváhagyási kapu) · **Változat:** **D — kártyarács
+ felugró + fülek** (a B rácsából, a C füleivel; az A, B, C külön is elvetve) ·
**Terv:** `plan.html` (önhordó, kattintható, MŰKÖDIK) · **Képek:** `D-mobil-*.png`, `D-asztali-*.png`
**Hatókör:** `src/server/moduleConfigViews.ts` · `src/server/public.ts` · `src/tenant/editor.ts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük, nem
fordítva (`feedback_approved_draft_is_the_contract`). A terv a **valós adatból** épült (az
Eldorádó tenant 4 egysége, 6 valódi képe, a 70 tételes felszereltség-katalógus **valódi**
ikonjaival) — nem kézzel rajzolt látvány. Újragenerálás: „Reprodukció" szakasz.

---

## 0. A MÉRT KIINDULÓPONT — mit javít ez a terv

| Mért tény | Hol |
|---|---|
| a 4 szoba **egyetlen, 9 103 px hosszú görgetés** mobilon (asztalin 6 422 px), kinyitás nélkül | `/admin?tab=modulok&m=rooms`, mérve 2026-09-21 |
| **egy szoba két helyen szerkesztődik**: név+férőhely a „Mit ad ki?" kártyán, leírás+képek külön űrlapon | `moduleConfigViews.ts` — `unitsCard()` és `unitContentCards()` |
| **borítókép-fogalom nincs**: a honlap a szobához rendelt ELSŐ képet mutatja, a KÖZÖS galéria sorrendjében | `src/tenant/editor.ts` — `const mine = unitPhotos.get(u.id) ?? []; const own = mine[0];` |
| ennek mért következménye: a **Tetőtéri Appartman és a Kerti faház UGYANAZT a fotót mutatja** a honlapon | dev DB, `edited_site_data.photos` — a `p3` kép mindkét egység első képe |
| a felszereltség-választó **kinyitva** ül minden szoba-űrlapon (70 tétel × 4 szoba) | `amenityPicker()` a `unitContentCards`-ban |

⛔ **Egyetlen globális sorrend nem tud N független borítót kiszolgálni** — ezért a szobánkénti
borító ÖNÁLLÓ, választható fogalom, nem a galéria-sorrend mellékterméke (ADR-0198).

---

## 1. A RÁCS (a szobák listája) — KÖT

A szobák **kártyarácsban** állnak, és a kártya **azt mutatja, amit a vendég lát a honlapon**.

**KÖT — a kártyán EZ van:**

1. a **borítókép** (nincs borító → őszinte „nincs borítókép" doboz, nem üres szürke folt)
2. a képen jobb alul **jelvény**: több képnél `N kép`, egyetlen képnél `Részletek` — ⛔ soha
   nem „1 kép" (az galériát ígérne). Ez a publikus szoba-kártya kontraktusának
   (`design-refs/tenant-site/rooms-card/`) tükre: az admin ugyanazt a feliratot mutatja, amit
   a vendég kap.
3. a szoba **neve**
4. a **férőhely** (hiányzó érték → `férőhely nincs megadva`, nem üres sor) + az egész háznál
   `az egész ház`
5. **állapot-jelvény**: `Van saját oldala` (zöld) vagy `Hiányos` (borostyán)
6. **ütközés-jelvény**, ha a borító másik egység borítója is: `ugyanaz a borító, mint: <név>`

**Elrendezés — KÖT:** mobil **két oszlop** (mind a 4 szoba egy képernyőn), asztali **négy oszlop**.
A rács alatt `Új egység felvétele`.

- ⛔ **KÖT: a jelvény a SZÖVEGÉIG ér, nem a kártya széléig** (`justify-self:start`) — rács-cellában
  a nyújtás az alapértelmezés, és attól teljes szélességű sávnak látszik.
- ⛔ **KÖT: a jelvény szövege NEM vágódhat le, inkább törjön két sorba.** Mérve: `white-space:nowrap`
  mellett a „Nincs saját oldala — hiányzik: leírás vagy felszereltség" **94 px-nyi darabja** a
  kártya `overflow:hidden`-je alá esett — a tulaj pont AZT nem olvashatta el, ami hiányzik.
  A görgető-doboz túlcsordulása közben **0 px-t** mutatott, tehát ezt a mérést SZÖVEG-SZINTEN
  kell elvégezni.
- ⛔ **KÖT: a státusz-jelvény megtartja a SZEMANTIKUS színét.** Mérve: egy `.rs-gbd span`-szerű
  (0,1,1) szabály **megette** a jelvény (0,1,0) színét, mind a 4 jelvény semleges szürke lett
  (`rgb(96,116,139)`), a kontraszt 5,5-ről 4,2-re esett. A kártya-testben a leíró szöveg
  szabálya NEM érintheti a jelvényt (`:not()` vagy magasabb specificitás).
- ⛔ **KÖT: az ütközés-jelvény a RÁCSON is ott van**, nem csak a felugróban — ez a mai, valódi
  hiba egyetlen látható jelzése.

---

## 2. A FELUGRÓ — KÖT

A kártyára koppintva **felugró** nyílik (nem lapváltás, nem új oldal).

- **KÖT: mobilon majdnem teljes képernyő, de LÁTHATÓ kerettel** — mérve 372/390 × 750/780 px.
  Ha kitöltené a keretet, már nem felugrónak, hanem másik oldalnak olvasódna.
- **KÖT: asztalin középre zárt párbeszéd** (`min(960px, 92%)`), a **rács mögötte marad** és
  látszik. ⛔ Asztalin a teljes felület elborítása tilos: 1280 px-en az a lista eltakarása.
- **KÖT: a háttér elsötétül** (backdrop), és **a háttérre kattintva bezár**.
- **KÖT: az ESC bezár.**
- **KÖT: a fejlécben** bezáró gomb + a szoba **neve** + a férőhely.
- **KÖT: a Mentés a felugró ALJÁN, rögzített lábazatban áll** — a törzs görget, a lábazat nem
  mozdul, tehát a Mentés **görgetés nélkül** elérhető marad. ⚠️ Ezt **kifestve** kell mérni:
  egy teljes-lapos screenshot a nem-tapadó sávot is a végleges helyére festi, és zöldnek mutatja.

### A három fül — KÖT

`Alapok` · `Képek <N>` · `Felszereltség <N>` — a számláló a fülön áll, élőben frissül.

---

## 3. „ALAPOK" FÜL — KÖT

- **név**, **férőhely**, **leírás** — egy helyen. ⛔ **KÖT: a név és a férőhely IDE kerül**, nem
  külön kártyára: ma egy szoba két űrlapon szerkeszthető, és a tulaj nem tudja, melyik hol van.
- **KÖT: a thin-content állapot (ADR-0044 §13) ÉLŐBEN újraszámol** gépelés közben —
  van fotó ÉS (leírás VAGY felszereltség) → `Van saját oldala: /apartman/<slug>`; különben
  **megnevezi, MI hiányzik** (fotó / leírás vagy felszereltség).
- **KÖT — asztali külön tervezői döntés:** két hasáb, jobb oldalon **ÉLŐ vendég-előnézet**
  (borító + név + férőhely + a jelvény), ami gépelés közben frissül. ⛔ Egyetlen 1200 px széles
  mezősor nem elrendezés.
- **KÖT: az előnézet a publikus kártya-kontraktus SZERINT mutat** — borító, név, férőhely,
  jelvény, és **semmi más** (`design-refs/tenant-site/rooms-card/README.md` §1).

---

## 4. „KÉPEK" FÜL — a terv magja, KÖT

Sorrendben, felülről:

1. **nagy borító-előnézet**, rajta felirat, ami kimondja, hogy ez megy ki a honlapra
2. **ütközés-figyelmeztetés**, ha a borító másik egység borítója is (megnevezi, melyiké)
3. **`Kép feltöltése`** — elsődleges gomb, a **fül tetején**
4. a **ház KÖZÖS képtára** rácsban

### 4.1 Feltöltés — KÖT

- **KÖT: a helyben feltöltött kép a KÖZÖS képtárba kerül, ÉS ehhez az egységhez rendelődik**
  (ADR-0044 §11: a tulaj **egyszer** tölt fel és megjelöli, hova tartozik). ⛔ Egységenkénti
  külön képtár, ami ugyanazt a képet kétszer kéri, tilos.
- **KÖT: az üzenet mindkét felét kimondja** („a közös képtárba került" **és** „hozzárendeltem
  ehhez az egységhez") — különben a tulaj nem érti, miért látja a képet másik szobánál is.
- **KÖT: a feltöltés NEM írja át a meglévő borítót.** Az némán megváltoztatná, amit a honlap
  mutat. Ha viszont **nem volt** borító, az első feltöltött lesz az — és ezt az üzenet kimondja.
- **KÖT: valódi validáció, valódi üzenettel**, a mai szerver-korlátok szerint
  (`public.ts` `POST /admin/photos`): JPEG/PNG/WEBP, **6 MB/kép**, **12 kép/feltöltés**,
  **24 kép a képtárban**. A hiba **megnevezi a fájlt és az okot**, és **hiba-ként** jelenik meg
  (nem sikerként). Részleges siker esetén mindkét fél látszik.
- ⛔ **KÖT: a feltöltő vezérlő nem a kép-szalag VÉGÉN áll.** Mérve: ott a negyedik kép után
  kiszorult a vízszintes görgetésbe, vagyis a tulaj legfőbb kérése a képen nem is látszott.

### 4.2 A közös képtár rácsa — KÖT

- **KÖT: a ház ÖSSZES képe látszik**, nem csak a szobához rendeltek.
- **KÖT: a nem hozzárendelt képek HALVÁNYAK** (mérve `opacity: 0,45` vs `1`), így ránézésre
  látszik, mi tartozik ide.
- **KÖT: a pipa rendel hozzá, a csillag tesz borítóvá.**
- ⛔ **KÖT: a csillag egy még nem hozzárendelt képen HOZZÁ IS RENDEL**, és ezt kimondja —
  tiltott, semmit nem csináló gomb helyett. (A tiltott gomb vagy nézzen ki tiltottnak, vagy
  ne legyen; itt a harmadik út a helyes: csináljon értelmes dolgot.)
- **KÖT: a levétel (×) kimondja, hogy a kép a KÖZÖS KÉPTÁRBAN MARAD** — különben a tulaj azt
  hiszi, törölte. Ha a levett kép volt a borító, a **sorban következő lép a helyébe**, és ha
  nem maradt kép, azt is kimondja („most nincs borító, a honlap kártyáján nem lesz kép").
- **KÖT: asztalin a rács hat oszlopra nyílik** (a szélesebb hely VISZ valamit).
- **KÖT: a borító-váltás AZONNAL átírja a mögötte lévő kártyát** — a tulaj a felugró bezárása
  nélkül lássa, mit tett.

---

## 5. „FELSZERELTSÉG" FÜL — KÖT

- **KÖT: a kiválasztott tételek KOMPAKT csempeként** állnak (ikon + felirat + törlő ×), nem
  kinyitott 70 tételes rácsként. A katalógus egy gombra nyílik, **kereshetően**.
- **KÖT: a katalógus-ikon a 70 tételes készletből jön** (`src/tenant/amenityCatalog.ts`,
  `amenityByLabel` + `amenitySvg`). Mérve: a 17 tárolt címke **mind** pontos katalógus-találat.
  Katalóguson kívüli, kézzel írt tétel is megjelenik — csak ikon nélkül.
- ⛔ **KÖT: ÜRES felszereltségnél a katalógus RÖGTÖN nyitva van.** Mérve: csukva a fül egy nagy
  fehér semmi volt egyetlen gombbal (a tartalom a doboz **21 %-át** töltötte ki). ⚠️ Ezt a
  kitöltöttséget a TÉNYLEGES tartalom aljával kell mérni — a `scrollHeight/clientHeight` rövid
  tartalomnál 100 %-ra csuklik, és az üres lapra is zöldet ad.
- **KÖT: a tétel csak EBBEN az egységben meglévő dolgokat sorol**; a ház egészére vonatkozók a
  Felszereltség modulnál maradnak.
- ⛔ **KÖT (ADR-0074 §5): `rooms` ÉS `amenities` modul nélkül NINCS szerkeszthető vezérlő**,
  helyette **konverziós panel**: ajánlat + **halvány, VALÓDI** csempék + a katalógus valódi
  számai (a maradék tételek és a kategóriák darabszáma a katalógusból számolva, nem beégetve).
  ⛔ Hibaüzenet helyett ajánlat.

---

## 6. AMI MINDEN MÉRETRE KÖT

- **KÖT: minden szín/betű/sarok a `--citui-*` dizájn-magból** (`public/assets/ui/citui.css`,
  `citui-admin.css`) — nyers hex tilos, ikon a közös készletből (`src/ui/icons.ts`), **emoji tilos**
  (ADR-0021 ①).
- **KÖT: nincs vízszintes túlcsordulás** sem 390 px-en, sem 1280 px-en.
- **KÖT: minden mért felirat kontrasztja ≥ 4,5** (AA kisméretű szövegre). ⚠️ A `color-mix()`
  háttér a böngészőből `color(srgb 0.97 0.94 0.87)` alakban jön — **0–1 lebegőpontos**, nem
  0–255. 0–255-ként olvasva egy világos háttér majdnem feketének mérődik, és „éppen átment"
  3,2-es álértékeket ad. A kontraszt-mérőnek **mindkét szín-alakot** kezelnie kell.
- **KÖT: nulla JS-hiba.**
- **KÖT: a felület JS NÉLKÜL sem veszít funkciót.** A mai szerkesztő űrlap-alapú és `<details>`-szel
  működik JS nélkül (a naptár és a kép-választó ugyanezt a szabályt követi); a terv a JS-sel
  gazdagított viselkedést mutatja, de a szállított felület megtartja a JS nélküli utat.

---

## 7. Amit a terv NEM dönt el

- **hova kerül a szobánkénti borító az adatmodellben** (jelölés a fotón vs. egységenkénti
  sorrend vs. `site_unit` oszlop) — megvalósítási döntés, az ADR-0198 nyitva hagyja.
- az egység **felvétele/törlése**: a mai viselkedés marad, a vázlatban szándékosan nincs bekötve.
- a **Mentés** tranzakciós határa (egy gomb menti-e a szöveget és a képeket együtt, ahogy ma).

---

## 8. Reprodukció

A generátor és a mérő a `_drafts/` alatt született, amit a `land.sh` törli — ezért kimentve:
`~/rc-briefs/rooms-admin-ref/` (`build-admin-fixture.mts`, `build-admin-plan.mts`,
`check-admin-plan.mts`, `admin-fixture.json`).

```bash
# a fixture a TERMÉK forrásából épül (dev DB + valódi ikon-resolver), nem kézzel:
npx tsx <ref>/build-admin-fixture.mts      # → admin-fixture.json
npx tsx <ref>/build-admin-plan.mts         # → plan.html
npx tsx <ref>/check-admin-plan.mts --shots # a MŰKÖDÉS mérése + állapot-képek
```

A `plan.html` kapcsolói — **Változat (D/A/B/C) · Méret (mobil 390/asztali) · Adat (valós/kitöltött
minta) · Felszereltség modul (be/ki)** — a terv részei: a jóváhagyás **mind a négy tengelyen**
megtörtént. Mérve a jóváhagyáskor: **103 állítás zöld, 0 JS-hiba.**

---

## 9. A KÖTŐ FELIRATOK ÉS HORGONYOK MEGJELÖLÉSE — a megvalósítás UTOLSÓ lépése

⚠️ A `contract-drift-check` őr a félkövér-magyar-idézőjeles alakot olvassa kötő feliratként, és
megköveteli, hogy a felirat ÉLJEN a **Hatókör** alatti fájlokban; ugyanígy a lenti horgony-lista
elemeinek (CSS-osztály, `data-*` horog) is léteznie kell. Egy kontraktus, ami a megvalósítás
ELŐTT születik, ezért még **egyetlen feliratot és horgonyt sem jelölhet meg** — nincs mit
ellenőrizni, és a hamis jelölés jogosan buktatná a kaput.

⛔ **És a horgony-szakasz CÍMÉT sem szabad a szövegben leírni** (mérve, 2026-09-22): az őr a
szakaszt egy fejléc-mintával keresi, tehát a prózába idézett cím egy KORÁBBI helyen fogta meg,
és a valódi listából **nulla horgonyt** olvasott be — zölden, mert ami nincs beolvasva, azt nincs
is mit buktatni (`feedback_registration_count_must_be_read_back`: a regiszter kimenetéből
olvasd vissza a darabszámot).

**Megtörtént** (2026-09-22, a megvalósítással egy körben). Az alábbiak a ténylegesen szállított
`T()` **argumentumok** — nem a képernyőn látott összefűzött mondatok
(`feedback_composed_sentence_is_not_a_quotable_label`). Ahol a felirat behelyettesítést tartalmaz,
a `{…}` a kulcs része, és azt is így idézzük: a kapu a forrás-stringet keresi, nem a kirajzolt
szöveget.

### A rács

- **„A szobái"** — a szakasz címe
- **„A kártya azt mutatja, amit a vendég lát a honlapon. Koppintson rá — a szerkesztő felugrik."**
- a jelvény három alakja: **„{n} kép"** · **„Részletek"** (egyetlen képnél, mert az „1 kép”
  galériát ígérne) · **„nincs kép"**
- az állapot: **„Van saját oldala"** / **„Hiányos"** (a kártyán), és **„Nincs saját oldala —
  hiányzik: {mi}"** (az Alapok fülön, a hiányzó részek nevével)
- a borító-ütközés: **„ugyanaz a borító, mint: {names}"**
- **„nincs borítókép"** — az őszinte doboz üres borító helyén
- **„Új egység felvétele"**

### A felugró

- a három fül: **„Alapok"** · **„Képek"** · **„Felszereltség"**
- a lábazat: **„Mentés"** · **„Egység törlése"**
- Alapok: **„Az egység neve"** · **„Férőhely"** · **„Leírás"** · **„Ezt látja a vendég a honlapon"**

### Képek fül

- a nagy borító-előnézet felirata: **„Ezt mutatja a honlap ezen a kártyán"**
- üres borítónál: **„Ennek az egységnek még nincs borítóképe — a honlap kártyáján nem lesz kép."**
- a feltöltés: **„Kép feltöltése"**, mellette **„A feltöltött kép a közös képtárba kerül, és ehhez
  az egységhez rendelem."**
- a nyugtázás mindkét fele: **„{n} kép bekerült a közös képtárba, és hozzárendeltem ehhez az
  egységhez."** és — csak ha nem volt borító — **„Mivel nem volt borítóképe, az első feltöltött
  lett a borító."**
- a visszautasítás megnevezi az okot: **„nem kép (JPEG, PNG vagy WEBP kell)"** ·
  **„a legnagyobb feltölthető méret 6 MB"** (a fájl nevét a felület a fájlból írja mellé)
- a képtár: **„A ház közös képtára"**, a csillag súgója: **„Ez legyen a borítókép"**
- borítóvá tétel: **„A honlap ezentúl ezt a képet mutatja {art} {name} kártyáján."**, és ha még
  nem tartozott ide: **„Egyben hozzá is rendeltem ehhez az egységhez."** (⛔ a névelő `{art}`
  behelyettesítés, nem „a(z)": azt a `huArticleLower()` dönti el a névből — a gépies alakot a
  `hu-machine-form-check` jogosan buktatta)
- a levétel: **„A kép lekerült erről az egységről. A közös képtárban benne marad, más szobánál is
  állhat."**, kiegészítve **„Ez volt a borítókép, ezért a sorban következő lépett a helyébe."**
  vagy **„Ez volt a borítókép — most nincs borító, a honlap kártyáján nem lesz kép."**

### Felszereltség fül

- **„Hozzáadás a listából"** (⛔ szándékosan darabszám NÉLKÜL: a „70 tételes lista” attól a
  pillanattól hazudna, hogy a katalógus bővül)
- **„Csak azt sorolja fel, ami EBBEN az egységben van. A ház egészére vonatkozó tételek a
  Felszereltség modulnál maradnak."**

## Kötő horgony

- `rs-modal` — a felugró kerete; a `:target` ezen ül, ettől nyílik JS nélkül
- `rs-backdrop` — az elsötétülő háttér, egyben a bezáró felület
- `rs-pop__foot` — a RÖGZÍTETT lábazat, amiben a Mentés görgetés nélkül elérhető marad
- `rs-tabin` — a fül-rádiógomb (a fülváltás JS nélküli mechanizmusa)
- `rs-pane` — egy fül tartalma (a CSS ebből mutat egyet)
- `rs-gcard` — a szoba kártyája a rácsban
- `rs-b--clash` — a borító-ütközés jelvénye (a rácson IS, nem csak a felugróban)
- `rs-hero` — a nagy borító-előnézet a Képek fülön
- `rs-libcell` — a közös képtár egy cellája (pipa = hozzárendelés)
- `rs-libcov` — a csillag: borítóvá tesz, és hozzá is rendel
- `set_cover` — a borító-váltás mezőneve (ugyanannak az űrlapnak a submitja)
- `coverFor` — a szobánkénti borító tárolási mezője a fotó-rekordon (ADR-0198 ①)
- `data-rs-upload` — a helyben feltöltés horga
- `data-rs-msg` — a nyugtázó üzenet helye a Képek fülön

## 10. AMIT A MEGVALÓSÍTÁS ELDÖNTÖTT (a §7 nyitott kérdései)

- **A borító tárolása: jelölés a FOTÓ-rekordon** (`coverFor?: string[]`, a meglévő `units?:
  string[]` mintájára, migráció nélkül; a `carryPhoto()` viszi tovább). Egy kép több egység
  borítója is lehet, és a jelölés mozgatása nem nyúl sem a ház nyitóképéhez (`photos[0]`), sem
  másik egység borítójához. Feloldás EGY függvényben (`unitCoverPhoto`), amit a publikus render
  és az admin is hív — jelölés hiányában a MAI szabály a tartalék (az első hozzárendelt kép),
  tehát aki soha nem nyúl hozzá, azt látja, amit eddig.
- **A levétel** nem külön „×" gomb, hanem a pipa levétele + Mentés; a kötő üzenet ugyanaz, és a
  szerver az ÁLLAPOT-KÜLÖNBSÉGBŐL ismeri fel (nem egy szándék-mezőből), tehát a szokásos úton is
  jár a mondat.
- **A Mentés tranzakciós határa** a mai marad: egy gomb menti a szöveget, a képeket és a
  felszereltséget együtt; a csillag ugyanennek az űrlapnak a submitja.
- **JS nélkül** a felugró (`:target`), a fülváltás (rádió + CSS), a hozzárendelés, a borító-váltás
  és a mentés MIND működik. A helyben feltöltés JS-t igényel — ahogy a Fotók fülön ma is, mert a
  terméknek nincs multipart-értelmezője; ez tehát nem veszteség a JS nélküli úton.
- **Egyetlen egységnél** a mai képernyő marad (nincs mit „átlátni", és saját aloldal sem
  születik) — a rács két egységtől jelenik meg.

**Az őr:** `npx tsx scripts/room-editor-check.mts` — végigkattintja a valódi felületet mindkét
méreten, JS-sel és JS nélkül, és a végén NEGATÍV KONTROLLOKAT futtat (a visszarontott állapoton
pirosra kell mennie). `--shots` kapcsolóval állapot-képeket is ment.
