# Operátor lead-lista (`/leads`) — jóváhagyott terv

**Két jóváhagyás van ezen a fájlon, és a második FELÜLÍRJA az első kettő pontját.**

| | Dátum | Mit hagyott jóvá a tulaj | Referencia |
|---|---|---|---|
| **A** | 2026-09-14 | *Tábla, ragadó NÉV oszloppal* | `plan.html`, `A-asztali.png`, `A-mobil.png` |
| **A2** | **2026-09-19** | **Egysoros fejléc · EGY „?” → felugró · NINCS lapozás · a cím alatti két szöveg-blokk KIVÉVE** | `plan-A2.html`, `A2-asztali.png`, `A2-mobil.png`, `A2-sugo-felugro-*.png` |

Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.
Őr: `scripts/lead-list-plan-check.mts` (piros önteszttel). Döntés: **ADR-0188**.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl — a `contract-drift-check`
> pontosan azokat keresi vissza a kódban. A változat NEVE nem felirat, ezért nem abban az
> alakban áll. Futásidőben ÖSSZERAKOTT mondat (szám, oszlopnév) nem felirat, hanem példa.

Az elvetett B változat (2026-09-14) bent marad (`B-elvetett-*.png`) — hogy a döntés MIRE
mondott nemet, az is dokumentálva legyen.

---

## A2 (2026-09-19) — amit a tulaj MONDOTT, és amit ebből köt

> *„itt változtatni kell a segítség nem kell egy ilyen sávba, max, egy kattintható kérdőjel
> és onnan popup… ne lapok legyenek, hanem minden rekord (ha több száz vagy ezer lesz akkor
> azt majd kezelni kell)… az eredménytábla fejléce katasztrofális, nézd meg! csili csálé,
> semmi nagyvállalati érzet, minek ennyi kérdőjel stb”*
> …majd a vázlatra: *„A változat de ez nem kell”* (a számláló-sor és a szűrő/sorrend-mondat).

### ①′ A jelmagyarázat FELUGRÓ, nem sáv — és EGY „?” van az egész felületen

- A tábla fölötti `<details>` **sáv megszűnt**, a **11 fejléc-„?” gomb megszűnt**.
- A cím mellett **egyetlen** kerek „?” áll; megnyomva felugró ablak nyílik, ami **mind a 11
  oszlopot** megnevezi, plusz a cellán belüli jelöléseket. Zárás: **×**, **ESC**, vagy a
  háttérre kattintás; a fókusz visszatér a gombra.
- ⚠️ **AMI NEM VÁLTOZOTT:** az eredeti indok a fejléc-gombokra az volt, hogy a `title`
  elemleírás **érintőképernyőn elérhetetlen**, a tulaj pedig telefonról dolgozik. A felugró
  ezt jobban oldja meg (egy gomb, ujjal, minden oszlop) — a jelentés tehát **nem veszett el**.
- A **`console.leads` tudásbázis-horgony a felugró lábazatában él**, feliratos linkként
  (**„Részletes súgó a tudásbázisban”**). A cím mellől eltűnt ikonos súgó-link nem viheti
  magával a horgonyt: a `kb-check --coverage` azt méri, hogy a kézikönyvbe vezető út kint
  van-e a képernyőn.

### ②′ NINCS LAPOZÁS — minden rekord egy lapon

- **Se felső, se alsó lapozó.** Megszűnt a `‹ Előző` / `Következő ›` / `Mind a N egy lapon` /
  `Lapozva`, a `?page=` és a `?pageSize=` paraméter, és a `LEAD_PAGE_SIZE` konstans.
- A találati halmaz **teljes egészében** kirenderelődik egyetlen görgethető táblázatba.
- **A fejléc-sor TAPAD** függőleges görgetéskor — enélkül a 100. sornál nem tudni, mit néz
  az ember. ⚠️ Ez **magasság-korlátot kíván a görgető-dobozon** (`.tblwrap--leads`):
  korlát nélkül a `position: sticky` a CSS-ben beállítottnak látszik, de soha nem tapad.
