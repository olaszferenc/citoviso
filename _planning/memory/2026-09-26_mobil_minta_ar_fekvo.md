# 2026-09-26 — Minta-ár a mock foglalás-widgetjében + a két fekvő-tartású lelet a motorban

**Brief:** `~/rc-briefs/mobil-minta-ar-fekvo-brief.md` (szülő: `cite8fb512d`). Tulaj szó szerint: „Javítsd a fekvőket
és legyen minta ár" — a saját ergonómiai belátás szerinti építés + utólagos ítélet mandátuma áll. **ADR-XXXX**
(`_planning/decisions/XXXX-minta-ar-a-mock-foglalas-widgetben-es-fekvo-focim.md`). Nem élesítve (a nagy deployjal megy).

## Mi épült (mind a MOTORBAN — a mock-fájlokat kézzel nem érintettem)

### ① Minta-ár — a próba a FOGLALÁS-utat játssza (`assets/runtime/cit-runtime.js`, `cit-modules.css`)
- `demoPricing(unitId)` a `demoBlocked` mintájára: egységenként 24 000 / 28 000 / 32 000 Ft éjszakánként (HUF,
  `per_night`, egy alapár-sor), a `loadAvailability` demo-ága tölti. Így a `quoteFor` demóban sosem null → az
  árajánlat-mód (`setAskMode`) nem áll elő; a gomb „Foglalási kérés elküldése".
