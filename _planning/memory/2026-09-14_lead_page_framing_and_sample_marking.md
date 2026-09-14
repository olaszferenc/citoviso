# A lead szemével: a kiküldött mock-lap — jelöletlen űrlap, kimaradt keretezés, és egy lelet, ami nem reprodukálható

**Dátum:** 2026-09-14 · **Szál:** `wt/mocklapleadszem` (B7 köteg) · **Forrás:** Elek FK-004b
(2026-09-13, 12 kör / ~250 lelet) · **Élesítés:** NINCS.

---

## A kör két része

A BRIEF tíz leletet adott át a **kiküldött mock-lapról** — arról a képernyőről, ami a leendő
vevő első és sokszor egyetlen találkozása velünk. A lista **két különböző fajtát kevert**:
kinézeti döntést igénylő tételeket (§2b terv-kapu) és tiszta hibajavításokat. A kör ezt
**szétválasztotta**: az apró rész végigment (commit + land), a kinézeti rész **megállt a
kapunál** (`TERV-KESZ.md`, három működő vázlat).

---

## ① LESZÁLLÍTVA — öt javítás, két őr

### A vélemény-űrlap jelöletlen volt, és közzétételt ígért

A mockon a hírlevél, az árak, a szolgáltatások és a szobák mind **„Minta” pirulát** viseltek —
az az EGY szekció nem, amelyik **nevet, e-mail címet és egy hozzájárulás-pipát** kér. A gomb
alatt pedig az állt, hogy *„A véleménye azután jelenik meg, hogy a szállásadó jóváhagyta"*:
ígéret egy űrlapról, ami **sehova nem posztol**.

