# 2026-09-26 — Elek a LEAD szemével, TELEFONON: a kiküldött terv első megnyitása (FK-009, 19 stílus × 2 lead)

**Tulajdonosi kérés:** *„…nagyon nagy a valószínűsége, hogy az első megnézés mobilon keresztül fog
történni. Így a wow effekt eléréséhez nagyon fontos, hogy a mobilnézet hibátlan legyen."* — majd a
pontosítás: *„Mindkét szál kiemelten a VIZUÁLIS ÉLMÉNYRE figyeljen… Kiemelten fontos a design, hogy
meglegyen a wow hatás, amely ott marasztalja a vásárlót, hogy megrendelje."*
Testvér-szál: „Mobil · Elek a VENDÉG szemével" (a mock TARTALMA). Ez a szál a lead-oldali BURKOLAT:
keret-sáv, „Miért kaptam?", pirula/konfigurátor, süti-sáv, lábléc, leiratkozás, betöltési súly — és
az első képernyő mint egész.

## Mi készült

- **38 követett link KÜLDÉS NÉLKÜL:** `scripts/seed-elek-lead-mobile-links.mts` — a termék saját
  `createProspect`-je (get-or-create), `contact_email = elek@citoviso.com`, kimenet
  `assets/design-refs/_drafts/lead-mobile/links.json` (`${ELEK_P_<LEAD>_<STÍLUS>}` kulcsok).
- **FK-009** (`elek/scenarios/FK-009-lead-mobile-first-open.md`, konzol, 8 szakasz / 49 lépés /
  38 env): ① első képernyő mind a 38 lapon, ② végiggörgetés, ③ vásárlói belépő, ④ leiratkozás +
  lábléc, ⑤ betöltés, összkép. Lánc: `src/elek/preconditions.ts` (`needs: []`), `run-all.mts`
  (links.json → env; hiányzik → hangos kihagyás), `SCOPE.md` sor.
- **`scripts/lead-mobile-check.mts`** — friss-betöltéses mérés mobil-emulációval (isMobile+touch,
  390×844 @2× · 360×780 · FEKVŐ 844×390), VIEWPORT-képek (első · pirula · „Miért kaptam?" · lap alja
  · konfigurátor), geometria + `elementFromPoint`, érintési cél, súly típusonként, lazy-arány;
  `REPORT.md` + `report.json`. **`--gate --selftest`** = ŐR 5 sablon-fixture-ön route-interceptorral
  (nincs szerver, nincs hálózat, nincs DB-lead), 6 szabály, 4 piros visszarontás; pre-commitban.
- **Javítások (apró-javítás kivétel — láthatatlan link / takaró sáv / betöltés):**
  1. `--citui-cfg-clear`: a pirula elhelyezője (`cit-configurator.js` placeLaunch) publikálja a
     lap alján ülő rögzített réteg MÉRT magasságát; a jogi lábléc (tracked / opted-out / owned)
     ebből tart alsó térközt (`prospectNotice.ts` FOOTER_CLEARANCE; tartalék `--citui-consent-h`).
  2. Érintési cél ≥ 24 px a lábléc- és sáv-linkeken + a „Miért kaptam?" summary-n (TAP_LINK).
  3. `lazyLoadBelowFold()` a /p/ úton: a 3. képtől `loading="lazy" decoding="async"` (a fájl a
     lemezen érintetlen).

## Mért állapot a javítás ELŐTT → UTÁN (114 lap-nézet: 38 lap × 390 / 360 / fekvő)

| mérés | előtte | utána |
|---|---|---|
| HIBA-osztályú lelet összesen | 232 | **0** |
| a lábléc Leiratkozás/Adatkezelési linkje ujjal elérhető a lap alján | 0/114 | 114/114 |
| layout viewport szélesebb a készüléknél (brutalism 515/514 px, parallax 390, brutalism-L 380) | 4/114 | 0/114 |
| a pirula koppintható + a konfigurátor kinyílik | 113/114 | 114/114 |
| FEKVŐ: a konfigurátor „Tovább a megrendeléshez” gombja eltalálható | 0/38 | 38/38 (a panel görgetésével) |
| link/summary érintési cél < 24 px | 114/114 | 0/114 |
| lap lazy-load nélkül | 16/38 | 0/38 |
| keret-sáv magassága | 107–127 px (390) · 87 px (fekvő) | változatlan (tulaj-döntés) |
| süti-sáv a képernyő %-ában | 13–24 % | változatlan |
| rögzített rétegek a lap alján, a képernyő %-ában (max) | 49 / 60 / 56 % | változatlan (tulaj-döntés) |
| súly/lap (görgetés végéig) | 1,2–5,5 MB, medián 2,3 MB, 18/38 > 3 MB | változatlan (a méretezés a motoré → testvér) |
| nincs fotó a hajtás fölött | 5 / 13 / 18 lap (390/360/fekvő) | változatlan |

