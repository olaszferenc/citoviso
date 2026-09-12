# 2026-09-12 — Az éves fiók havi árcédulákat olvasott: a Modulok fül a fiók ütemében áraz

**Kiváltó:** Elek FK-002 újramérés a friss mainen (`23a1114`), leletek Z1 · Z2 · GY1.
**Kontraktus:** `assets/design-refs/console/modules-annual-pricing/` (§2b, jóváhagyva 2026-09-12).
**Kapcsolódó ADR:** 0080 (előfizetés-motor), 0088 §8 (éves ütem, `data-mult`), 0113 (fizetett
modul csak fizetés után), 03-INVARIANTS §B.17.

## A panasz és ami mögötte volt

Az ELEK-TESZT Vendégház **éves** fiók (99 900 Ft/év), a modul-kártyái mégis „+490 / +690 Ft/hó"
címkéket viseltek, éves átváltás nélkül; a listának nem volt végösszege. A vevő nem tudta
levezetni, mennyivel nő az éves díja, ha bekapcsol egy modult.

**Két korrekció a feladat premisszájához — mérve, nem feltételezve:**

1. **„A minta már megvan az Áttekintés fülön" — nem ott van.** Az éves kód
   (`adminViews.ts` `periodBlock` / `feeCell` / `nextCell`) a `modulesSection()`-ben él, tehát
   **már a Modulok fülön**: az Előfizetés-kártya helyesen mondta a 99 900 Ft/év-et. A
   „…/hó-nak felel meg" átváltás viszont a `periodBlock` **havi ágában** ül — egy MÁR éves
   fióknál a csendes ütem-mondat fut le helyette. A fülnek nem a minta hiányzott, hanem az,
   hogy a meglévő minta **nem ért le a modul-kártyákig**.
2. **A tervsáv már tudott éveset.** Az `adm-next-total` visz `data-mult="10"`-et (ADR-0088 §8),
   és a JS `delta*mult`-tal számol — a *kapcsolgatás* helyesen évesített. Csak a **statikus
   chip** és a **hiányzó összegző** nem. A javítás tehát nem új szabály, hanem egy meglévő
   szabály kiterjesztése ugyanabból a forrásból.
3. **A 12 vs. 11 nem ellentmondás, hanem két különböző mérés.** 12 aktív modul, ebből 11
   számlázott; a tizenkettedik az `enquiry`, ami `spine` **és** `supersededBy: booking`, ezért
   0 Ft. Az Áttekintés `m.active`-ra számol, a Modulok fül a chipet a `supersededBy` szerint
   dönti el. Egyik sem hazudott — **a felirat nem mondta meg, melyiket mutatja.**

## Amit a tulaj eldöntött (§2b, 3 működő mock, mindkét méret)

- **B változat:** a chipen a **havi ár marad elöl**, mellette az éves átváltás
  (`+490 Ft/hó = 4 900 Ft/év`). Az éves szorzó `12 − ajándékhónap` (ma 10).