⛔ **A cáfolat csak BEKÜLDÉS UTÁN érkezett** (`data-cit-demo`) — azaz azután, hogy a látogató
már beírt mindent. A javítás ezért **nem** a beküldés-utáni üzenetet írja át: a gomb mellé,
**kattintás elé** került a mondat („Ez egy előnézet: a beküldés most nem rögzít és nem küld el
semmit."), a szekció pedig a **meglévő `asSample` mintát** kapta — ugyanazt a pirulát és
jegyzet-formát, mint a szomszédai.

⭐ A mondat **feltételes** (`opts.demo`): az ÉLES tenant-lapon változatlanul a valódi ígéret
áll. Egy „írjuk ki mindig" javítás a vevő éles oldalán hazudna — ezt **álpozitív kontrollként**
az őr külön méri.

### A lap felváltva beszélt a tulajhoz és a vendéghez

*„Az oldalon leadott véleményeket **Ön** hagyja jóvá"* — ez a TULAJHOZ szólt, és közvetlenül a
**vendég-űrlap** („Járt már nálunk?") fölött állt. Egy bekezdésnyire egymástól a lap két
különböző embert szólított „Ön"-nek. Ez a szekció **élő tenant-lapon is** renderelődik, tehát
vendég-hangra váltott — de a moderálás ténye **megmaradt** (az adja a szekció hitelét), csak
már a szállásadóról szól, nem hozzá. Amit a LEAD-nek kell tudnia („ezeket Ön fogja jóváhagyni"),
az oda került, ahol a helye van: a **vélemény-űrlap saját minta-jegyzetébe**.

### A bevezető balra tapadt — és a `margin` rövidítés volt az ok

`style="margin:0"` — a `margin` **shorthand**, tehát a bal/jobb `auto`-t is nullázta, amit a
`centredModsecCss` állít be. Egy stíluslap pedig **inline deklarációt nem ver**. A 640 px-es
jegyzet középpontja így x≈400 lett a szekció x≈640-e helyett (fullbleed, 1280 px — pontosan a
lelet x≈398-a). Csak a FELSŐ margót akartuk nullázni → `margin-top:0`.

### Tegezés/magázás · és a Tevékenység-képernyő

- `rended` → `ide az Ön saját érkezési és távozási rendje kerül`; „Nézz körül" → „Nézzen körül".
  (A második a `renderVaried.ts`-ben él, amit ma csak a `scripts/poc-variety.ts` hív — a valódi
  hordozó a minta-jegyzet volt.)
- Az operátor-konzolon a **„Megnyitások"** fölött *„{n} látogatás · {m} esemény"* állt: három
  főnév két számra, és **két mértékegység egy soron**. Két sorra bontva, a value szava =
  a label szava.
- ⛔ A **„–" nem döntötte el**, hogy „nem mértünk" vagy „nulla": aki meg sem nyitotta a linket,
  és aki megnyitotta, de nem görgetett, **ugyanazt a jelet** kapta — két ellentétes tény. Mérve
  szétválasztva: `nem mértünk` ↔ `0%` / `0 másodperc`; a meg nem hozott döntés pedig egyik sem
  (`nem választott`).

### Őrök

- **`scripts/mock-form-honesty-check.mts`** (böngészős). Nem azt kérdezi, hogy a mondat OTT
  VAN-e — hanem hogy **egy telefon-képernyőn (844 px) van-e** azzal, amiről dönteni kell: a
  „nem rögzít" a beküldő gombbal, a „Minta" pirula az első kitöltendő mezővel. Dokumentum-
  koordinátákban mér, görgetés nélkül. **Álpozitív kontroll** az ÉLES lapon. **4 piros önteszt.**
  ⚠️ Az első önteszt **hamisan zöld** lett: a pirula-kivágó `replace()` a lap **első** pirulát
  találta el (az ár-táblán), nem a vizsgált szekcióét — globálisra véve lett valódi. Ezért fut
  a „a visszarontás tényleg megváltoztatta a lapot" kontroll is.
- **`scripts/prospect-activity-label-check.mts`** (böngésző nélkül). ⚠️ Az első futása a
  **HELYES** sort buktatta meg: *„Leghosszabb olvasás — 0 másodperc"*. A szabály („a felirat
  nevezze meg, amit számol") **mértékegységre nem áll** — a másodperc arra felel, hogy MENNYI,
  nem arra, hogy MIBŐL. A kivétel kimondva, listával.

---

## ② MEGÁLLVA A §2b KAPUNÁL — a keretezés

**A legsúlyosabb lelet nem hiba, hanem HIÁNY:** a nyitóképernyőn semmi nem mondja meg, **mi ez,
kitől jött és miért kapta**. A magyarázat a lap **ALJÁN** van (`prospectNotice.ts` →
`appendToBody`), felső sávot pedig **csak a LEIRATKOZOTT** kap. Aki először nyit rá a levélből,
egy idegen weboldalt lát a saját szállásáról.

Három működő vázlat (`assets/design-refs/_drafts/b7-keretezes-{A,B,C}.html`), valós adaton
(Aranykagyló 36, a lead saját portál-fotójával, a `fullbleed`/„balaton" skin **kimért**
tokenjeivel), méret-váltóval (`@container`) és egy második döntés kapcsolójával (ár-tábla A/B/C).
Részletek: `TERV-KESZ.md` a munkafa gyökerében.

⭐ **A keretezés szándékosan skin-független**: az engine-renderelt mock nem tölti be a
`citui.css`-t, és a sávnak **19 sablonon** kell olvashatónak lennie.

⛔ **A kattintás-próba három hibát talált a SAJÁT vázlatomban**, amit a kép nem mutatott volna:
(1) a nav a laphoz tapadt, ráfeküdt a keretezés-sávra és **elnyelte a kattintást**;
(2) a nyitókártya jogi része 390 px-en **levágódott**; (3) a kártya jogi linkjei a böngésző
alap kékjével jöttek — **kontraszt 1,99** a sötét kereten, a „Leiratkozás" majdnem eltűnt.

---

## ③ EGY LELET, AMI NEM REPRODUKÁLHATÓ

> „~88 px üres krém sáv a mock tetején" (FK-004b GY-2, FK-005a E-6)

Megmérve a lead **valódi útján** (`renderSite` → `injectRuntime` → `injectConfigurator` →
`injectTrackingNotice`), **19 sablon × 2 szélesség × 3 fotó-állapot** (ép / törött URL / nulla
fotó):

- **1280 px-en mind a 19 sablonon 0 px.**
- 390 px-en 15 sablonon 10–42 px — ez a lap **saját háttere** az első szövegsor fölött
  (masthead/nav belső margó), nem injektált sáv.
- Az egyetlen nagy krém felület (291–338 px) az `arch-frames` és a `wordmark-grow`
  **ADR-0115 nyitó-animációja**, ami ~4,7 mp után **maga távolítja el magát** — szándékos,
  teljes képernyős, és **mindkét szélességen** ott van.
- A hivatkozott **„Ezt az oldalt a Citoviso készítette" felirat LÉTEZIK**, de a lap **ALJÁN**
  (`src/generator/runtime.ts` `CIT_CREDIT`).

**Javítást nem találtam ki rá.** (Az első mérésem 2,5 mp-et várt, és a nyitó-animációt
„örökké ottmaradó sávnak" olvasta — a JS-t elolvasva derült ki a 4,7 mp-es önkioltás.)

---

## Módosított / létrehozott fájlok

- `src/engine/moduleSections.ts` — minta-jelölés + kattintás-előtti igazság + vendég-hang + margó
- `src/console/views.ts` — Tevékenység-képernyő feliratai és a „–" szétválasztása
- `src/generator/renderVaried.ts` — magázás
- `src/i18n/catalog.json` — újragenerálva
- `scripts/mock-form-honesty-check.mts` · `scripts/prospect-activity-label-check.mts` — ÚJ őrök
- `hooks/pre-commit` — mindkét őr bekötve (scope-olt trigger)
- `kb/entries/console-outreach-draft/entry.hu.md` — a „nem mértünk" ≠ „0%" kimondva
- `TERV-KESZ.md` (nem verziózott) + `assets/design-refs/_drafts/` (gitignore-olt vázlatok)

## Nyitott

1. **A tulaj döntése a keretezésről (A/B/C) és az ár-tábláról (A/B/C)** — `TERV-KESZ.md`.
   ADR **csak a döntés után** születik (a sorszám-ütközés elkerülése miatt sem foglaltam előre).
2. A kiküldés-kapu a **nulla-fotós** lapot „ok"-nak mondja (A8 szál, szándékosan nem itt).
3. A `renderVaried.ts` ma csak POC-út — érdemes tisztázni, kivezethető-e.
