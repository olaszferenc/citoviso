# 2026-09-13 — A Többnyelvű modul kinőtte a „fix 3 nyelv"-et (ADR-0128)

**Kiváltó (tulaj):** „nagyon kevés nyelvre lehet lefordítani a honlapot a vásárolható
modulok között. Legyen már ennél jóval több. Pl.: EU országok nyelvei."

**ADR:** 0128 · **Kontraktus:** `assets/design-refs/console/multilang-tiers/`

---

## A premissza mérve IGAZ volt — de két rejtett függéssel

A `LANG_NAME` 10 nyelvet ismert, abból a site saját nyelvét levonva **9** volt a
választható célkészlet; az EU 24 hivatalos nyelvéből **14 hiányzott**. A puszta
lista-bővítés azonban két helyen NÉMÁN rontott volna:

1. ⛔ **`flagSvg()` ismeretlen kódra ÜRES stringet ad** (`src/ui/flags.ts`). 19 új zászló
   nélkül az új nyelvek a **vendég-oldali** nyelvváltón zászló nélküli, csupasz névként
   jelentek volna meg. Nem hibázik — csak eltűnik.
2. ⛔ **Ugyanaz a `supportedLangs()` táplálta az operátor-konzol nyelvválasztóját is.**
   A bővítés az operátornak 28 konzol-nyelvet kínált volna; minden első kattintás egy
   **2405 stringes** AI-csomagot + KB-fordítást indít, addig a felület hu-fallback.

**Tanulság:** egy „csak adat" lista bővítése előtt nézd meg, **hány fogyasztója van**, és
mindegyiknél KÜLÖN döntsd el, hogy a bővítés neki is helyes-e. Itt négy hívóhely volt,
és kétfelé kellett vágni őket.

## Megoldás: két lista, a másodikat LEVEZETVE

- `siteLangs()` — az eladható 29 (EU 24 + szerb, ukrán, orosz, török, norvég).
- `uiLangs()` — a saját felületeink nyelvei, **a `COUNTRY_LANG` értékeiből származtatva**,
  nem kézzel írt második listaként. Így nem tud elcsúszni: piacot nyitni az, ami UI-nyelvet
  érdemel. (`src/i18n/lang.ts`)

## Három sáv (tulaj-döntés), az ADR-0063 §2 felülírva

| Sáv | Kapacitás | Egyszeri díj | Egységár |
|---|---|---|---|
| Alap | max 3 | 14 900 Ft | 4 967 Ft/nyelv |
| Bővített | max 6 | 22 900 Ft | 3 817 Ft/nyelv |
| Teljes | mind a 28 | 30 000 Ft | 1 071 Ft/nyelv |

⚠️ A tulaj tudatosan tömörítette (a Teljes a Bővítettnél csak +7 100 Ft) — a szándék a
**maximális terjedés**. A sáv-árak `module_price` sorok (`multilang`, `multilang6`,
`multilang28`), tehát operátor-szerkeszthetők maradtak; az Alap **szándékosan** a régi
`multilang` sort örökli, így egy korábbi rendelés értéke nem mozdult.

## ⛔ A legfontosabb mért lelet: a ragadó sáv a kártyán belül HALOTT

A `.adm-card` `overflow:hidden` (a teljes szélességű navy fejléc negatív margóihoz kell,
tehát nem vehető el) — **AZ lesz a `position:sticky` elem scroll-konténere**, vagyis a
kártyán belüli mobil ár-sáv néma no-op: 1:1 görög a lappal.

**És ezt a screenshot ZÖLDNEK mutatja**, mert a teljes-lapos felvétel a sticky elemet a
végleges helyére festi. Csak a végigkattintás fogta meg. Megoldás: a form a kártya KÖRÉ
került (`<form><div class="adm-card">…</div><div class="adm-mlbar">…</div></form>`), a sáv
a kártya testvére, és **egy `render()` tölti mindkét példányt** (`setAll`).

Ugyanez a hibaosztály a terv-körben is bekapott: a mock három változatánál mind a három
mobil ár-sáv halott volt, és mind a hat képem zöldnek látszott.

## Egyéb, saját magamon mért hibák (mind a vázlat-körben)