- Jelölés ott, ahol a számot olvassák: ár-doboz cím „Minta-ár — <dátumok>", alap-sor „A minta-ár a TELJES
  SZÁLLÁSRA szól éjszakánként…", összeg „Összesen a szállásért (minta-ár)" (a telefonos 2. lépés összegző sávja ezt
  tükrözi), mondat „Ez minta-ár, nem az Ön szállásának ára — az éles oldalon itt a saját árlistája jelenik meg…", a
  helyszíni-tétel doboz demóban nem állít IFA-t a szállásról („Az éles oldalon itt jelenik meg, ami a helyszínen
  fizetendő (pl. idegenforgalmi adó) — az összeget Ön adja meg.").
- Demo-nyugta: „Így néz ki, amikor a vendége foglal" + a minta tényei (időszak, éjszakák, létszám, egység,
  „Összesen (minta-ár)"). **Invariáns:** a nyugtát UGYANAZ az `askMode` vezérli, mint a gombot — ha az árajánlat-mód
  mégis előáll, a nyugta „…amikor a vendége árajánlatot kér… Ön árajánlattal válaszol"; `data-cit-done="book|ask"`.
- Az élő út érintetlen (ott az ár a `/api/foglaltsag`-ból jön; az őr álpozitív kontrollja méri).
- **Új őr:** `scripts/mock-booking-sample-check.mts` (pre-commit, `--selftest`): valódi runtime, naptár-kattintás,
  390 (a „Tovább"-on át) + 1280; független felismerők; 3 szabotázs (minta-árlista ki → a foglalás-út állításai
  buknak, az invariáns ÁLL; nyugta-ág laposra → invariáns bukik; a 4 minta-felirat ki → minta-jelölés bukik), mind
  igazolt cserével. ⛔ Első verzió: a `page.evaluate(sztring, arg)` a függvény-sztringet NEM hívja meg (undefined
  jött) → IIFE-sztring; a `\b` a „72 000 FtMódosítom" textContent-ragadáson bukott; a szabotázs a 4. feliratot
  (alap-sor) elsőre nem vitte, és a selftest ezt kifogta.
- `tenyhuseg-or`: **PASS** a minta-árra (szűkített kérdés); két megjegyzése beépítve (alap-sor is „minta-ár"-t
  mond; az ADR kimondja, hogy az ADR-0061 ② „kitalált ár SOHA" az ÁRTÁBLÁRA áll, ez a foglalás-widgetre szűkített,
  tulaj által rendelt kivétel). A mock tárolt `factVerdict=flag` (9 tétel) a mai munkától független, kurátor-sor.

### ② Fekvő (844×390) — a főcím nem rögzített réteg alatt
- **dark-luxury** (`src/engine/templates/darkLuxury.ts`): `max-height:500px and min-width:701px` → a masthead a
  FOLYAMBA lép (oszlop-flex, `.cit-mast{position:relative}`), a hero `height:auto;min-height:100svh`, `.t-heroin`
  padding-top 28. Mérve: a valódi Alig-vár mockon a főcím −20 px-ről (a masthead dobozában) → a masthead alatt,
  levegővel. Portré + asztal pixelre azonos (a media-query nem éri el).
- **tilted-gallery** (`tiltedGallery.ts`): `max-height:500px and min-width:641px` → a hero `height:auto;
  min-height:calc(100svh − 73px nav)`, `padding-bottom:calc(70px sáv + --citui-consent-h)`, a hely-sor és a
  görgetés-jel elmarad. Mérve a fixtúrán: a név 298→376 (sáv 320) helyett 152→231, 89 px a sáv fölött; a valódi
  mockon a név + lead-sor + tagline a sáv fölé fér (a tagline utolsó sora 5–7 px-re a sávtól — szoros, de fölötte).
- **immersive-parallax archetípus** (`archetypes.ts`): a 4 900 px-es tapadó dokk fekvőn a galériára ült (⑧nagyítás
  HIBA — a kép nem volt érinthető, ELŐZŐ állapot, nem az én változásom) → fekvőn is statikus (`max-height:500px`).
- **Új őr-szabály** `guest-mobile-check` ②főcím-takarva (HIBA) / ②főcím-szorul (ERGONÓMIA): az első látható h1
  sor-közepei ÉS a doboz első/utolsó 3 px-e `elementFromPoint`-tal — fixed/sticky réteg vagy overlay `.cit-mast`
  veszi-e el; a masthead aljától <12 px, vagy rögzített sáv <12 px-re a főcím alatt → ERGONÓMIA. Önteszt: a főcím
  alsó felére szkripttel ültetett rögzített sáv → piros. **Valódi hibán igazolva:** a régi (fő-fás) Alig-vár
  dark-luxury mock fekvőn HIBA (header.cit-mast, 1/4 sor), a régi tilted „szorul"; a javított motorral 0 HIBA.
  ⛔ Az első, csak sor-közepet mintázó változat MINDKÉT valódi hibát tisztának mondta (a hiba a szélen ült) — a
  szél-mintázás ezért került be.

## Mérések
- `guest-mobile-check --selftest`: tiszta lap 0 HIBA, 8 ültetett hiba piros (ÚJ: selftest-h1-under-bar).
- `guest-mobile-check` kapu-mód 390 (30 sablon+archetípus): 0 HIBA; `--vp=land` (30): 0 HIBA (előtte 2:
  immersive-parallax ⑧nagyítás + ⑤tapadó-sáv, meglévő). `lead-mobile-check --gate --selftest`: zöld;
  `mobile-sticky-check`: 30/30 PASS.
- `mock-booking-sample-check`: zöld + selftest 3/3 piros.
- Régi mockok fekvőn (fájl-mód, dark-luxury + tilted): 1 HIBA (②főcím-takarva) + szorul; frissen: 0 HIBA.
- FK-010 a friss Alig-vár cinematic mockon: pass=1 fail=0 manual=17.
- FK-008b: **nem futott végig — a park ELŐZŐ hibáin akadt el, nem a mai változáson.** `run-all FK-004 FK-008b`:
  az FK-004 „Követett link készül" lépése a konzol behajtott nav-csoportjában (`div.con-nav__kids display=none`,
  a 2026-09-25-i Linear-nav) nem éri el a gombot (timeout), az FK-008b előkészítése pedig az ELEK-TESZT követett
  linkjén a **Laguna Panzió** mockját kapta (a park linkje másik leadre mutat). Mindkettő a konzol/park szála.
  Az FK-008b foglalás-lépéseit (MINTA-jelölés, „Foglalási kérés elküldése" → „Így néz ki, amikor a vendége foglal",
  „Ez kipróbálás volt") a `mock-booking-sample-check` méri független felismerőkkel, és az FK-010 a fájlon.

## Módosított / új fájlok
- `assets/runtime/cit-runtime.js` (demoPricing, renderQuote minta-jelölés, demo-nyugta askMode-ra), `assets/runtime/cit-modules.css` (`.cit-book__qsample`)
- `src/engine/templates/darkLuxury.ts`, `src/engine/templates/tiltedGallery.ts`, `src/engine/archetypes.ts` (fekvő media-blokkok)
- `scripts/guest-mobile-check.mts` (②főcím-takarva/szorul + selftest), **új** `scripts/mock-booking-sample-check.mts`, `hooks/pre-commit` (regisztráció)
- `src/i18n/catalog.json` (+8 sztring), `_planning/decisions/XXXX-…md`, ez a jegyzet, `MEMORY.md` (külön commit)
- Fő fa (a landolás után): az 57 mock `rerender-mock`-kal (Ifjúsági Szállás Tihany · Laguna Panzió · Alig-vár Tanya).
  ⚠️ A munkafa `mock-*.html`-jei SYMLINKEK a fő fába (rc-wt-prepare), ezért a munkafából futtatott `rerender-mock`
  a FŐ FA fájlját írja — a 3 Alig-vár (cinematic, dark-luxury, tilted) + az ELEK-TESZT mock így már a landolás
  ELŐTT az új motorral állt a fő fában (a végállapot ugyanez, csak korábban).

## Nyitva / a tulajnak
- Dark-luxury fekvőn a 4 soros lead-főcím (59 px betű, 14ch) a hajtás alá lóg — a főcím a masthead alatt, levegővel
  indul, de a hero nő; egy fekvő-specifikus kisebb főcím-méret külön döntés.
- Tilted fekvőn a tagline utolsó sora 5–7 px-re a sávtól (a főcím rendben, ez a soft szabály határa).
- A telefonos 2. lépés összegző sávjában „…(minta-ár) 72 000 Ft" a „Ft" új sorba törhet (a pénz-formázó sima
  szóközzel ír, egy szabály — nem nyúltam hozzá).
- A tulaj utólagos ítélete a minta-ár képein (`assets/design-refs/_drafts/minta-ar/`, a záráskor a land törli — a
  képeket elküldtem) és a fekvő előtte/utána képeken.
