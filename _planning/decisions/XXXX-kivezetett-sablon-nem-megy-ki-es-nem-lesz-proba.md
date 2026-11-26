## ADR-XXXX — Kivezetett sablonú mock nem megy ki újra, és nem épül belőle próba-oldal

**Dátum:** 2026-11-26 · **Státusz:** elfogadva (tulaj: „1 ok javítsd”) · Épít: ADR-0423 (új mockhoz csak három sablon)

### Kontextus

Az ADR-0423 csak a GENERÁLÁS ajtaját zárta: a konzol-választó, a generátor és a motor nem fogad el
kivezetett sablont új mockhoz. A régi mockot ÚJRAHASZNÁLÓ utak viszont nem nézték, melyik sablonon
készült a mock. Élesen mérve (2026-11-24):

- 11-17 és 11-18 között 39 nem-nyitó utánkövető levél ment ki kivezetett sablonú mock képével
  (23 horizontal, 15 fullbleed, 1 tilted-gallery);
- a Freedom 50 Apartman próbája (11-24) egy októberi link horizontal 1. tervére épült.

A hideg kiküldést csak közvetve védte a mock dátuma (`MOCK_MIN_GENERATED_AT`), a sablont nem.

### Döntés

1. **Kiküldés:** minden kiküldési kapu közvetlenül ellenőrzi a sablont (`src/outreach/templateGate.ts`).
   Csak a parallax, a gate-opening és a wordmark-grow mehet ki; minden más, és a recept nélküli régi
   HTML-másolat is, kimarad, operátori indokkal („friss mock után mehet”). Bekötve:
   - `artifactBlocks`: a nem-nyitó utánkövető levél, a próba-kampány levele és a viselkedés-levél;
   - `mobileOutreachGates`: minden SMS és MMS, a hideg is;
   - az automata kiküldési sor: a sorba tétel és a küldés („held”).
2. **Próba:** kivezetett sablonú tervből nem épül próba-oldal. Ha a link valamelyik másik terve a
   tulaj sablonján készült és nincs elutasítva, a próba abból épül, és a Kinézet fülön a többi terv is
   ott van. Ha nincs ilyen terv, a próba nem indul (`not_available`), és a ház riasztást kap, hogy friss
   mock kell. A már felépült próbához nem nyúlunk.
3. **Nem része a döntésnek:**
   - A fizetős rendelés nem utasítható el (tulaj 2026-09-13: „a vevő rendelése a jóváhagyás”,
     fizető vevőt kapu nem fordíthat vissza). Aki a konfigurátorban kifejezetten ezt a kinézetet
     rendelte meg, az kapja meg, és a Kinézet fülön válthat.
   - A régi linkek oldala továbbra is a régi tervet mutatja (ADR-0423: a régi mockok renderelnek).
     A 211 régi horizontal link sorsa külön tulaj-döntés.

### Őr

`scripts/retired-template-send-check.mts` (pre-commit, statikus): a döntést és mind a hat bekötést
méri, önteszttel. A próba viselkedését a `scripts/trial-plan-binding-check.mts` ④ pontja méri
(horizontal 1. terv → a 2. tervből épül; csak horizontal → `not_available`, nincs tenant). A
próba-, kampány- és utánkövető-őrök tesztadatai a tulaj sablonjaira álltak át.