- **Több száz / ezer sor kezelése (virtualizáció) SZÁNDÉKOSAN nincs a tervben** — tulajdonosi
  kikötés: *„ha több száz vagy ezer lesz akkor azt majd kezelni kell”*. A mai 260 sor elfér.

### ③′ EGYSOROS, NAGYVÁLLALATI FEJLÉC

- A fejléc **38 px, egy sor**; minden oszlopfelirat EGY alapvonalon áll (a korábbi kétszintes,
  tördelt fejléc ~110 px volt).
- Felirat: **kis kapitális**, halk. A számoszlopok fejléce **jobbra igazodik**, a számokkal
  egy tengelyre.
- **A vezérlők tétlenül NEM LÁTSZANAK** (a helyüket viszont tartják — nincs ugrás
  ráhúzáskor): a rendezés-nyíl halvány, a szűrő-tölcsér átlátszó. Ráhúzásra előjönnek;
  **700 px alatt mindig láthatók** (érintőképernyőn nincs hover).
- **AKTÍV szűrőnél a tölcsér cián**, és viszi a jelvényét. ⚠️ Keret NÉLKÜL: a keretes alak
  gomb-dobozt rajzolt a sorba, és visszahozta a kifogásolt hatást.
- Ikon: a szűrő **tölcsér** (`ICON.filter`), nem a korábbi három vízszintes vonal — az
  egysoros fejlécben a rendezés-vezérlőtől megkülönböztethetetlen volt.
- ⚠️ **A tölcsér-ikonnak SZÉLESSÉGE is legyen:** mérve 2026-09-19 az `inline-flex` gomb a
  jelvény mellett **0,34 px-re** nyomta össze. A markupban benne volt — egy forrás-ellenőrzés
  zöldet adott volna. Az őr a RENDERELT szélességet méri.

### ④′ A CÍM ALATTI KÉT SZÖVEG-BLOKK KIKERÜL

Kivéve: a `1–50 / 260 sor megjelenítve · …` számláló-sor **és** az
`Alapértelmezett szűrő — … · Sorrend: …` mondat. Amit mondtak, azt most a felület MUTATJA:

| Amit a kivett sor mondott | Hol él tovább |
|---|---|
| mi szűr | a fejléc **cián tölcsére + jelvénye**, és a gomb elemleírása / `data-filter-summary`-je a szűrő SAJÁT mondatával |
| fut-e egyáltalán szűrő | a **„Szűrők törlése”** link, ami szűrés nélkül NINCS ott |
| mi a sorrend | a rendező oszlop **kiemelt neve és nyila** |
| hány sor, mihez képest | **EGY sor a tábla ALATT**, a szűrt ÉS a medence-számmal együtt |

⛔ **A darabszám-sor nem díszítés.** A `/leads` **alapból szűr** (mérve: 260 a 596-ból). Ez az
egyetlen hely, ahol a medence mérete elhangzik — enélkül a szűkített lista a teljes készletnek
látszana. Ezért a két szám **egy mondatban** áll, nem külön tételekben.

⛔ **A szűrő MONDATA nem veszett el, ÁTKÖLTÖZÖTT.** A mondat abból a regiszterből születik,
amelyik a szűrést is futtatja — ez a kötés a felirat és a predikátum között. Most az ADOTT
OSZLOP tölcsér-gombján ül, tehát ott olvasható, ahol a kérdés felmerül, és ott mérhető, ahol
a szűrő dolgozik.

### ⑤′ A RAGADÁS ÉS A GÖRGETÉS-JELZÉS MÉRT TÉNYHEZ KÖTŐDIK, NEM TÖRÉSPONTHOZ

