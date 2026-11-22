## ADR-XXXX — Nemzetközi A: a lead-gyűjtés országfüggő — országszótár (adatfájl) + országfüggő telefon a gyűjtő kódban és a láncban

**Státusz:** ELFOGADVA (tulaj-cél 2026-11-22 a koordinátoron át, `cit9b4690e3`: „minden folyamat adott
ország-specifikusan le tudjon futni”) · **Épít:** ADR-0437 (ország-réteg, egy sor országonként, zárt ismeretlen
ország), ADR-0450 (trunk prefix nélküli ország), ADR-0461 (HR sor).

### Döntés

① **ORSZÁGSZÓTÁR = országonként egy adatfájl** (`src/countryLexicon/<iso2>.json`, betöltő:
`src/countryLexicon.ts`). Ami a gyűjtésben NYELVHEZ kötött (típus-/stopszavak a név-egyezéshez, kapcsolat-útvonalak
és -feliratok, telefon-címkék, freemail-hosztok, „hivatalos oldal” kifejezések, ISO 3166-2 területek, OSM név-tag,
a lánc kategória- és szállásnév-listái), az EGY helyen él; az eddigi ~11 másolat (repó + lánc) ezt olvassa.
Az üzemi paraméterek (keresőszó, portál, TLD, keresési nyelv/régió, böngésző-locale, telefon-terv, időzóna)
VÁLTOZATLANUL a `country` sorban maradnak (ADR-0437).
- **Miért fájl, nem oszlop:** a percenként futó lánc (`~/rc-briefs/uj-lanc`, Python + sima Node) a repón kívül
  fut; a fájlt a fő fából (`~/citoviso`, minden land ff-eli) olvassa, így egy lista táplálja a repót és a láncot,
  deploy nélkül. Oszlopnál a lánc a deployig nem látná, és a magyar működés addig nem lehetne azonos.
- A szólisták HAJTOGATVA (kisbetű, ékezet nélkül) állnak. A célzott kulcsok (`genericNameWords`, `typeWords` …)
  a magyar KALIBRÁCIÓK szó szerint; aminek egy ország nem ad saját listát, az az ország `tradeWords`-ére esik vissza.
- Nincs fájl → `null` → a hívó kihagyja a lépést (zárt, mint a `countryConfigSync`); magyar visszaesés nincs.

② **Telefon a gyűjtésben** (`src/text/phoneCountry.ts`): `splitPhonesIn`, `phoneKeyIn`, `phoneTextPatternIn`,
`isMobileRawIn` a sor számozási tervéből. A `hu` terv MINDEN esetben a régi magyar kódra delegál (a
`HU_PHONE_TEXT_PATTERN` a régi PHONE_RE szó szerint), így magyar leadnél bájtra azonos. A `+385 (0)91 …` alakban a
zárójeles trunk-nulla nem része a számnak.

③ **A lánc** (`~/rc-briefs/uj-lanc`) a lead / terület országából dolgozik (`orszag.py` / `orszag.mjs`: sor a
prod `country` táblából, csak olvasás + gyorsítótár; szótár a fő fából). Ismeretlen ország → a lead kimarad.
Az átállás másolaton (`~/rc-briefs/uj-lanc-next`) készül, a magyar kimenet rögzített mintán bájtra azonos, és a
cron-csere csak koordinátori „mehet”-re, mentéssel és visszaállítási paranccsal (`ATALLAS.md`).

### Következmény
- Új ország gyűjtése = egy `country` sor + egy szótárfájl. Kód nem változik.
- Az őr (`scripts/country-layer-check.mts` ④) a gyűjtő fájlokra is kiterjed: magyar megyelista, `hl=hu`, `+36`-minta,
  `name:hu` beégetve nem maradhat (kivétel csak indoklással az ALLOW-listán).
