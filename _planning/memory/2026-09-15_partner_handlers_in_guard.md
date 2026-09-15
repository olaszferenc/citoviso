# 2026-09-15 — A partnerViews 8 kezelője az őrbe: a zöldjük attribútum-sorrenden áll

**Forrás:** tulaj-kérés az ADR-0165 nyitott ② tételére („a partnerViews.ts 8 kezelőjét is
vedd be az őrbe"). **Nincs új ADR** — az ADR-0165 őrének kiterjesztése. Élesítés NINCS.

## Amit mértem

**Mind a 8 kezelő STATIKUS** — `onchange="this.form.submit()"` (7 helyen) és
`onchange="citDocFile(this)"` (1). Fordítás nem kerül beléjük, tehát **az escape-osztály
nem él bennük**: az ADR-0165 predikátuma itt üresen igaz lett volna. A valódi kockázatuk
más, de ugyanúgy NÉMA:

| kezelő | hogyan hal meg némán |
|---|---|
| `this.form.submit()` `form="docf"` társítással | ha a `#docf` űrlap eltűnik / az id elgépelődik → `this.form` **null** → TypeError → a szűrő SEMMIT nem csinál (a mező ott van, kattintható) |
| `citDocFile(this)` | ha a `DOC_FILE_JS` script lemarad → ReferenceError → a **számlakép némán nem csatolódik**, a mentés fájl nélkül megy el |

⚠️ **A forrás-darabszám nem a felület darabszáma:** a `dateF` helper KÉTSZER hívódik
(Kelte + Fiz. határidő), tehát a forrásbeli 2 `onchange` **négy** mezőt renderel. Mind a
négyet mérjük — a kapu a FELÜLETET védi, nem a forrássorokat.

## Amit változtattam

- `scripts/dialog-fires-check.mts` — két új mérés-típus (`autosubmit`, `file`), három új
  felület (`documentsPage` · `partnerPage`/documents · `documentNewPage`).
  **8 → 18 vezérlő**, továbbra is 8 nyelven.
  - `autosubmit`: a `change`-re a kezelőnek meg kell találnia a SAJÁT űrlapját (`form=`
    társítás), és tényleg BE kell küldenie. A `form.submit()` nem süt el submit-eseményt,
    ezért — mint a lemondó modálnál — a prototípus csapdázva.
  - `file`: igazi PDF-fel, a rejtett mezőnek base64 dataURL-lel kell megtelnie és a
    fájlnévnek kiíródnia.
- A trigger már eddig is tartalmazta a `partnerViews.ts`-t — most igazzá is vált.

**Állapot:** 18/18 zöld mind a 8 nyelven · a piros önteszt VÁLTOZATLANUL 9 bukás a
megnevezett halmazon (`en`/`it`/`zz` piros, `hu`/`de`/`hr`/`pl`/`sk` zöld) — a bővítés
nem hígította fel · `guard-wiring-check` zöld.

## ⚠️ Amit a zöld NEM jelent (és ezért a header kimondja)

Az ellenséges ál-csomagon mérve a partner-szűrőkön:

```
datum_onchange: "this.form.submit()"     ← TÚLÉL
datum_title:    "'"                      ← LEVÁGVA
datum_szemet:   ["\\", "tól\""]          ← szemét-attribútumok
```

Az `onchange` **csak azért él túl, mert a markupban MEGELŐZI a törött attribútumot.**
A zöld tehát **attribútum-SORRENDEN** áll, nem escape-elésen. Aki a kezelő ELÉ tesz egy
fordított attribútumot, némán megöli a vezérlőt.

## 🔴 Új, ÉLŐ lelet — JAVÍTVA ÉS ŐRIZVE (más osztály)

Az egész `src/`-et végigmérve: **97 escape-eletlen `T()`-attribútum**, és ebből **3 MA
élesben törik**, mert az `en`/`it` fordításuk idézőjelet tartalmaz:

- `src/console/views.ts` — **piac lezárása** `placeholder`
- `src/console/views.ts` — **piac megnyitása** `placeholder`
- `src/console/views.ts` — **leiratkozás visszavonása** `placeholder`

Böngészőben mérve (`en`): `placeholder` → `"On what basis? (e.g. "` — **a példa eltűnik**,
és 6 szemét-attribútum keletkezik. A `name`/`required`/`minlength` túlél, mert MEGELŐZI.
Mindhárom **kötelező, naplózott indoklás-mező** jogilag érzékeny műveletnél (piac-kapu,
opt-out visszavonás) — épp az az útmutatás vész el, ami megmondja, mit írjon a kezelő.

**JAVÍTVA** (tulaj-engedéllyel, §2b kivétel, ugyanabban a körben): mindhárom helyre `esc()`
került. Böngészőben mérve előtte/utána, `en` és `it` nyelven, mind a 3 helyen:

| | placeholder | szemét-attribútum |
|---|---|---|
| RÉGI | **csonka** („On what basis? (e.g. ") | 5–7 |
| ÚJ | **teljes** | **0** |

**ŐRIZVE:** új `placeholder` mérés-típus a `dialog-fires-check.mts`-ben — a RENDERELT DOM-on
méri, hogy a kiírt szöveg a teljes fordítással EGYEZIK-e, és hogy nem keletkezett-e
szemét-attribútum. Két új felület kellett hozzá (`settingsPage` egy nyitott + egy zárt
piaccal; `leadPage` egy LEIRATKOZOTT prospecttel). Az őr így **21 vezérlőt** mér 8 nyelven,
a piros önteszt **27 bukás** — változatlanul a megnevezett halmazon (`en`/`it`/`zz` piros,
`hu`/`de`/`hr`/`pl`/`sk` zöld).

## A MARADÉK 94 HELY — tételesen, hogy ne kelljen újramérni

⛔ **Külön kör, tulajdonosi döntés szerint.** Ma egyik sem törik (egyetlen fordításuk sem
tartalmaz `"`-t), de ez **szerencse, nem garancia**: a csomagok AI-generáltak, és egy
újragenerálás bármelyikbe tehet idézőjelet.

| fájl | db | attribútumok |
|---|---|---|
| `src/console/views.ts` | **50** | title:21 · aria-label:11 · placeholder:10 · data-l:6 · alt:2 |
| `src/server/moduleConfigViews.ts` | **22** | aria-label:14 · placeholder:5 · title:2 · data-empty:1 |
| `src/console/partnerViews.ts` | **15** | title:7 · aria-label:6 · placeholder:2 |
| `src/server/adminViews.ts` | **7** | placeholder:3 · title:2 · aria-label:2 |

⚠️ **Prioritási megjegyzés:** a `moduleConfigViews.ts` és az `adminViews.ts` **VEVŐ- és
VENDÉG-oldal** (tenant-admin + a vendégnek kimenő lapok), nem belső konzol — ott egy törött
attribútum a FIZETŐ ÜGYFÉL képernyőjén jelenik meg. A `views.ts`/`partnerViews.ts` 65 helye
operátor-felület.

⭐ Az újraméréshez nem kell új eszköz: a minta
`(\w[\w-]*)="\$\{T\((?:lang|consoleLang\(\))\s*,\s*"` a `src/**.ts`-en, keresztezve a
`language_pack` idézőjeles fordításaival.

## Nyitott

- A 3 élő `placeholder`-törés javítása (+ a 97 hely escape-elése) — tulaj-döntés.
- A konzol 7 natív dialógusának rendszer-modálra váltása (ADR-0165 ① nyitott tétel).
