## ADR-0065 — Mock-először munkarend: felület-döntés képek alapján, kód csak a kiválasztott változatra

**Dátum:** 2026-08-24 · **Státusz:** elfogadva (tulaj) · **Kapcsolódó:**
ADR-0062 (§B.19 látogató-szemű ítélet), ADR-0018 (wow-mérce), ADR-0021 (dizájn-mag).

### Probléma

A felület-munka eddig kód-először folyt: a kinézet menet közben, már megírt kódon
alakult, ezért minden design-vita drága volt (átgyúrás), és a döntés a tulajhoz csak
utólag jutott el. A tulaj korábbi fejlesztőcsapatának bevált gyakorlata a fordítottja:
előbb 2–3 mock-terv, a tulaj választ, és CSAK a kiválasztottra megy kód.

### Döntés

1. **Döntés-igényű felület-változásnál** (új felület, új szekció, elrendezés- vagy
   arculat-váltás) a sorrend KÖTELEZŐ: ① 2–3 statikus HTML mock-változat (A/B/C) a
   citui-tokenekből, valós adat-mintával, kód-bekötés nélkül → ② screenshot mindről
   (`scripts/ui-shot.mts`, 390px + desktop) → ③ a tulaj a képek alapján választ →
   ④ csak a kiválasztott változat kerül kódba.
2. **Apró javítás** (elírás, szín-fix, meglévő minta követése, hibajavítás) mehet
   közvetlenül — de ui-shot ellenőrzéssel (a nudge-hook figyelmeztet).
3. **Változat-fájlok helye:** `assets/design-drafts/<feladat>/a.html|b.html|c.html` —
   eldobható munkaanyag, nem kerül commitba (a döntést az ADR/session-jegyzet rögzíti,
   nem a draft-fájl); a screenshotok a tulaj bedobó-mappájába (`assets/Temp/`) mennek.
4. **Nagyobb design-munkára** (archetípus, landing) ugyanez a munkarend a Claude Design
   canvason futhat (claude.ai/design): változatok a canvason, tulaj-választás, handoff
   vissza Claude Code-ba — a lokál mock-változatos út a gyors alapeset marad.

### Visszafordíthatóság

🔄 Munkarend-szabály, kód-következmény nélkül; bármikor visszavonható. A „döntés-igényű"
határ tapasztalat alapján finomítandó — kétség esetén mock-először.
