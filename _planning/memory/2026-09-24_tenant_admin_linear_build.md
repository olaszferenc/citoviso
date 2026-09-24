# Tenant-admin újratervezés — a „Linear” terv MEGÉPÍTVE (2026-09-24, átadott session)

**Szál:** az ADR-0224 kontraktus (`assets/design-refs/tenant-admin/admin-linear/`) megvalósítása a
README sorrendjében: ① keret + navigáció + téma → ② Áttekintés → ③ Fotók → ④ súgó + idézők + őr.
A brief: `~/rc-briefs/tenant-admin-linear.md`. Élesítés NEM része.

## Elvégzett

- **Tokenek (`citui.css`):** új felület-réteg tokenek (`--citui-bg/panel/side/field/hover`,
  `--citui-accent-ink`, `--citui-accent-soft`), a `[data-citui-theme=dark]` készlet semleges sötét
  rétegekkel + a 4 `-ink` token KIMÉRVE a sötét panelre (ok 10,85 · bad 8,03 · warn 10,67 ·
  link 9,74; a mezőn a legrosszabb 7,46). A `--citui-white` háttér-szerepe a `--citui-panel`-re
  költözött az adminban — sötétben ezért nincs „fehér lyuk” (őr méri).
- **`citui-admin.css` teljes csere:** új fej (shell, oldalsáv csoportokkal + számlálók + ikonsáv,
  fejléc ← + útvonal + téma + „Oldal” + elsődleges gomb, mobil alsó sáv 4 + Menü, bal fiók
  `:target`-tel JS nélkül is, előfizetés-kártya, Áttekintés-widgetek, nyitókép-mutató, teendő-lista,
  Fotók-készlet: húzza-ide sáv, rács/lista, hover-műveletek, nagyítás, kijelölés + tömeges sáv,
  párbeszéd, toast, lap-feletti ejtő). A régi `.adm-*` komponens-farok megtartva, gépiesen az új
  nyelvre állítva (panel-háttér, ink-szöveg, ≤8 px sugár, 13 px-re skálázott betűk, árnyék nélkül,
  a kártya-fej navy sáv helyett sima sor). Mobil alsó sáv MÉRVE 59,2 px → `--citui-admin-bottomnav-h: 60px`.
- **`icons.ts`:** `ICON_THIN` + `icAdmin()` (1,7-es vonal, pötty nélkül); az adminViews,
  moduleConfigViews, bookingViews erre vált — a konzol a pöttyös készleten marad.
- **`adminViews.ts`:** `shell()` fej-bővítés (téma-boot a stíluslap ELŐTT), `frame()` (oldalsáv /
  fejléc / alsó sáv / fiók / overlayek / keret-szkript), `sideNav/bottomNav/drawer/subscriptionCard`,
  új `overviewSection` (3 widget · nyitókép-mutató · teendő-lista fejléccel · mobil kártya), új
  `photosCard` + `PHOTO_SCRIPT` (XHR-feltöltés fájlonkénti haladással és elutasítás-okkal, DnD
  sorrend → `to=<index>`, kaption fetch-mentés „Mentve” pöttyel, nagyítás billentyűvel, kijelölés +
  tömeges törlés megerősítéssel, lap-szintű ejtés). `AdminOpts`: `siteSlug`, `subSummary`,
  `overview`, `photosView`, `now` (rögzíthető óra a KB-shot determinizmusához).
- **Adat:** `getVisitorSeries()` (trafficReport), `getSubscriptionSummary()` (1 sor,
  minden fülön), `public.ts` betölti + a fotó-útvonalak: `order` numerikus `to`, `delete` több url,
  `caption` JSON válasz `X-Requested-With: fetch`-re. `moveTenantPhoto` abszolút indexet is fogad.
- **Súgó:** `admin-photos` a valódi feliratokból ÚJRAÍRVA (a „Kiválasztott fotók feltöltése”
  megszűnt), `admin-overview` (widgetek, nyitókép-mutató, teendő-fejléc, előfizetés-kártya, a
  keret leírása, „Oldal”), `admin-account` (hol a Kilépés). kb-shot fixture: slug, összefoglaló,
  overview; szelektor `.adm-side`→`.adm-bnav`, `.adm-card`→`.adm-ov`. MINDEN admin-kép újralőve.
- **Őr:** `scripts/admin-linear-check.mts` (hermetikus fixture + Playwright, 2 méret × 2 téma:
  widgetek, mutató, lista, ← rejtve/látható, nincs látható fájlmező, bemutatón nincs törlés,
  rács/lista, nagyítás, fiók, téma megmarad újratöltés után, sötét „fehér lyuk” = 0, alsó sáv = 5,
  saját fotós pozitív kontroll a törlésre/kijelölésre; `--self-test` 4 szabotázst fog) —
  pre-commitba kötve. `consent-style-check` bútor-szelektora `.adm-bnav`. A README kötő feliratai
  **„…”**-jelölve (contract-drift-check zöld), a modules-annual-pricing kötése átköltözött a
  Teendők fejlécére („{n} modul · {k} számlázott”).

## Eltérések a mocktól (a README-ben is kimondva)

← asztalin is; „Új” gomb nincs (halott vezérlő volna); „Élesítés előtt” csak nem-élő oldalon;
havi fiókon ciklus-mérő 12 szegmens helyett; fiók-sor: tenant-név + felhasználónév + kilépés-ikon;
a fejléc keresőjében nincs ⌘K (nincs mögötte kereső).

## Tanulságok

- ⛔ Osztálynév-ütközés a megtartott farokkal: a fejléc `.adm-search`-e a Dokumentumok-fül
  `.adm-search input`-szabályaival ütközött (abszolút ikon, `flex:1 1 100%`) → `.adm-topsearch`.
  Új szelektor előtt grepelni a farkat.
- ⛔ Mobil túlfolyás: a grid-cella `min-width:auto` + nowrap útvonal az egész lapot kiszélesítette
  (`.adm-top{min-width:0}` + ellipszis).
- A Playwright `addInitScript` a RELOAD-nál is fut → a téma-megmaradás tesztje önmagát írta felül;
  a megmaradást init-szkript nélküli kontextusban kell mérni.
- Az i18n-lint a `T()` hívást a saját burkoló (`J()`) mögött nem látja → `JSON.stringify(T(...))`.
- A `dt` fixture-helper TDZ-je a kb-shotban (feedback: a szkriptek nincsenek típusellenőrizve).
- A KB-shot server-oldali dátum-függő szöveget (kártya, „ma/tegnap”) csak rögzített órával tud
  determinisztikusan lőni → `AdminOpts.now`.

## Nyitott

- A ⌘K kereső funkciója (a terv csak a helyét köti).
- A többi fül belső elrendezése (csak a keretet kapták; sötét módban átnézve: Modulok, Üzenetek).
- Élesítés: külön engedéllyel, verzióként (`scripts/deploy-prod.sh`).
