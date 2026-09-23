## ADR-0188 — A lead-lista: minden rekord egy lapon, EGY kérdőjel, és egysoros fejléc (2026-09-19)

**Státusz:** elfogadva · **Felülírja:** a 2026-09-14-i lead-lista-kontraktus ① és ② pontját
(`assets/design-refs/console/lead-list/README.md`) · **Őr:** `scripts/lead-list-plan-check.mts`

### A helyzet

A `/leads` a 2026-09-14-i jóváhagyott terv szerint épült, és a terv minden pontja mért hibára
válaszolt. A tulaj most a KÉSZ felületet nézte meg élesben, és három dolgot kifogásolt:

> *„a segítség nem kell egy ilyen sávba, max, egy kattintható kérdőjel és onnan popup…
> ne lapok legyenek, hanem minden rekord (ha több száz vagy ezer lesz akkor azt majd kezelni
> kell)… az eredménytábla fejléce katasztrofális, nézd meg! csili csálé, semmi nagyvállalati
> érzet, minek ennyi kérdőjel stb"*

…majd a §2b vázlaton: *„A változat de ez nem kell"* — a számláló-sorra és a szűrő/sorrend-mondatra.

### A döntés

1. **Nincs lapozás.** A találati halmaz teljes egészében kirenderelődik egyetlen görgethető
   táblázatba, **tapadó fejléccel**. Megszűnt a `‹ Előző` / `Következő ›` / `Mind a N egy lapon` /
   `Lapozva`, a `?page=` / `?pageSize=` paraméter és a `LEAD_PAGE_SIZE` konstans.
   Virtualizáció **szándékosan nincs** — tulajdonosi halasztás a „több száz vagy ezer" esetére.
2. **EGY „?" az egész felületen**, a cím mellett, felugró jelmagyarázattal. A sáv és a 11
   fejléc-gomb megszűnt.
3. **Egysoros, 38 px-es fejléc**, tétlenül rejtett vezérlőkkel; aktív szűrőnél cián tölcsér
   a jelvényével, keret nélkül.
4. **A cím alatti két szöveg-blokk kikerült**; a darabszám EGY sorban, a tábla alatt, a
   szűrt ÉS a medence-számmal együtt.

### Az elv, ami ebből általános

**⭐ A FELÜLET TÖRÖLHET EGY MONDATOT, HA A MONDAT ÁLLÍTÁSÁT MÁS HORDOZZA — DE MEG KELL
NEVEZNI, MI.** Mind a négy kivett szöveg egy-egy mért hibára született válasz volt (Elek
FK-003), tehát a törlés önmagában visszalépés lett volna. Ezért minden kivett mondathoz
kijelöltük az utódját, és az ŐR AZT MÉRI:

| Amit a kivett szöveg mondott | Ki hordozza most | Mit mér az őr |
|---|---|---|
| mi szűr | a fejléc cián tölcsére + a gomb `data-filter-summary`-je | a mondat a SAJÁT oszlopát nevezi meg |
| fut-e szűrő egyáltalán | a „Szűrők törlése" link léte | szűrővel ott van, szűrő NÉLKÜL nincs |
| mi a sorrend | a rendező oszlop kiemelt neve és nyila | — (a meglévő `⑩` pont) |
| hány sor, mihez képest | egy sor a tábla alatt | a szűrt ÉS a medence-szám EGY mondatban |
| mit jelent egy oszlop | a felugró jelmagyarázat | MIND a 11 oszlop szerepel benne |

**⛔ ÉS AMI A TÖRLÉSSEL MAJDNEM ELVESZETT: a tudásbázis-horgony.** A cím mellől eltűnt az
ikonos súgó-link, és vele a `data-kb-anchor="console.leads"` — a `kb-check --coverage` azonnal
pirosra ment. A horgony a felugró lábazatába költözött, **feliratos** linkként. Egy „takarítás"
így vihet el egy olyan utat, amit egy MÁSIK kapu ígér.

**⛔ A SÚGÓ A LAPOZÓ FELIRATAIT IDÉZTE.** A `console-leads` szócikk szó szerint hozta a
„‹ Előző" / „Következő ›" / „Lapozva" feliratokat, és volt róluk képernyőkép is. A
label-drift őr elkapta — a szócikket a KÓDBÓL írtuk újra (nem a commit-üzenetből), a
lapozó-kép pedig törölve: egy olyan képernyőelemről szóló kép, ami nem létezik, a kézikönyv
legrosszabb fajta hazugsága.

**⛔ A TÖRÉSPONT FELTEVÉS, A MÉRÉS TÉNY.** A NÉV-oszlop ragadása és a görgetés-jelzés
`@media (max-width: 700px)`-en ült — abból a feltevésből, hogy asztalin mindig kifér mind a
11 oszlop. Mérve a valós korpuszon: **1440 px-től** fér ki, 1280 px-en 91 px lóg túl.
A feltevés tehát hamis volt, és a MOCK oszlop némán levágódott volna, pont úgy, ahogy
2026-09-14-én. Most a lap-szkript **megméri** a valódi túllógást (`is-scrollx`), és ahhoz köti
mindkettőt. Egy pixelre kimért illeszkedés véletlenül tart.

**⛔ A MARKUPBAN BENNE VOLT, MÉGSEM LÁTSZOTT.** Az új tölcsér-ikon az `inline-flex` gombon a
jelvény mellett **0,34 px-re** zsugorodott. A forrásban ott volt a teljes `<svg>`, tehát egy
„megvan-e az ikon" grep zöldet adott volna; a képernyőn egy üres kis doboz állt. Az őr ezért
a RENDERELT szélességet méri, nem a meglétét.