- **Backtick a CSS-magyarázatban** lezárta a template literált → a generálás elhasalt, és
  a `&&` miatt a verify a **régi** HTML-t mérte, tehát a javításom „nem hatott". Kétszer.
- **Sticky `top` + `bottom` együtt → a TOP nyer.** Az alap szabály `top:64px`-e megmaradt,
  ezért a `bottom:0` néma volt (mérve: rect.top 932 > vh 900).
- **Rács-elemként a sticky mozgástere a saját cellája** — egy hasábra váltás nem elég,
  blokk-elrendezés kell, hogy legyen hova felúsznia.
- **A Playwright `clip` koordinátái a TELJES LAPHOZ képest értendők**, nem a viewporthoz:
  emiatt rossz sávot vágtam ki, és azt hittem, hiányzik a gomb. Az `elementFromPoint` +
  elem-screenshot döntötte el (a gomb 778–830 között ott volt).
- **A tesztem számolt rosszul, nem a mock** (3+1+3 = 7, nem 6) — mielőtt a kódot vádolod,
  ellenőrizd a mérés aritmetikáját.

## Az őr és az öntesztje

`scripts/multilang-tier-check.mts` — a **kirenderelt** kártyán mér, valódi admin-CSS-sel
és viewport-metával. ⛔ Az első változata csupasz `<body>`-ba írt: ott a `.adm-card`-nak
nincs `overflow:hidden`, tehát a §6 tapadás-mérés **egy másik lapot** mért volna.

A negatív önteszt (`--self-test`) az ADR-0128 ELŐTTI nézetet állítja elő. ⛔ Az ADATOT
visszarontani NEM volt elég: a sáv-kártyák, a sapka-sor és a „csomag tartalma" ÚJ JELÖLÉS,
amit a kártya a `tiers` tömbtől függetlenül is kirakott — emiatt két mérés nem bukott, egy
kattintás pedig 30 mp-es időtúllépéssel szállt el. A hű „előtte" nézethez a **jelölést is**
le kellett venni (`stripNew`).

Az ⑤ (írás-kapu) blokk **vakon zöldelt**, amíg a fixture-nek nem volt `path`-e és
mock-artefaktja: a rendelés a „site még nem renderelhető" ágon bukott el, a nyelv-kapuhoz
el sem jutott. Most külön mérés bizonyítja, hogy a hívás **elér** a mért szabályig.

## Módosított fájlok

- `src/i18n/lang.ts` — 29 nyelv, `siteLangs()`/`uiLangs()`, `LANG_REGIONS`
- `src/ui/flags.ts` — 19 új zászló-SVG
- `src/modules.ts` — `MULTILANG_TIERS`, `multilangTier()`; `MULTILANG_LANG_COUNT` kivezetve
- `src/pricing.ts` — sáv-árak seedelése és mentése, `getMultilangTierPrice()`
- `src/tenant/multilangCard.ts`, `src/tenant/multilangOrder.ts` — sáv-tudatos adat és kapu
- `src/server/adminViews.ts` — sáv-kártyák, régiós picker, sapka-sor, mobil ár-sáv
- `src/server/public.ts`, `src/console/{server,views}.ts`, `src/db/schema.ts`
- `migrations/0066_multilang_tier.sql`
- `scripts/multilang-tier-check.mts` (új őr), `scripts/multilang-tier-plan.mts` (terv-generáló)
- `kb/entries/admin-multilang/entry.hu.md` — a KB a három sávot tanítja
- `assets/design-refs/console/multilang-tiers/` — kontraktus

## Nyitott (külön szál)

- ⚠️ **Nem-latin írás:** görög, bolgár, orosz, ukrán, szerb — a sablonok Google Fontsai
  (Fraunces, DM Serif Display, Space Grotesk) jórészt latin-only, a lap rendszer-fontra
  esik vissza. Eladható, de nem az a tipográfia, amit terveztünk.
- ⚠️ **Vendég-adatból ajánlás** (a C változat ötlete): a Places API visszaadja a vélemény
  nyelvét (`languageCode`), de a `PlaceReview` **eldobja**. Amíg nem tároljuk, a felület
  nem állíthatja, hogy „mértük" (§B.17). A Places-kulcs ráadásul jelenleg 403.


---

## Az élesítési kapu — és amit AZ talált (ugyanaznap, a tulaj „menjen ki élesre" után)

