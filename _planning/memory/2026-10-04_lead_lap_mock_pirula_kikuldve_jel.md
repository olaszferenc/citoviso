# 2026-10-04 — Lead-lap mock-pirula = lista szabálya; „✓ kiküldve” = bármelyik csatorna

SUB-szál (koordinátor: wt/citcad90429), tulaj-döntés 2026-10-04: „javítsuk”.

## Elvégezve
- **Egy szabály, egy függvény:** `summariseMocks()` (`src/console/leadFilters.ts`) adja a lead-lista
  MOCK celláját ÉS a lead-lap „mock: …” pirulát (legerősebb állapot: jóváhagyva > legenerálva >
  elutasítva, a többi a title-ben). Boróka ház (1 jóváhagyott + 2 újabb elutasított): a lap
  „elutasítva” helyett „jóváhagyva”-t ír, a listával egyezően.
- „van jóváhagyott mock” jelölés: már csak futó generálás alatt jelenik meg (különben a pirula
  maga mondja ki).
- **„✓ kiküldve”:** a jel `prospect.sent_at` (első érintés BÁRMELY csatornán) — a jelmagyarázat
  és a KB már nem „e-mail”-t mond; az elemleírás az első kiküldés idejét és a VALÓS csatornákat
  írja (`email_sent_at`/`sms_sent_at`/`mms_sent_at`), bélyeg nélkül csatornát nem talál ki.
  Az első kiküldés ideje most a legkorábbi `sent_at` (eddig egy tetszőleges prospect-soré).
- Őrök: `mock-state-label-check` újraírva (lista = lap ⑤ + negatív kontroll: a régi
  „legutóbbi” szabályon 6 bukás); `lead-filter-label-check` +4 állítás (jelmagyarázat, csatorna-title).
- Elek FK-003b: a generálás végét a kész-sávra várja (a meleg parkban a pirula „jóváhagyva” marad).

## Fájlok
src/console/{leadFilters,data,views}.ts · scripts/{mock-state-label-check,lead-filter-label-check,
lead-list-plan-check,kb-shot}.mts · kb/entries/console-lead{,s}/entry.hu.md ·
elek/scenarios/FK-003b-…, FK-004-… · src/i18n/catalog.json

## Nyitott
- `hooks/pre-commit` mock-state-label-check komment-sora még a régi kettős kérdést írja
  (szándékosan nem érintve: a kapu-fájl érintése a saját triggereit tüzeli).
- A fagyott terv-fájlok (`assets/design-refs/console/lead-list/plan.html`, `help-start/approved-C.html`)
  a régi „e-mail” szöveget őrzik — történeti kontraktus, nem módosítva.
