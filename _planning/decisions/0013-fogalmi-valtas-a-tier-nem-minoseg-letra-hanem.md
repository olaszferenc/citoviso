## ADR-0013 — Fogalmi váltás: a `tier` NEM minőség-létra, hanem KARAKTER/REGISZTER (illeszkedés, nem „jobb/rosszabb")

- **Dátum:** 2026-07-13
- **Kontextus:** felmerült, hogy a korpuszt tierenként töltsük fel egyedi archetípusokkal (`luxus` ma
  mindössze 1 db → minden luxus lead ugyanazt a szerkezetet kapja, nincs anti-collision). A vizsgálat közben
  a tulaj elkapta a beépített hibás előfeltevést: **miért adnánk „rosszabb" minőséget egy budget helynek?**
- **Diagnózis (a fogalom túlterhelése):** a `tier` szó két, valójában ORTOGONÁLIS dolgot kevert össze —
  (1) **gyártási minőség** (kézművesség, reszponzivitás, levegősség/ADR-0012, kódtisztaság, konverzió-fókusz)
  és (2) **stiláris regiszter/illeszkedés** (paletta melege, formalitás, hangnem, képi világ). A korpusz
  tier-mappa + a szerkezet tier-hez kötése implicit azt sugallta, hogy budget = gyengébb kimenet.
- **Döntés — a `tier` átdefiniálása:**
  1. **A gyártási minőség KONSTANS, mindig maximum.** Soha nem tierezhető lefelé. A MOAT pont az, hogy
     „minimál adatból varázslatos oldal" → a budget panzió is *kiváló* oldalt kap. A „nincs semmije" lead a
     LEGÉRTÉKESEBB szegmens (max hozzáadott érték + fő MOAT) → gyenge kimenet neki stratégiai öngyilkosság.
  2. **A `tier` a REGISZTER/ILLESZKEDÉS dial-je**, nem a minőségé: „mennyire HŰ a hely valós karakteréhez",
     nem „ő megérdemel-e szép oldalt" (mindenki megérdemel). A budget helyet luxus-jelmezbe öltöztetni
     ROSSZABB: (a) hiteltelen → bizalomvesztés → alacsonyabb konverzió; (b) kevesebb inputja van (fotó/amenity)
     → a maximalista layout üres függőleges sávot termel (ADR-0012 holt sáv). A becsületes, kompaktabb,
     hozzá-hű szerkezet nem gyengébb minőség — ez a *helyes* minőség ennek a helynek.
- **Következmény a korpuszra (előkészítő, a kód még nem változik):** ha a `tier` regiszter és nem minőség,
  akkor a **szerkezet (archetípus) minőség-semleges** → az archetípus-pool legyen **közös, tier-AGNOSZTIKUS**;
  a `tier` **lágy súly + bőr-hajtó** legyen (a mai KEMÉNY `filter(e.tier===t)` helyett fokozatos szélesítés),
  nem korpusz-partíció-kulcs. A `luxus:1` gond így NEM „kevés luxus-szerkezet", hanem „rosszul kötöttük a
  szerkezetet egy minőség-címkéhez". Ez az ADR-0009 (env×tier 36-metszet eldobása) elvének kiterjesztése a
  tier-tengelyre. ⚠️ Ellenőrzendő implementáció előtt: a korpusz-fájlokba beégetett paletta átszivárog-e az
  ADAPT-lépésen (budget-blueprint → luxus lead) → külön ADR + éles A/B, ha erre lépünk.
- **Elvetett alternatíva:** tierenként egyedi archetípus-korpusz feltöltése (minden cellának saját szerkezet).
  Elvetve: (1) újratermeli az ADR-0009-ben eldobott ritka-cella töredezést a tier-tengelyen; (2) a hibás
  „budget = gyengébb" előfeltevésre épül; (3) sok fölösleges blueprint-meló egy selection+prompt-kérdésre.
- **Visszafordíthatóság:** 🔄 · tisztán fogalmi/doktrína-rögzítés, kód még nem változott; a glosszárium-definíció
  és ez az ADR önállóan visszavonható.
- **Státusz:** ELFOGADVA — fogalmi váltás; az implementációs következmény (közös pool + lágy súly) külön,
  későbbi döntés/ADR + éles A/B mögött.
