# 2026-09-28 — A tulaj nem tudta feltölteni a szezonárait és a programjait telefonon (brief: adatfeltoltes-szezon-program)

Két súlyos tulaj-oldali lelet az FK-013 telefonos körből (ítélet-jegyzet:
`2026-09-28_kep_itelet_telefonos_kor.md`). SUB-session, a döntés a koordinátoron át jött.

## ① Szezonárak — a FELÜLET JÓ VOLT, a forgatókönyv volt rossz (+ egy valódi telefonos hiba)
- Mérve 390×844 `isMobile+hasTouch`, tap-pel, a Nádas kártyáján: `[data-sdp=from]` → június →
  06-15 → 08-31 → „Hozzáadás” → „Mentve — az oldala frissült.”, a `unit_price`-ban visszaolvasva.
- A forgatókönyv három hibája: (1) szűkítetlen szelektorok → a lap ELSŐ kártyája („A szállás
  egésze”); (2) 390 px-en a naptár EGY hónapot mutat és a MAI hónapra nyílik → a `06-15` nap nem
  volt a DOM-ban; (3) a záró nap koppintása magától becsukja a naptárat → a kért `[data-done]` rejtett.
  Javítva: Nádas-kártyára szűkítve, a hónap az „Az év, egy pillantásra” sáv `[data-m]` gombjából
  (a mai dátumtól független), a nyitott naptár külön lépésben lefényképezve.
- ⛔ VALÓDI HIBA: `window.resize` bármikor becsukta a naptárat — a telefon a címsor be-/kicsúszásakor
  és a billentyűzetnél CSAK A MAGASSÁGOT változtatja és resize-t lő (mérve: 844 → 760 px csukott).
  Most csak szélesség-változás csuk. Őr: `season-year-price-check` (mobil+asztali, negatív kontroll
  piros); a hook-trigger eddig NEM tartalmazta a `cit-season-editor.js`-t (szűk felismerő).
- ⚠️ A runner lépésenként fekvő + asztali képet is készít (szélesség-váltás) → egy lépés végén
  nyitva hagyott naptár a következő lépésre bezárul. Ez helyes viselkedés; a forgatókönyv újranyit.

## ② Programajánló gyűjtés alatt — terv `design-refs/console/programajanlo-gyujtes/` (A)
- Mérve: `not_gathered` állapotban a szerkesztő EGY mondat volt, űrlap nélkül; a vendég-render
  csak `state==="ok" && events.length` mellett adott szakaszt → a saját program se gyűjtés alatt,
  se egy üres héten nem jelent volna meg.
- A dev gépen NINCS `citoviso-events(-pending)` időzítő → ott a gyűjtés sosem fut, az állapot örök.
  Élesen (a nagy deploy GATE 6-ja telepíti) ötpercenként fut, ott az „egy órán belül” igaz.
- §2b: A/B vázlat (mobil+asztali, működő, 52/52 Playwright) → tulaj: „Programajánló A”.
  A „saját program azonnal kint” pontot az A leírása tartalmazta; a koordinátor igennek vette.
- Kód: a választó gyűjtés alatt is teljes (Javasolt hasábban állapot + ígért idő + „Saját program
  hozzáadása”); `siteProgramPool` a nem-gyűjtött, de ismert körnél is visszaadja az `own`/`around`-ot;
  a render `no_location` kivételével a saját programokat kiteszi; „Nincs mentetlen változás.” /
  „Mentve — kint van a honlapján” + egy sor arról, hol látja a vendég (csak ha van saját program a
  kéthetes ablakban). KB frissítve (a súgó a régi „nem jelenik meg a szakasz”-t írta).
- Őr: `programs-editor-check` „gyűjtés alatt (390 px, touch)” — a VALÓDI képernyőn és a renderelt
  honlapon; negatív kontroll (régi render-feltétel) → 2 FAIL.
- FK-013 ⑨: a lépések eddig `tedd?:` alakban NÉMÁN kimaradtak; most kötelezők, és a dátumokat a
  vezénylő adja (`ELEK_NIGHT_PROGRAM_DAY_1/2` = ma+5/+6) — a rögzített október 24–25 a kéthetes
  ablakon túl volt, a vendég-kör sosem látta volna.

## Igazolás — `run-night FK-013` (Három Huszár, 2026-09-28 18:49)
- ④ szezonok: 7/7 lépés gépi ellenőrzése zöld (3 szezon a Nádason); ⑨ programajánló: 4/4 zöld,
  a vendég-lapon a „Programok a környéken” szakasz a saját programmal kint (a gyűjtés dev-en nem futott).
- Két bukás MÁS szakaszban, a közös park állapotából: ① fotó — a könyvtár 24-es korlátja betelt;
  ② első szoba — a bérlőnek már 3 szobája van, a felvevő lépés-sor erre nem illik (kattintás-időtúllépés).
- Futás: `elek/runs/FK-013-NIGHT-2026-09-28T16-48-56-2026-09-28T16-48-59`.

## Módosított fájlok
- `assets/runtime/cit-season-editor.js`, `scripts/season-year-price-check.mts`, `hooks/pre-commit`
- `src/events/picks.ts`, `src/tenant/editor.ts`, `src/server/public.ts`, `src/server/moduleConfigViews.ts`,
  `src/i18n/catalog.json`, `kb/entries/admin-modules-programs/entry.hu.md`, `scripts/programs-editor-check.mts`
- `elek/bin/run-night.mts`, `elek/scenarios/FK-013-owner-fill-everything-mobile.md`
- `assets/design-refs/console/programajanlo-gyujtes/` (README + vázlat + 4 kép)

## Nyitott
- A nagy deploy ELŐTT: az új feliratok nyelvi csomagjai (a katalógus friss, a fordítás nem).
- Az FK-013 a közös parkon NEM ismételhető tisztán: minden futás újra felveszi a 3 szobát és a
  szezonokat (a második futásnál a szerver elutasítja az azonos nevű szezont); a fotó-könyvtár
  24-es korlátja a Három Huszáron betelt → a fotó-szakasz bukik. Előkészítő takarítás kellene.
- Ha a gyűjtés beragad (dev, vagy éles időzítő-hiba), az „egy órán belül” ígéret örökre áll —
  nincs „tovább tart a vártnál” ág.