A NÉV oszlop ragadása és az **„Oldalra görgetve jön a többi oszlop — a Név oszlop közben a
helyén marad.”** mondat eddig `@media (max-width: 700px)`-en ült. Az egy FELTEVÉS volt: hogy
asztalin mindig kifér mind a 11 oszlop. Mérve 2026-09-19 a valós korpuszon: **1440 px-től**
fér ki, **1280 px-en 91 px lóg túl**, 1366 px-en 5 px. Egy pixelre kimért illeszkedés
véletlenül tart. Ezért a lap-szkript **megméri** a valódi túllógást, és `is-scrollx` osztályt
tesz a dobozra: ahol van mit görgetni, ott ragaszt és kimondja; ahol nincs, ott egyik sem
történik.

---

---

## Miért van — a mért hibák (Elek FK-003, 2026-09-13; újramérve 2026-09-14)

| Hiba | Mérés |
|---|---|
| A jelmagyarázat a lap LEGALJÁN, csukva — ott, ahol a döntés már megszületett | `views.ts:1284`, a lapozó UTÁN, `<details>` nyitás nélkül |
| Lapozni csak a lap aljára görgetve | egyetlen `leadPager` hívás, `views.ts:1283` |
| Nyers angol adatbázis-érték magyar felületen | `approved` / `generated` / `rejected` a MOCK cellában, a szűrő-opció feliratában ÉS a jelmagyarázatban |
| Tizedespont magyar felületen | `confCell` → `toFixed(2)` → `0.85`; a szűrő-mondat is `legalább 0.8` |
| Azonos jelölés két jelentéssel | a KVALIFIKÁCIÓ szűrő-jelvénye DARABSZÁM, az ANYAG-é KÜSZÖB (`1+`) — vizuálisan ugyanaz a cián pötty |
| „✓ kiküldve" önmagában tördelődik | a `.pill`-en nincs `white-space` |
| Egyenetlen sormagasság | a NÉV oszlop `overflow-wrap: anywhere` → 1 és 3 soros sorok keverednek |
| **A FOTÓK 10-es értéke PLAFON, nem darabszám** | **595 leadből 365-nek pontosan 10**, 168-nak 0 → 90 % a két szélsőértéken (a Google Places legfeljebb 10 fotót ad) |
| **A MATCH 0,85 a képlet ALAPÉRTÉKE** | **54 lead** értéke pontosan `0.8500000000000001`, **109-é** NULL; a maradék 432 szinte mind egyedi |
| **390 px-en a 11 oszlopból 3 látszik** | görgető-doboz client **320** / scroll **1070** → **750 px túllógás, 408 levágott cella**; kívül reked az Ország, Város, Kvalifikáció, Fotók, Anyag, Match, Kontakt, Mock — minden, amiből az operátor dönt |

---

## Mit KÖT a terv

### ~~① A jelmagyarázat a DÖNTÉS ELŐTT áll, nem a lap alján~~ — **HATÁLYON KÍVÜL (A2, ADR-0188)**

> Felülírva: a sáv és a 11 fejléc-„?” megszűnt, helyette EGY „?” → felugró. Lásd ①′.

- A `<details>` a **táblázat FÖLÉ** kerül (a számláló-sor és a lapozó után, a tábla elé).
- **Asztalin NYITVA fogad**, telefonon **csukva** — két külön tervezői döntés: 390 px-en a
  nyitott lista a teljes első képernyőt elvenné a táblázat elől, a HELYE viszont mindkét
  méreten ugyanaz.
- **Minden oszlopfejléc visel egy „?" gombot**, ami kinyitja a jelmagyarázatot, **odagörget
  az ADOTT oszlop sorához és kiemeli**. A jelentés így elérhető onnan, ahol a kérdés
  felmerül — és érintőképernyőn is, ahol nincs tooltip.