Őr: `lead-mobile-check --gate --selftest` zöld (5 sablon × 2 tartás, 6 szabály, 5 piros kontroll).
Ami nem lett javítva, az mind kinézeti DÖNTÉS (§2b) vagy a testvér-szál/motor rétege — a LELETEK.md
sorolja: keret-sáv + süti-sáv + Foglalás-sáv = az első képernyő 40–49 %-a; egyforma fejléc-blokk
19/19; a pirula a főcímre ül; hero-fotó minősége; süti-gombok kétsoros törése; süti alatt
100 px-es csomag-lista.

## A wow-ítélet stílusonként

→ `assets/design-refs/_drafts/lead-mobile/WOW-390.md` (a session alatt), összegezve a
LELETEK.md-ben.


## 2. kör — tulajdonosi mandátum: a talált tételek javítása saját belátás szerint (2026-09-26, du.)

*„Javaslat szerint hajtsák végre a saját belátásuk szerint legjobb ergonómiai szempontból a talált
tételek javítását a koordinációd mellett, majd utólag ellenőrzök."* — a §2b „megállsz és vársz" erre a
körre feloldva; minden más szabály él; minden javítás a MOTORBAN (mock-fájl nem szerkesztve).

### ① Első képernyő: tömör keret + halasztott süti + sarok-pirula — **B változat** (kontraktus:
`assets/design-refs/prospect-page/first-screen-compact/`, a framing README kiegészítve)
- Két működő mock (`plan.html`, A/B kapcsoló, méret-váltó, valós px-mérő): **A** 32 % / 17 % (390 / 1280)
  nem-terv, **B** 17 % / 8 % — ma 40–49 %. B választva: a lead először a tervet lássa, a süti-kérdés az
  első görgetésnél/érintésnél jöjjön (követés addig sincs; a Pixel csak „Elfogadom" után — `consent-check` zöld).
- Motor: `injectTrackingBanner` tömör markup + saját `<style>` (telefonon az „ingyen…" tagmondat a
  részletekbe, 77 px; asztalon egy sor; ▸/▾ saját jelölő, mert az `inline-block` a natívat eltünteti);
  `deferConsentUntilEngagement()` a követett és leiratkozott ágon; `cit-consent.js`: `data-cit-consent-defer`
  → görgetés (> 40 px) / a LAP érintése / billentyű — ⛔ a `.cit-cfg*` érintése NEM (a pirula koppintása
  hozta volna be a sávot, a pirula az ujj alól csúszott — 3 mp-es instabil célpont, a konfigurátor nem
  nyílt); `cit-consent.css` ≤ 560: 12,5/1,4, 44 px-es gombok, a gomb betűje nem a sabloné (160 → 125 px);
  `cit-configurator.css` ≤ 560: pirula jobbra, egy sor, 44 px; `placeLaunch`: a CSS-alap a süti-sáv NÉLKÜL
  mérve + a sáv élő magassága minden alkalommal (a később érkező sáv a pirulára feküdt — mérve), a sáv
  jöttét/mentét MutationObserver figyeli; a lábléc-térköz az összes alsó fixed sáv legmagasabb élét kerüli
  (a sablon Foglalás-sávja 360-on magasabb a gombjánál).
- Őr: `lead-mobile-check` R7 (görgetés előtt nincs süti-sáv, sáv ≤ 90/70 px, a lap alján a sáv OTT van)
  + piros kontroll (halasztó attribútum kivágva). `prospect-framing-check`, `configurator-float-check`,
  `lead-page-surface-check`, `consent-check` zöld.

### ② Leiratkozás: GET kérdez, POST cselekszik
- `/p/<t>/unsubscribe` GET → `unsubscribeConfirmBody()` (prospectNotice, `layout` chrome nélkül): egy
  „Leiratkozom" gomb (POST ugyanoda) + „Mégsem — vissza a tervhez"; POST → `unsubscribeProspect`; a
  válasz one-clicknél (`List-Unsubscribe=One-Click` a testben vagy nem-HTML Accept) szöveges OK, embernek
  a „Leiratkozott" lap. Az RFC 8058 List-Unsubscribe-Post (POST) változatlanul egykattintásos.
- Őr: `optout-carrier-check` 0. blokk — a GET-ág forrása nem hív `unsubscribeProspect`-et és a megerősítő
  lapot adja; a POST-ág hív; az űrlap POST ugyanarra az útra, „Leiratkozom" gomb, visszaút. KB
  (console-outreach-draft) egy bekezdéssel.

### ③ Hero-fotó a TELJES képen (generátor-réteg, a mandátummal)
- Mérve: a Laguna Places-fotója (92 pont, „tiszta égbolt") — az ALSÓ fél 85 % fekete (L<40), átlag-luma 23:
  posterizált sötétkék folt; a modell az eget ítélte. `src/generator/photoHealth.ts` (sharp, 320 px-en):
  fél-fekete (≥ 60 % sötét ÉS átlag < 45) → −45; egészében sötét → −15. A levonás a TÁROLT verdiktbe kerül
  (`scoreHeroCandidates` a már letöltött bájtokból; `healthAdjustCachedScores` a régi sorokat javítja,
  idempotens `[képminőség]` jellel) → minden olvasó (generálás, élesítés, szerkesztő, felülbírálat) ugyanazt
  látja, a sorrend nem billen vissza. A Laguna-hero 92 → 47 (kurátor-küszöb alatt), az új hero a 2. Places-kép.
- `scripts/rerender-mock.mts --rehero`: cache-javítás + `rerenderArtifactWithHero` (a `repointHero` belseje,
  `offered`-őr nélkül — de CSAK sosem kiküldött linkű mockon; a kezelői pin nyer). Laguna 19/19 CSERÉLVE,
  Tihany 19/19 változatlan (nincs levonás). Őr: `scripts/hero-health-check.mts` (szintetikus képek, 7 állítás,
  negatív kontroll), pre-commitban.

## Csapdák, amikbe belefutottam (a következő szálnak)

- ⛔ **A `/p/<token>/unsubscribe` GET-re is leiratkoztat** (egykattintásos levél-link). A mérő
  „extra" lépése leiratkoztatta volna a linket — az utolsó linken fut, és a termék
  `resubscribeProspect`-jével (naplózva) állítja vissza. Ugyanez levél-előnézőknél (SafeLinks,
  iOS link-preview) HAMIS leiratkozást adhat → GYANÚ a leletek közt.
- **A sablonok `scroll-behavior: smooth`-t használnak:** egyetlen `scrollTo` animál, a próba fél
  úton olvasott → „a lap nem görgethető az aljáig" hamis lelet. Instant + ismételt görgetés,
  amíg a magasság nem stabil.
- **A telefon nem görget oldalra, hanem KISZÉLESÍTI a layout viewportot** (brutalism marquee:
  innerWidth 780 a 390-es készüléken): a `scrollWidth − innerWidth` 0, miközben a süti-sáv és a
  pirula kicsúszik a képernyőről. A készülék-szélesség az igazság (`first.vw !== vp.width`).
- A `pkill -f`/heredoc port-őr: a `CONSOLE_PORT=` szöveg a parancsban blokkol — szkriptfájlba
  írva (ui-shot-minta) fut.

## Nyitott kérdések / következő lépések

1. **Tulaj-döntés (§2b terv-kapu):** az első képernyő chrome-aránya — tömörebb keret-sáv (egy sor +
   a többi a „Miért kaptam?"-ban), a süti-kérdés késleltetése az első görgetésig, a pirula helye
   (sarok / a Foglalás-sáv mellé). Ez adja vissza a wow-hoz a képernyő ~25 %-át.
2. **→ testvér-szál / motor:** az egyforma fejléc-blokk (név–vonal–helység–vonal–FOGLALÁS) 19/19-ben;
   hero-fotó választás felbontás szerint + méretezett kép (srcset / Google `=w800`); a Foglalás-sáv
   szövegtörése (transit, dark-luxury); brutalism marquee / kilógó figure; scrapbook gombok a sáv mögött.
3. **Gy1 — a GET-es leiratkozás** (levél-előnézők hamis leiratkozása): GET = megerősítő lap, POST =
   azonnali — döntés kell (RFC 8058 a POST-ra épül, a GET-ág a mi kényelmünk).
4. Az FK-009 futás (`elek/runs/FK-009-…`) teljes-lapos képei a runner 1280/390 párjában — a
   webes teszt-naplóba felvitel (`save-test-log.mts`) a következő park-építéskor.

## Zárás (2026-09-26, du.)

- Landolva: 1. kör `babe8e07`, 2. kör `5e1ab4bb` (origin/main igazoltan tartalmazza). Semmi nem ment élesre.
- Runner FK-009 a végleges motoron: `elek/runs/FK-009-2026-09-26T13-07-50/` — 49 lépés, pass 1, manual 48, fail 0,
  zaj 0; a LELETEK.md (1.+2. kör) benne. A 2. futás sora a `runs.jsonl`-be NEM került be (a land után nem nyitottam
  új commitot érte) — a következő park-építéskor pótolandó.
- Utolsó teljes mérés (114 lap-nézet, javított motor): álló tartásban 0 HIBA, fekvőben 1 időszakos (Gy5).
- **Nyitva:** a tulaj utólagos ítélete a B első képernyőn; a felület-kapu kivétele (citui.css token) vétózható; Gy5;
  a testvér-szálnak átadott motor-tételek (fejléc-blokk, srcset, Foglalás-sáv törés, marquee).