- **Háromcellás összegző** a lista végén, az Előfizetés-kártya saját formanyelvén:
  Modulok együtt (11 db) 60 900 Ft · Alapdíj 39 000 Ft · **Éves díja összesen 99 900 Ft**
  („8 325 Ft/hó-nak felel meg · 2 hónap ajándék"). A legnagyobb szám az, amit fizet.
- **A számláló megnevezi, mit számol:** „12 db · Aktív modul · ebből 11 számlázott".

## Szállítva

- `priceForm()` (adminViews) és `priceInPeriod()` (moduleConfigViews) — **egy szabály két
  helyen**: a modul-kártya, a kupon-chip, a bolti chip és a modul-beállító képernyő fejléce is
  a fiók ütemében áraz. Havi fióknál minden változatlan (ott az éves szám zaj lenne).
- Modul-összegző (`.adm-sumbar`), ami **együtt mozog a kapcsolókkal**: a `data-base`/`data-mult`
  ugyanabból a kontraktusból olvas, mint a „Következő számla" cella, így a fül nem tud kétféle
  végösszeget mutatni. Előfizetés nélkül nincs összegző (nincs ciklus — §B.17).
- A `subscription` betöltése FELJEBB került a `serveAdmin`-ban: eddig a modul-beállító blokk
  UTÁN futott, így annak a képernyőnek nem volt honnan tudnia a számlázási ütemet.
- Őr: `scripts/modules-annual-check.mts` — a **renderelt** fülön mér, **független
  referenciával** (a `pricing.ts`-ből és a katalógusból számol, nem a nézet `annualTotal`-jából
  — az őr ne a saját alanyát kérje kölcsön mércének). Pre-commitba kötve.

## Mérés és negatív futás

- 4 szintetikus piros iker + **két VALÓDI visszarontás a fában:** a chip havi-onlyra
  visszaállítva → 3 bukás (pontosan a mai hiba); az összegző kikapcsolva → 5 bukás;
  helyreállítva újra zöld.
- A valós ELEK-TESZT view-model átrenderelve és ui-shottal megnézve mindkét méretben: a
  szállított felület megegyezik a befagyasztott tervvel.

## Amit a terv-kör tanított (saját lelet)

⛔ Az első mockomban **390px-en az „Asztali" gomb nem rendezett át**: a `.con` shrinkelhető
flex-item volt, és a `max-width:100%` megfojtotta a container-queryt — a váltó csak keskenyített.
A tulaj telefonon a döntés felét nem látta volna. `flex:0 0 auto` + skálázás (az `adm-pv`
előnézet bevált mintája) javította. A `reference_mock_size_switch_starts_from_viewport` mellé
ez a párja: **a váltónak nem elég a viewportból indulnia, a szélesebb elrendezésnek ténylegesen
ki is kell férnie.**

## ⚠️ INFRASTRUKTÚRA-LELET: két session EGY munkafában

Munka közben kiderült, hogy ebbe a worktree-be (`~/wt/cit2167c7de`) **egy másik session is ír**
(Elek FK-001, számla-tétel/üzenet-szálak) — ugyanazt az `adminViews.ts`-t és
`citui-admin.css`-t szerkesztve. Bizonyíték: `src/email/invoiceEmail.ts` a semmiből módosult,
miközben hozzá sem nyúltam; a fájlok mtime-ja percenként változott.

⛔⛔ **A `git stash` ezt katasztrofálisan felnagyítja.** Egy diagnosztikai `git stash`-em (azt
akartam eldönteni, hogy a `tsc`-hibák a mainen is megvannak-e) **beszippantotta a másik session
félkész munkáját** (`src/tenant/documents.ts`, `messages.ts`), és a `stash pop` utána már nem
ment, mert ők közben újraírták ugyanazokat a fájlokat. A helyreállítás három körbe telt.

**Amit ebből szabállyá kell tenni:**
- ⛔ **Megosztott munkafában `git stash` TILOS.** A doktrína a `git add .`-ot tiltja ugyanezért;
  a `stash` ugyanaz a hibaosztály, csak láthatatlanabb — és nem a commitot rontja el, hanem
  élő munkát tesz elérhetetlenné.
- ✅ Ha egy „a mainen is így van?" kérdés merül fel: **külön worktree**, ne a sajátod kiürítése.
- ✅ **Landolni tiszta fából.** A commit végül egy `origin/main`-ről nyitott friss worktree-ből
  ment (`/tmp/citland`), ahová hunk-szűréssel CSAK az én változtatásaim kerültek át. Enélkül a
  commit vitte volna a másik szál félkész kódját, és — ami csendesebb és rosszabb — a
  **regenerált `catalog.json` az ő stringjeiket is**, amitől az `extract-i18n --check` a mainen
  mindenki másnak elromlott volna.

## Nyitott

- A `tsc` a megosztott fában 4 hibát ad (`itemKey`/`itemPeriod`) — **a másik session** FK-001
  munkája, nem az enyém; a landoló fán 0 hiba.
- Élesítés NEM történt (§0.3).
