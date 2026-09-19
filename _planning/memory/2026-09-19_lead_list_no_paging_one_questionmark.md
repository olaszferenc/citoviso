# 2026-09-19 — Lead-lista A2: minden rekord egy lapon, EGY kérdőjel, egysoros fejléc

**Döntés:** ADR-0188 · **Kontraktus:** `assets/design-refs/console/lead-list/README.md` (A2 blokk)
**Őr:** `scripts/lead-list-plan-check.mts` (zöld; önteszt 9 bukás)

## Mi volt a feladat

A tulaj a KÉSZ `/leads` felületet nézte meg élesben, és hármat kifogásolt:
„a segítség nem kell egy ilyen sávba, max egy kattintható kérdőjel és onnan popup” ·
„ne lapok legyenek, hanem minden rekord” · „az eredménytábla fejléce katasztrofális,
csili csálé, semmi nagyvállalati érzet, minek ennyi kérdőjel”.
A §2b körben az **A** változatot választotta, majd: „ez nem kell” — a cím alatti
számláló-sorra és a szűrő/sorrend-mondatra.

## Ami ebből általános tanulság

### ⭐ A felület törölhet egy mondatot, ha az ÁLLÍTÁSÁT más hordozza — de meg kell nevezni, mit

Mind a négy kivett szöveg egy-egy **mért** hibára (Elek FK-003) született válasz volt, tehát
a törlés magában visszalépés lett volna. Ezért minden kivett mondathoz kijelöltem az utódját,
és **az őr azt méri** (nem a mondat hiányát):

| Amit a kivett szöveg mondott | Ki hordozza most | Mit mér az őr |
|---|---|---|
| mi szűr | a fejléc tölcsére + `data-filter-summary` | a mondat a SAJÁT oszlopát nevezi meg |
| fut-e szűrő egyáltalán | a „Szűrők törlése” link léte | szűrővel ott van, szűrő NÉLKÜL nincs |
| mi a sorrend | a kiemelt oszlopnév + nyíl | a kiemelt fejléc FELIRATA = a rendező oszlop |
| hány sor, mihez képest | egy sor a tábla alatt | szűrt ÉS medence-szám EGY mondatban |
| mit jelent egy oszlop | a felugró jelmagyarázat | MIND a 11 oszlop szerepel benne |

### ⛔ A takarítás elvihet egy utat, amit egy MÁSIK kapu ígér

A cím mellől kikerült az ikonos súgó-link, és vele a `data-kb-anchor="console.leads"`.
A `kb-check --coverage` azonnal pirosra ment: „a horgonya nincs kint a felületen — elérhetetlen
súgó”. A horgony a felugró lábazatába költözött, **feliratos** linkként. Enélkül a kézikönyv
egy olyan utat ígért volna, ami a képernyőn nem létezik.

### ⛔ A súgó a lapozó FELIRATAIT idézte — és volt róla képernyőkép is

A `console-leads` szócikk szó szerint hozta a „‹ Előző” / „Következő ›” / „Lapozva” feliratokat.
A label-drift őr elkapta. A szócikket a **KÓDBÓL** írtam újra (nem a commit-üzenetből, és nem
gépies cserével — `feedback_sed_on_docs_invents_labels`), a `pager.png` pedig **törölve**: egy
olyan képernyőelemről szóló kép, ami nem létezik, a kézikönyv legrosszabb fajta hazugsága.

### ⛔ A töréspont FELTEVÉS, a mérés TÉNY

A NÉV-oszlop ragadása és a görgetés-jelzés `@media (max-width: 700px)`-en ült — abból a
feltevésből, hogy asztalin mindig kifér mind a 11 oszlop. **Mérve a valós korpuszon:
1440 px-től fér ki, 1280 px-en 91 px lóg túl, 1366 px-en 5 px.** A feltevés hamis volt, és a
MOCK oszlop némán levágódott volna — pont úgy, ahogy 2026-09-14-én. Most a lap-szkript
**megméri** a valódi túllógást (`is-scrollx`), és ahhoz köti mindkettőt. Egy pixelre kimért
illeszkedés véletlenül tart (`feedback_exact_match_held_only_by_accident`).

