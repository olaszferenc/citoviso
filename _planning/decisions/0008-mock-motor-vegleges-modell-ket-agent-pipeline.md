## ADR-0008 — Mock-motor VÉGLEGES modell: két-agent pipeline + típus-osztályozás + rotáció

- **Dátum:** 2026-07-10
- **Kontextus:** a tulaj cset-mintái vadul sokszínűek; a live aiMock ezekhez képest samey (DESIGN-CATALOG §6).
  A tulaj lefektette az irányt (korpusz-építő agent + osztályozás + régió-anti-collision + használat-rotáció).
  ⚠️ **NEM bagatell:** az első benyomás dönti el a lead további sorsát.
- **Döntés — KÉT agent, tiszta szétválasztás:**
  1. **KORPUSZ-ÉPÍTŐ agent (offline, batch):** típusonként (Környezet×Minőség[×Stílus]) **≥5 tényleg-más**,
     magas minőségű referencia-dizájn. Growing, curated. „Ne szarjon be" = bátorság-kényszer a promptban +
     a `structures/` few-shot mint minőség-léc. (Ez tölti fel a 36 metszetet 5-5 variánssal.)
  2. **MOCK-GENERÁLÓ agent (per-lead, live = a mostani aiMock, kiegészítve):**
     a. **Osztályozás:** lead → típus (vízió + adat).
     b. **Kiválasztás:** a típushoz illő korpusz-dizájn, figyelembe véve (i) **régió-anti-collision**
        (a szomszédok kapott stílusai), (ii) **használat-rotáció** (a típus legkevésbé használt variánsa — rangsor).
     c. **GROUNDED ADAPTÁCIÓ (nem naiv fill):** a kiválasztott dizájn mint blueprint/few-shot → a VALÓS
        tényekkel generál; valós fotó, ismeretlen szekció **KIHAGYVA**. → nincs kamu, nincs üres/tört slot.
- **Adatszerkezet:** corpus = típus-tagelt dizájn-könyvtár (`assets/design-refs/` → később struktúrált/DB);
  usage ledger = `mock_artifact.inputs` (archetípus + corpus-design-id + típus) → rotáció + anti-collision lekérdezhető.
- **⚠️ Caveat (tényhűség):** a korpusz-dizájn a CÉL-gazdagság; a per-lead adaptáció a VALÓS adathoz szabja.
  A tartalmi gazdagságot valós enrichment (POI/vélemény/felszereltség) növeli — párhuzamos szál, nem blokkol.
- **Visszafordíthatóság:** 🔄 · Építi tovább ADR-0007-et (aiMock = az agent-2 motorja).
- **Státusz:** ELFOGADVA — **ez a lefektetett modell.**
