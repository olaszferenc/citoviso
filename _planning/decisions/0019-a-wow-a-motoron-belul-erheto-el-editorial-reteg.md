## ADR-0019 — A „wow" a MOTORON belül érhető el (editorial réteg + mozgás); NINCS HIBRID, nincs bait-and-switch

- **Kiváltó (2026-07-24/26):** az ADR-0018 nyitva hagyta a plafon-döntést (A=motor vs B=bespoke vs HIBRID).
  Elvégeztük a teherhordó kísérletet UGYANARRA az adatra: a bespoke (B) előnye **nem sablonozhatatlan
  varázslat**, hanem (1) **szerkesztőségi szöveg** (per-szekció márkahang) + (2) néhány **strukturális
  ízlés-mozdulat** (editorial hero, aszimmetrikus showcase) + (3) **mozgás** (reveal, ken-burns, hover).
  Mindhárom BEÉPÜL a motorba, additívan, a `mock=live` feláldozása NÉLKÜL.
- **Döntés:**
  1. **Motor-út marad, felokosítva.** A bespoke/HIBRID út ELVETVE. A wow-t a motor adja → `mock=live`
     megőrizve, nincs downgrade a fizetés után (**§I** bait-and-switch tilalom konstrukció szerint teljesül).
  2. **Szerkesztőségi réteg:** `SectionCopy` a receptben (eyebrow/cím/akcent + hero-lead) + `heroEditorial`
     és `roomsShowcase` variánsok (`src/engine/primitives.ts`). A copy forrása egy **grounded copywriter**
     (`src/engine/copywriter.ts`) — a motor MÁSODIK AI-lépése a planner után; §B.17-hű (számot sosem talál ki).
  3. **Mozgás-réteg:** keresztmetsző, token-only `MOTION_CSS` (`primitives.ts`) + `autoReveal()` a runtime-ban
     (`assets/runtime/cit-runtime.js`) — lépcsőzött scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés.
     `prefers-reduced-motion` + no-JS → teljesen statikus (semmi nem tűnik el). `mock=live` biztos.
- **Bizonyíték (éles-validált):** valós scraper-leadek (Villa Oliver/Gödöllő, Villa Pátzay + Rózsakő ház/Badacsony),
  mind HIGH-konfidenciájú tiszta match, valós Google-fotó+rating, három külön skin, mozgással. A tulaj: „wow" → „sokkal jobb".
  Proof-scriptek: `scripts/engine-{max-plus,from-lead-plus}.ts` (az éles `generateEngineMock` egyelőre ÉRINTETLEN).
- **Tényhűség:** a copywriter csak a megadott valós tényekre támaszkodhat (szám csak valós adatból); a szoba/vélemény
  §B.17 szerint jelölt minta valós adat híján. A Fortuna-eset megmutatta: a match-gyanú (név-egyezés 0,17) helyesen
  KÖZEPES sávot + kurátor-flaget kap → a rendszer nem attribuál vakon.
- **Visszafordíthatóság:** 🔄 — minden additív (új modul + variánsok + runtime-bővítés); az éles bekötés még hátra.
- **Státusz:** ELFOGADVA (a tulaj minőségi visszaigazolásával). Hátralévő: a copywriter+mozgás **éles bekötése**
  a `generateEngineMock`-ba (konzol/CLI), majd opcionális finomítás (világos-skin hero-scrim, GYIK-modul, hero-parallax).
