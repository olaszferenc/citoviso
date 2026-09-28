# 2026-09-28 — Az admin első órájának akadályai telefonon (brief: admin-akadalyok-telefonon)

Négy mért lelet az éjszakai körből (`2026-09-28_ejszakai_kor_tulaj_vendeg_telefonon.md`), mind a
tenant-admin ELSŐ munkamenetét rontotta, telefonon. A döntések a koordinátor-sessionön át jöttek,
és a tulaj EBBEN a sessionben is megerősítette őket („①B+szoba mindenhol, ② mehet, ④ 2”).

## ③ A kivezetett hírlevél-modul eladásra kínálva — KÉSZ
- Ok: a `retired` kapcsolót a konfigurátor, az ALL-IN, a matek és az előnézet olvasta, a bérlői
  út (`getTenantModules`, `applyModuleChange`) nem.
- Javítás: ugyanaz a szabály, mint az eladás-kikapcsolt modulnál — aki birtokolja, megtartja
  (élesen 2 bérlő: ferenc-haz, nyugalom-demo), új vétel se a listán, se POST-tal.
- Őr: `scripts/retired-module-shop-check.mts` (javítás előtt 2 piros, önteszt piros, nem ír).
- Nyitott (tulaj): a birtokosok fizetnek egy működésképtelen modulért (az űrlap nem létező
  végpontra POST-ol, `src/modules.ts` komment).

## ② Süti-sáv a bejelentkezett adminban — KÉSZ
- Kell-e: IGEN — ADR-0145 ③ már eldöntötte (a Barion Pixel az adminban is betölt).
- Mérve 390×844: a sáv 660–784 (125 px); 5 képernyő legalsó mentés-gombja SOSEM volt kigörgethető
  alóla (Megközelítés, Vélemények, Foglalás, Árak, Modulok). A közben landolt kosár-szál (ADR-0255)
  kosár-gombja és a nyitott kosár „Bezárom”-ja is a sáv alá esett.
- Javítás (ADR-0145 ④ mintája): `.adm-main__inner` alja + `html{scroll-padding-bottom}` a
  `--citui-consent-h`-val; bulk / toast / többnyelvű ár-sáv / kosár-gomb a sáv fölé; a kosár-lap
  `min(h*1000, bottom+h)`-val emelkedik (döntés után 0). ⚠️ A helyi `--adm-*` segédváltozót a
  design-token-lint tiltja → a kifejezés kétszer kiírva.
- Őr: `scripts/consent-admin-actions-check.mts` (telefon+asztali, ①–④; önteszt: régi CSS → piros).
- ⚠️ Mérési csapda kétszer: smooth-scroll (y=0 a scrollTo után) és a toast transition.

## ① Néma „Hozzáadás” — KÉSZ (terv `design-refs/tenant-admin/room-add-B/`)
- Egy közös `newUnitForm()` (Szobák 1 és több szobával + Foglalás): csukott „Új szoba felvétele”
  sáv → kiemelt doboz; minden döntés a gomb FÖLÖTT; hiányzó válasznál piros sor a gomb alatt, a
  lap az ÜZENETET hozza be (a scroll-padding miatt a süti-sáv fölé); „Meglévő szobája” felirat.
- JS nélkül a `required` marad; JS-sel az `invalid` eseményt vesszük át (a többi natív check él).
- Őr: `scripts/room-add-form-check.mts` (valódi böngésző, SOHA nem ment; önteszt: a régi
  elrendezés visszarakva → 16 piros; az „üzenet a sáv alatt” ág külön negatív kontrollal igazolva).

## „Egység” → „szoba” MINDENHOL (tulaj) — KÉSZ
- ~35 tenant-admin szöveg (`moduleConfigViews`, `bookingViews`, `adminViews`, `units.ts`), 5 súgó-
  cikk, FK-013, 2 őr (`whole-property-choice-check`, `booking-screen-check`), 5 kontraktus-README.
- NEM érintett: a vendég-oldal (`hu-voice-check` őrzi).
- ⚠️ A 6 nyelvi csomag + a súgó-fordítás a NAGY DEPLOY ELŐTT újrafordítandó (tulaj: „deploynál
  csak”) — felírva: `_planning/DEPLOY-READY.md`.

## ④ Ár-tájékoztatás — KÉSZ (terv `design-refs/tenant-admin/price-where-2/`)
- „Hol látják a vendégek az árait?” doboz az Árak képernyőn + az ár nélküli szoba helyben is
  („A honlapon a szobakártyáján nem lesz ár, és az ártáblázatban sem szerepel.”).