A `deploy-prod.sh` dry-run **elbukott**: nincs `tudasbazis-or` PASS a diffre. Az őr FLAG-et
adott hat konkrét lelettel, mind valódi (a súgó „a választó ALATTI sor"-t írt, a kapacitás-sor
viszont a rács FÖLÖTT van; „28 közül (EU 24 + 5)" = 29 felsorolva; nem mondta ki a „legalább
egy nyelv" feltételt, pedig a kártya NULLA pipával nyílik; a nyugta csomag-neve és a fizetés
utáni eltűnő dobozok hiányoztak; és §J.24: az entrynek SOHA nem volt képe).

### ⚠️ IKER-JAVÍTÁS — a landolási konfliktus megint ezt jelentette

A land rebase-konfliktussal hasalt el. **Nem oldottam fel vakon**
([[feedback_twin_commit_check_before_rebase]]): egy párhuzamos szál (`eed4659`) UGYANEZT a
deploy-kaput ütötte meg, UGYANAZT a KB-bejegyzést javította, és **ugyanarra a megoldásra
jutott** (kb-shot fixture a `multilangCatalogView`-ból). Az övé landolt előbb.

**Eldobtam a saját duplikátumomat** — a `kb-shot` bővítésemet és a két szűk képemet (az ő
egész-kártyás képe jobb). Csak az maradt, ami tényleg hozzáad: „legalább egy nyelv", a nyugta
csomag-neve, a fizetés utáni eltűnő dobozok.

**Szóhasználat — a FELÜLETET igazítottam, nem a súgót.** Mérve: a tulaj-látható szövegben
EGYETLEN „sáv" volt, pont a „Betelt a CSOMAG — nagyobb SÁVRA váltva…" mondat közepén; a mondat
önmagával beszélt kétféleképpen. Az iker-commit ezt a súgóban MEGMAGYARÁZTA — az a mondat az
én felület-javításom után hamissá vált, ezért kikerült. ⚠️ Két szál ugyanarra a drift-re
ellentétes irányú javítást adhat; a későbbinek a másik szövegét is át kell néznie.

### ⛔ HAMIS ÍGÉRET A SAJÁT KONTRAKTUSOMBAN (a másik szál őre mérte ki)

A README §2 azt állítja: „az árak **operátor-szerkeszthetők** maradnak." **Nem volt igaz.**
Az Árazás lap a `MODULE_CATALOG`-ot járja, amiben csak a `multilang` van — a `multilang6` és
`multilang28` **mezője hiányzott**, a `savePricing` pedig eldobta volna az értéküket. A háttér
kész volt (seed + mentés-ciklus), csak az ŰRLAP nem.

**Nem a kontraktust igazítottam a kódhoz, hanem a kódot az ígérethez:** mindkét sáv-ár
alárendelt sorként megjelent a multilang alatt, a POST beolvassa, és az őr ⑥b pontja méri.
**Tanulság:** ha egy kontraktus ígér valamit, legyen ŐRE is — különben az ígéret a README-ben
él, a valóság meg nélküle.

### ⛔ AZ ÉLESÍTÉS ELMARADT — tulajdonosi döntés

Az élesítés pillanatában az éles `9cfc5e7`-en állt, a main viszont **7 committal** előrébb,
amiből csak 1-2 az enyém; a többi öt idegen szálé, **köztük egy FIZETÉSI kapu módosítása**
(`5c49260`). Az ADR-0053 verziót visz ki, nem fájl-válogatást, tehát „csak az enyémet" nem
lehetett volna kivinni a KB- és ár-mező-javításommal együtt.

A tulaj engedélye („menjen ki élesre") **más ténybeli helyzetben** született: akkor az éles
pontosan 1 committal volt lemaradva, és az az egy az enyém volt. Ezt kimondtam, megkérdeztem,
és a tulaj döntése: **megvárjuk a többi session zárását, most nem élesítünk.**
⚠️ Az engedély nem „áll tovább", ha közben megváltozik, hogy MIT visz ki.

**Amit szintén kimondtam, mielőtt bármit tettem volna:** a deploy ÍR az éles DB-be (0066
migráció), és a KB deploy-kapuhoz NEKEM kellene PASS-verdiktet rögzítenem — azt nem adom meg
magamnak, csak ha az őr tényleg PASS-t ad.
