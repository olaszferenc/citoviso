# 2026-08-30 — Üres MMS-kép javítás + ADR-0087 név-masthead kontraktus minden sablonban

## Elvégzett munka

### ① Üres MMS-kép (tulaj: „a Mock egy fos! Valami üres szart küldünk most ki!")
- **Gyök-ok:** a lake-balaton.com fotóhost a szó szerinti `HeadlessChrome` UA-tokenre 429-et ad
  (curl 200) → a mock hero fotó nélkül renderelt, a `heroShot.ts` pedig ellenőrzés nélkül
  cache-elte és MMS-ben/e-mail-előnézetben kiment az üres kép.
- **Javítás** (`src/outreach/heroShot.ts`, landolva `d474326`): first-screen kép-verifikáció
  (img.complete/naturalWidth + bg-URL hálózati napló; törött kép = nincs shot, retry után null →
  a pár-küldés hangosan megáll); becsületes `citoviso-bot` UA (politeness-elv, és 200-at kap);
  hostonként sorosított képkérés; cache v3→v4. Piros/zöld önteszt + valódi Levendula-shot képen
  ellenőrizve.
- ⚠️ Csapda, amit fogtunk: a tsx/esbuild `__name` helpert injektál a page.evaluate függvénybe →
  a böngészőben ReferenceError → MINDEN shot elhasalt volna. Megoldás: string-forrású evaluate.
- A Levendula teszt-prospect (`68d74781…`) MMS/SMS-pecsétjei nullázva → újraküldhető.

### ② ADR-0087 — név-masthead kontraktus (lásd az ADR-t a részletekért)
- Az első körben méretnövelést adtam dizájn helyett → tulaj-dörgedelem; a tanulság:
  `~/.claude` memória `feedback_size_inflation_is_not_design` + a referencia-mockokból induló
  újratervezés (A=masthead, B=monogram, C=filmcím) → **az A irány nyert, motor-szintre emelve**.
- Közös primitív (`templateKit.ts`: mastheadHtml/mastheadCss, `--mast-*`), 14 sablon átállítva
  3 párhuzamos agenttel (fullbleed kézzel = minta), minden első képernyő (14×2) saját szemmel
  képen ellenőrizve; 1 hibát találtam (parallax mobil ráfolyás) — javítva.
- Nyelvváltó-chip → masthead link-sávba szövés (multilangCore), láthatóság-őr 32/32 zöld.
- Aurora: az agent latens fixed-nav bugot talált és javított (`body>*` szelektor-specificitás).
- Landolva `50225f0`; fő fa Levendula-mockjai újarenderelve (snapshot-propagáció szabály).

## Módosított fájlok
- `src/outreach/heroShot.ts` — first-screen verify + UA + sorosítás + v4
- `src/engine/templateKit.ts` — masthead primitív
- `src/engine/templates/{fullbleed,parallax,darkLuxury,cinematic,horizontal,dopamine,transit,organic,artdeco,scrapbook,watercolor,aurora,brutalism,claymorphism}.ts`
- `src/tenant/multilangCore.ts` — chip a masthead link-sávjába
- `scripts/ui-shot.mts` — citoviso-bot UA
- `scripts/masthead-sweep.mts` — ÚJ: egy lead inputja minden sablonon át
- `assets/design-refs/engine/name-masthead/{approved-masthead.html,README.md}` — kontraktus
- `_planning/DECISIONS.md` — ADR-0087

## Nyitott kérdések / következő lépések
- A tulaj újraküldheti az MMS-párost a telefonjára — az új kép a masthead-es első képernyőt viszi.
- Sablon-dialektus finomítás igény szerint (a tulaj sablononként kérhet hangolást).
- A 4 nav-törléses flow-sablonban desktopon nincs visszatérő sticky sáv görgetve — a kontraktus
  szerinti út; ha hiányzik, külön kör.