- EGY szabály: `siteShowsPriceTable()` (moduleSections, a renderelő is ezt hívja), a VÉGSŐ lap-adaton
  (`effectiveSiteForMultilang`) → `src/tenant/priceSiteView.ts`.
- Őr: `scripts/price-where-check.mts` — 10 valódi bérlő renderelt lapja vs. az admin doboza,
  mindkét ág képviselve (tábla: 4, csak kártyák: 6); önteszt: 10 piros.
- Saját hiba a tervben: „minden egységnél az alapárával” — az egész szállásnak nincs ára; javítva.

## ⑤ „Nem kiadó egész → tűnjön el” — a Foglalás-szál landolta (ADR-0256), az admin-oldal rákötve
- ADR-0256 ③ szerint a „nincs ára” figyelmeztetés ugyanazt a szabályt hívja: a rejtett egységért
  (represents_whole és NEM is_whole_property) se Árak-kártya sor, se teendő, se heti emlékeztető.
- A predikátum szöveg nélküli modulba költözött (`src/tenant/unitVisibility.ts`, a `units.ts`
  re-exportálja), mert a levél-útvonal (`priceGap.ts`) nem húzhatja be a `units.ts` magyar szövegeit.
- A `guestUnits` sosem üres: ha csak a rejtett egység maradt, azt árazni KELL (így is mérve).
- Őr: `scripts/hidden-unit-price-gap-check.mts` (tiszta, DB nélkül — a dev DB-ben ma nincs rejtett
  egység; `priceGapsOf` + a renderelt kártya, pozitív kontrollokkal; önteszt piros).

## Utókör: a 4. szoba eltűnt a lapról (e4d05534) — a price-where-check fogta meg
- A koordinátor új bérlőjén (kemences-vendeghaz, 4 egység, `wordmark-grow` sablon) a ② bukott:
  a doboz 19 000 Ft-ot mondott a Kerti stúdió kártyájára, a lapon nem volt ilyen kártya.
- Ok: a `wordmark-grow` és az `arch-frames` `rooms.slice(0, 3)`-mal renderelt (3 oszlopos
  mock-maradvány) → a 4. szoba kártyástul, árastul eltűnt, a foglaló választója viszont kínálta.
- A kapu a TISZTA mainen is piros lett, és minden szál land-ját megállította — ezúttal HELYESEN
  (valódi renderelő-hiba). Javítás: a vágás ki; őr `scripts/rooms-all-shown-check.mts` (19 sablon,
  5 szoba, DB nélkül; az első, csak `<section>`-horgonyt kereső változat 9 sablont némán kihagyott).
- ⚠️ Visszavont vállalás: a price-where-check-et NEM tettem fixture-re — a doboz és a lap ugyanabból
  a végső adatból készül, eltérés csak valódi renderelő-hibánál van; a valódi bérlők kihagyása épp
  ezt vakította volna meg (a koordinátor elfogadta). Tanulság a körvezetőknek: a közös DB-ben
  félbemaradt teszt-bérlő zajként is megállíthat egy idegen land-ot → takarítás/jelölés a kör után.

## Mellékleletek (nem nyúltam hozzá)
- `/api/foglalas` hibája a vendégnek: „Ismeretlen egység.” (a `hu-voice-check` nem látja a JSON-hibát).
- Egy-szobás képernyőn a meglévő szoba „Mentés”-e nem küld `back=rooms`-t → a Foglalásra tér vissza.

## Módosított fájlok
`src/tenant/modules.ts` · `src/tenant/moduleChange.ts` · `src/tenant/priceSiteView.ts` (új) ·
`src/tenant/units.ts` · `src/engine/moduleSections.ts` · `src/server/moduleConfigViews.ts` ·
`src/server/public.ts` · `src/server/adminViews.ts` · `src/server/bookingViews.ts` ·
`public/assets/ui/citui-admin.css` · `src/i18n/catalog.json` · `hooks/pre-commit` ·
`scripts/{retired-module-shop,consent-admin-actions,room-add-form,price-where}-check.mts` (új) ·
`scripts/{whole-property-choice,booking-screen}-check.mts` · `scripts/kb-shot.mts` ·
`kb/entries/{admin-modules-rooms,admin-modules-booking,admin-modules-pricing,admin-photos,admin-bookings}/entry.hu.md` ·
`elek/scenarios/FK-013-owner-fill-everything-mobile.md` ·
`assets/design-refs/tenant-admin/{room-add-B,price-where-2}/` (új) ·
`assets/design-refs/tenant-admin/{room-editor,booking-screen,price-on-request,admin-linear,whole-property-choice}/README.md` ·
`_planning/DEPLOY-READY.md`
