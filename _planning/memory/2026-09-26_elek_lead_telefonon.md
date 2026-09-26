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