### ⛔ A markupban benne volt, mégsem látszott (0,34 px)

Az új tölcsér-ikon az `inline-flex` gombon a jelvény mellett **0,34 px-re** zsugorodott
(`flex-shrink` alapértelmezés). A forrásban ott állt a teljes `<svg>` — egy „megvan-e az ikon”
grep **zöldet adott volna**, a képernyőn viszont egy üres kis doboz állt. Az őr ezért a
RENDERELT szélességet méri. `flex: 0 0 auto` a javítás.

### ⛔ Két IDEGEN őr vakult meg az átszervezéstől — és az egyik némán

- `lead-filter-label-check`: `[data-sort-summary]`-re várt 30 mp-ig, majd elhasalt (**látszott**).
- Ugyanaz az őr a `visibleRight`-ot `rect.left + clientWidth`-ként számolta. Amióta a görgető-doboz
  **1 px keretet** kapott, ez 1 px-szel a valódi él elé esett, és **négy nézetben** jelentett
  levágást ott, ahol a túllógás mérve 0 px. `clientLeft` kell hozzá.
- És a **piros kontrollja** `th { white-space: nowrap }`-pal „rontott vissza” — ami ADR-0188 óta
  a **mai alapállapot**, tehát üres halmazon állt volna. A kontroll a belső margóra váltott.

### ⭐ A KB-kép a VALÓDI úton készüljön

A `legend.png` eddig a DOM-on kikényszerített `open` attribútummal készült — az a nyitó-gomb
**megkerülése**, tehát egy elromlott gomb mellett is szép képet adott volna. Most a felvétel
rákattint a „?” gombra, mint az operátor, és **hangosan elhasal**, ha nem nyílik meg.
Ugyanitt: az elem-felvétel feloldja a saját `max-height`-jét, mert a levágott előnézet mindig
a VÉGÉT veszi el (**16 sorból 8** került a képre).

## Módosított fájlok

- `src/console/views.ts` — fejléc, felugró jelmagyarázat, cím-sor, darabszám-sor, lapozó ki
- `src/console/data.ts` — `LEAD_PAGE_SIZE`, `page`/`pageSize` kivezetve a `LeadListResult`-ból
- `src/console/server.ts` — a `/leads` route már nem olvas `page`/`pageSize` paramétert
- `src/ui/icons.ts` — `ICON.filter` (tölcsér)
- `public/assets/ui/citui-console.css` — egysoros fejléc, tapadó `thead`, `is-scrollx`,
  `.con-legend` felugró, `.tblwrap--leads`, a lapozó-stílusok törölve
- `scripts/lead-list-plan-check.mts` — az A2 kontraktus őre (+ piros önteszt)
- `scripts/lead-filter-label-check.mts` — a megvakult szelektorok és a szegély-matek javítva
- `scripts/kb-shot.mts` — `clickToOpen`, a `pager.png` felvétel törölve, elem-shot un-clamp
- `kb/entries/console-leads/entry.hu.md` (+ `legend.png`, `screen.png`; `pager.png` törölve)
- `assets/design-refs/console/lead-list/` — A2 kontraktus + 4 kép + `plan-A2.html`
- `_planning/DECISIONS.md` — ADR-0188

## Nyitott

- **Virtualizáció** („több száz vagy ezer sor”) szándékosan KIMARADT — tulajdonosi halasztás.
  A mai 260 sor DOM-ban elfér; a küszöb, ahol ez fájni fog, nincs megmérve.
- **1280 és 1366 px között** a tábla oldalra görget (91 ill. 5 px). Működik és ki van mondva,
  de ha a tulaj azt akarja, hogy laptopon is kiférjen, az oszlop-szélesség korlátozása
  (Város/Terület csonkolás elemleírással) külön döntés — információt vesz el.