- A lista MINDEN oszlopot tartalmaz, plusz a cellán belüli jelöléseket (`SV`, `✓ kiküldve`,
  „nincs besorolás").

### ~~② Lapozó FELÜL is~~ — **HATÁLYON KÍVÜL (A2, ADR-0188)**

> Felülírva: nincs lapozó sehol, minden rekord egy lapon, tapadó fejléccel. Lásd ②′.

Ugyanaz a vezérlő a táblázat előtt és után, **közös állapotból**. A felső lapozás a
számláló-mondatot (`1–10 / 260 sor megjelenítve`) is átírja — a két elem nem csúszhat szét.

### ③ Egy állapot = EGY MAGYAR SZÓ, egy regiszterből

`nincs` · `legenerálva` · `jóváhagyva` · `elutasítva`.

- ⛔ Az `approved` / `generated` / `rejected` nyers adatbázis-érték **soha nem jelenik meg**
  a felületen.
- A szó **EGY regiszterből** jön, amit a MOCK cella, a szűrő-opció felirata és a
  jelmagyarázat (`columnMeaning("mock")`) is olvas — egy sor így szerkezetileg nem tud olyan
  állapotot megnevezni, amit a szűrő nem ismer.
- Ismeretlen értéket **nem találgatunk**: olvashatóvá tesszük (alsó vonás → szóköz), tehát
  egy új enum csúnyán, de IGAZUL jelenik meg (ADR-0141 ①).

### ④ A szám a felület NYELVÉN

- A Match-cella `0,85` (magyar tizedesvessző), és **ugyanabból a formázóból** kapja az
  elválasztót, mint az őt leíró szűrő-mondat („Match: legalább 0,8"). Egy szabály, egy
  példány — a kettő nem tud szétcsúszni.
- Az elválasztó a **locale-ból** jön, nem beégetett vesszőből: angol konzolon `0.85` marad.

### ⑤ A PLAFON nem darabszám

Ahol a Places-fotók száma eléri a felső korlátot (10), a cella **kimondja, hogy ez plafon**
— a szám mellett jelöléssel, és a jelmagyarázat megnevezi a korlátot. „10" és „10 vagy több"
két különböző állítás; a lista eddig az elsőt mondta, miközben a másodikat tudta.

### ⑥ Az ALAPÉRTÉK nem mért egyezés

- A `0,85` **jelölve** van (a cella elemleírása kimondja: a képlet kiinduló súlya, nem mért
  egyezés — 54 lead áll pontosan itt).
- A hiányzó match **szövegesen** áll („nincs találat"), nem néma gondolatjellel, és az
  elemleírás megmondja, miért (nem volt portál-találat; 109 lead).

### ⑦ Két jelentés = két ALAK

A fejléc-szűrő két jelvénye **nem nézhet ki egyformán**:

- **DARABSZÁM** (hány értéket pipáltam ki) — kerek, kitöltött, cián.
- **KÜSZÖB** (alsó határ) — szögletes, körvonalas, **`≥` jellel** (`≥1`, `≥3`).

A fiókban egy sor kimondja, melyik alak mit jelent.

### ⑧ A „✓ kiküldve" nem tördelődik

`white-space: nowrap` a `.pill`-en. A két szó egyben egy jelölés; szétesve két félmondat.

### ⑨ Egyenletes sormagasság

Fix sormagasság; a hosszú NÉV **két sornál elvágódik** (a teljes név az elemleírásban
marad). A szem így végig tud futni egy oszlopon. ⚠️ A NÉV törhetősége egy KORÁBBI,
dokumentált javítás (390 px-en a név „Vend / éghá / z"-ként tördelődött) — a vágás azt NEM
vonja vissza, csak határt szab neki.

### ⑩ TELEFONON IS TÁBLA — ragadó NÉV oszloppal *(a döntés lényege)*

- A táblázat 390 px-en **marad táblázat**, vízszintesen görgethető.
- **A NÉV oszlop (fejléc és cella) TAPAD a görgető-doboz bal széléhez** — vízszintes
  görgetés közben a helyén marad, hogy minden érték mellett látszódjon, MELYIK leadről szól.
- A lap **kiírja**, hogy oldalra görgetve jön a többi oszlop, és hogy a Név a helyén marad.
  Egy néma görgethetőség 390 px-en nem felfedezhető.

⚠️ **A RAGADÁST VALÓDI GÖRGETÉSSEL KELL MÉRNI.** A `position: sticky` a DOM-ból és a
`getComputedStyle`-ból is „beállítottnak" látszik akkor is, ha soha nem tapad (elég egy
`overflow` a szülőn vagy egy ütköző `position`). A teljes-lapos screenshot pedig a sticky
elemet a VÉGLEGES helyére festi — egy sosem tapadó oszlop is zöldnek látszana rajta
(tulajdonosi kikötés, 2026-09-14; rokon: `reference_fullpage_shot_hides_dead_sticky`).
Az őr ezért **ténylegesen elgörgeti a konténert**, és a NÉV cella **képernyő-koordinátáját**
hasonlítja össze görgetés előtt és után.

---

## Amit a terv SZÁNDÉKOSAN nem old meg

- **A diszkvalifikált lista-nézet** nem mondja meg, MIKOR és KI zárta ki a leadet, és a
  listáról nincs visszaminősítés (az indok és a gomb a lead-lap Audit fülén van). Külön
  döntés.
- **A lead-LAP** (`/lead/:id`) változat-döntése külön érkezik — ez a kontraktus arra NEM
  vonatkozik.
- **Az irányítópult „13/14 eladó" piros jelvénye** ugyanannak a hibaosztálynak a példánya
  (állapot-szín olyat állít, ami nem igaz), de nem ezen a felületen van.

---

## Kapuk

`scripts/lead-list-plan-check.mts` — a KIRENDERELT lapon mér, valódi böngészőben.

Az **A2** pontjaihoz: EGY „?” és felugró (nyit / zár / ESC / fókusz-visszatérés / minden
oszlop / KB-horgony / a doboz a nézetablakon belül), lapozó-mentesség POZITÍV és NEGATÍV
állítással (minden rekord kint van ÉS semmilyen lapozó-elem/felirat nincs), a darabszám-sor
helye és két száma, a „Szűrők törlése” megléte szűrővel és HIÁNYA nélküle, a fejléc
magassága és egy-alapvonalúsága, a tétlen/aktív tölcsér, a tölcsér-ikon TÉNYLEGES
szélessége, a szűrő-mondat oszlop-kötése, **a fejléc tapadása VALÓDI függőleges
görgetéssel**, és hogy széles képernyőn NEM ragaszt és nem biztat görgetésre.

⛔ **⓯ ÉS KIFEJEZETTEN 390 px-EN:** a szűrő-felugró megnyílik, NEM lóg ki a képernyőből, és
minden ÉLŐ DARABSZÁMA látszik. Ezt egyik korábbi őr sem mérte — **mindkettő 1280 px-en
dolgozott**, és a rés (a `position:absolute` felugrót levágta a táblázat görgető-doboza,
pont a darabszámok sávjában) csak a tudásbázis-őr ítéletében derült ki. A szűk felismerő
ugyanúgy hamis zöldet ad, mint a hiányzó állítás.

Az **A** megmaradt pontjaihoz: magyar állapot-szavak, tizedesvessző, plafon- és
alapérték-jelölés, a két jelvény-alak, a `nowrap`, az egyenletes sormagasság, és
**a NÉV-ragadás valódi vízszintes görgetéssel**.

Piros önteszttel (a visszarontott nézeten **13 állítás** megy pirosra), a pre-commitben
`views.ts` / `leadFilters.ts` / `citui-console.css` triggerrel.

A meglévő `lead-filter-label-check` (a szűrő felirata = a szűrt oszlop; nincs levágott
oszlop-tartalom) változatlanul érvényes, és ezzel a tervvel nem ütközik.
