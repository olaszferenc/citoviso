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

---

# Második kör (ugyanaznap): a KB frissítése — és két KÓD-hiba, amit a tudásbázis-őr talált

A tulaj annyit kért, hogy a KB-entry kövesse az új árazást. A KB-őr viszont a **szállított
kódban** talált hibát, kétszer egymás után — mindkettő ugyanaz a hibaosztály:
**egy szabály, két példány**.

## ⛔ ① Az ÉRTÉK duplikálva volt

Az összegző újraderiválta a számlázott halmazt `mv.modules`-ból, és a saját predikátuma nem
ismerte a `cancelAtPeriodEnd`-et (a `nextInvoiceItems` viszont igen, plusz a `billing !== "once"`
szűrőt is). Mérve: **egy lemondott modul mellett EGY képernyőn 60 700 Ft (összegző) és
53 800 Ft („Következő számla")**. Ráadásul a visszakapcsolás duplán számolt — a szerver bázisa
tartalmazta a sort, a `data-committed="0"` checkbox meg hozzáadta: **75 300 a 68 400 helyett**.
Ez a SAJÁT kontraktusom §4-ét sértette („a fülön egy igazság lehet").

⛔⛔ **Az őröm végig zöld volt** — mert a fixture-je `cancelAtPeriodEnd: false`-t tűzött ki
MINDEN során. A hibát okozó mező le volt szögezve, tehát a bukó ág sosem futott le.

## ⛔ ② A PERIÓDUS duplán maradt — és ettől lett rosszabb

Az első javításom az ÉRTÉKEKET egy forrásra kötötte (`sub.nextInvoiceItems`), de az `annualMult`
továbbra is csak `billingPeriod === "annual"`-t nézte, míg a számla-cella
`pendingAnnual || annual`-t. Egy **előjegyzett éves váltású HAVI fióknál ez tízszeres eltérés**
volt (5 570 vs. 55 700) — nagyobb, mint az eredeti hiba. Az érték és a rá vonatkozó FELTÉTEL
együtt egy szabály; az egyiket egy forrásra kötni a másik nélkül nem javítás.

## A javítás formája

`isBilledModule()` — EGYETLEN exportált függvény (`src/tenant/modules.ts`), amit a
`subscriptionAdmin` számlatételei, a Modulok-fül összegzője és az Áttekintés csempéje is hív.
A periódus ugyanaz a kifejezés, mint a számla-cellában. Az összegző már semmit nem derivál.

**Az őr bővült** (`modules-annual-check`): ⑧ lemondott modul · ⑨ visszakapcsolás VALÓDI
böngésző-kattintással · ⑩ előjegyzett éves váltás, mind piros ikerrel; valódi visszarontással
4 bukás. ⚠️ A ⑨ hámom maga is hibás volt: saját `<form>`-ba csomagolta a kimenetet, amit a
böngésző beágyazott formként eldob → 0 checkbox → **néma hamis zöld**. Most kimondottan
ellenőrzi, hogy lát-e kapcsolókat.

## Négy HAMIS KB-állítás, szintén az őrtől

1. „a kiváltott modul működik és látszik az oldalán" — **nem látszik**: a `renderableModules()`
   kiszűri (`src/modules.ts`).
2. „a »Fizetés üteme« sorban látja" — az a sor **csak éves fióknál létezik**; épp a havi olvasót
   küldtem egy nem létező sorhoz. Most a mindig meglévő „Jelenlegi díj" `/hó` vs `/év`
   végződésére mutat.
3. „alatta kiírjuk, mennyi ez havonta és hány hónap az ajándék" — havi ágon az alsó sor a
   **fordulónapot** írja.
4. A képen látható két „per hó" szám (6 070 listaár vs. 5 058 = az éves díj tizenketted része)
   magyarázat nélkül állt egymás alatt — pont ott akadt volna el az IT-kezdő.

## A KB-kép, ami nem azt mutatta, amiről a szöveg szólt

⛔ A `kb-shot` fixture-tenantjának **nulla aktív fizetős modulja** volt, tehát az „Az én
moduljaim" lista MINDEN eddigi KB-képen üres volt, és az árazás-szakasz képe az „az árban"
címkét fotózta volna. Javítva: `modulesOwned` fixture (3 modul, ami pontosan a
`subscriptionFixture` tételsorát adja ki: 3 900 + 2 170 = 6 070 Ft/hó = 60 700 Ft/év), és az
`admin-modules` ÉVES előfizetés-fixture-rel készül (az `admin-subscription` marad havi — ott a
váltás-ajánlat a téma). Két új, szűk elem-capture (`arcimke.png`, `arak.png`), mert a teljes
kártya 2000 px fölé nőtt.

## Két NÉMÁN elavult fixture — és a tsc vakfoltja

⛔ A `kb-shot` az Üzenetek fülnél **futásidőben elhasalt** (`x.thread.supersededBy` undefined-on),
így onnantól **egyetlen KB-kép sem generálódott újra** — pontosan az a képrothadás, amit a §J
frissesség-kör megelőzni hivatott. Ok: az FK-001 szál kötelező `kind`/`thread` mezőt vezetett be,
a fixture nem követte. Ugyanez a `documents` fixture-nél: `itemKey`/`itemPeriod` nélkül a
tétel-név **ÜRESEN** renderelt, cáfolva a saját entryjét.

⚠️ **Miért nem fogta a `tsc`?** A `tsconfig.json` include-ja `src/**/*.ts` — a **`scripts/` fa
láthatatlan a típusellenőrzőnek**. Egy kötelező mezővel bővülő típus a scriptekben csak
futásidőben, és csak annak bukik el, aki lefuttatja. A szál-pozíciót most a VALÓDI
`positionThreads()` számolja a fixture soraiból, tehát nem tud újra elavulni.

## Nyitott

- ⚠️ **Egy felirat, két jelentés** (a KB-őr mellékes megfigyelése, NEM javítva): a „Jelenlegi
  díj" cella havi ágon `mv.totalMonthly`-t mutat (mai díj, a lemondottal együtt), éves ágon
  `sub.annualTotal`-t (a következő számla, lemondott nélkül).
- A `„(éves díj = 10 havi díj)"` felirat beégetett 10-est visz, míg a kód
  `12 − getAnnualFreeMonths()`-ból számol.
- Élesítés NEM történt (§0.3).