**⛔⛔ A SZŰK FELISMERŐ UGYANÚGY HAMIS ZÖLDET AD, MINT A HIÁNYZÓ ÁLLÍTÁS — ÉS EZT NEM ÉN
VETTEM ÉSZRE.** Az élesítés-kapu tudásbázis-őre FLAG-et adott, kétszer is, és mindkétszer
valódi hibára:

1. **A súgó egy NEM LÉTEZŐ telefonos gesztust tanított.** A szócikk azt írta, hogy az aktív
   szűrő mondata „telefonon: hosszan nyomva" előhívható — miközben az elemleírás
   érintőképernyőn elérhetetlen, és ezt a saját kódunk kommentje is kimondja. Épp ez a kör
   vitte el az egyetlen LÁTHATÓ hordozót (a cím alatti szűrő-mondatot). A tulaj telefonról
   dolgozik: pont a célközönségnek lett volna hamis az útmutató.
2. **A javítás által mérvadónak kijelölt út MAGA volt törött 390 px-en.** A `.cf-pop`
   `position: absolute` volt, és a `.tblwrap--leads` `overflow:auto`-ja levágta a jobb
   sávját (Kvalifikáció 29 px, Anyag 26 px, Terület 40 px) — **pont ott ül a `.cf-count`
   élő darabszám**, amit a kézikönyv ígér. ⛔ **Egyik determinisztikus őr sem fogta: mindkettő
   1280 px-en mért.** A felugró most `position: fixed` + lap-szkriptes elhelyezés, és az őr
   ⓯ szakasza KIFEJEZETTEN 390 px-en méri.

**⛔⛔ A TARTÁS NEM SZÉLESSÉG — ÉS A TAKARÁST CSAK `elementFromPoint` LÁTJA.** A kapu
HARMADIK körében az őr két további rést mért ki, mindkettőt érintőképernyőn:

- **A tölcsér-láthatóság `max-width: 700px`-en ült.** Ez FELTEVÉS volt: hogy „érintőképernyő
  = keskeny". **FEKVŐ telefonon (844×390) és álló tableten (820×1180) a 10 tölcsérből 8
  láthatatlan maradt** — vagyis a kézikönyv fő utasításának („koppints a tölcsérre") nyolc
  oszlopon nem volt hova. A feltétel azóta a MUTATÓ-KÉPESSÉG (`hover: none` / `pointer:
  coarse`), a szélesség csak kiegészítő ág.
- **A SAJÁT „fölé ugrik" javításom a ragadó fejléc ALÁ tette a felugrót.** Fekvő telefonon a
  4 élő darabszámból **3 takarva** volt — épp az a kettő, amit a kézikönyv példaként ígér.
  A `z-index` önmagában nem elég (külön rétegző környezetek), ezért a lap-szkript a fejléc
  alja ALÁ szorítja a dobozt, és ha úgy nem fér el, görgethetővé teszi.

⛔ **ÉS AZ ELŐZŐ KÖRBEN ÍRT ŐRÖM (⓯) EGYIKET SEM LÁTTA:** EGY viewporton (390×844), desktop
kontextusban és BEFOGLALÓ-matekkal mért. A tartás-függést csak több viewport, a takarást csak
`elementFromPoint`, a `hover: none` szabályt pedig csak VALÓDI érintés-kontextus mutatja meg.
A ⓰ szakasz mindhármat viszi — és a visszarontáson 19 állítás megy pirosra.

⛔ **A FANTOM GESZTUS TÚLÉLT A TESTVÉR-DOKUMENTUMBAN:** a KB-ból kivettem, az FK-003
forgatókönyv lépés-szövegéből nem. Egy felirat átírása MINDEN idézőjét érinti — a keresést a
kézikönyvön túl is el kell végezni.

**⛔ ÉS A SAJÁT MÉRÉSEM KIÍRTA A HIBÁT, MIRE ÉN KÉPRŐL ZÖLDRE ÉRTÉKELTEM.** A 390 px-es
próbám `clippedByBox: true`-t adott vissza; ránéztem a screenshotra, „teljesnek" láttam, és
továbbmentem. Amit a mérés RÖGZÍT, azt nem szabad szemre felülbírálni.

**⛔ A JAVÍTÁS MELLÉKTERMÉKE AZONNAL ÚJ HIBA LETT:** a `fixed` felugrót görgetésre zártam —
csakhogy a KOPPINTÁS MAGA vált ki görgetést (a böngésző a gombot a képbe húzza), így a doboz
abban a pillanatban csukódott be, amikor megnyílt. A görgetés most ÁTHELYEZ, nem zár. És az
őr első változata ezt **zölden** engedte volna át: a „minden darabszám látszik" állítás egy
CSUKOTT felugrón triviálisan igaz (a rejtett elem befoglalója 0,0,0,0) — a nyitottság azóta
kimondott ELŐFELTÉTEL.

**⭐ A KÉP A VALÓDI ÚTON KÉSZÜLJÖN.** A `legend.png` korábban a DOM-on kikényszerített `open`
attribútummal készült — az a nyitó-gomb megkerülése, tehát egy elromlott gomb mellett is szép
képet adott volna. Most a felvétel **rákattint a „?" gombra**, mint az operátor, és hangosan
elhasal, ha nem nyílik meg. Ugyanitt: az elem-felvétel a saját görgetését is feloldja, mert a
levágott előnézet mindig a VÉGÉT veszi el (16 sorból 8 került a képre).
