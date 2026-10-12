## ADR-0365 — Szerver-oldali adat inline `<script>`-be csak a `jsonForScript()`-en át

**Dátum:** 2026-10-11 · **Státusz:** elfogadva (az Elek-teszt koordinátor briefje: „JSON a `<script>`-ben escape nélkül”)
· **Forrás:** ADR-0363 (a tulaj-admin Foglalások fülének valódi XSS-e), scratch-DB-mérés a konzol lead-térképén
· **Kapcsolódó:** ADR-0363.

**A lelet.** A `${JSON.stringify(x)}` egy inline `<script>`-ben nem biztonságos: a HTML-elemző a szkript-blokkot az első
`</script`-nél zárja, egy JSON-sztring belsejében is. ~100 helyen állt így (konzol, tulaj-admin, kapcsolat-űrlap, a generált
oldal konfigurátor-manifestje és intro-képlistája, modul-előnézet), és öt fájl saját, féloldalas helyi escape-et írt
(csak `<`, U+2028/2029 nélkül). **Mérve (scratch-DB, a javítás előtti `mapPage`):** egy `</script><img src=x onerror=…>`
nevű lead a konzol `/scrape/map` lapján a betöltéskor LEFUTOTT (2 futás, 2 befecskendezett elem) — a lead-nevek a
Google-scrape-ből jönnek, tehát kívülről írhatók. Élesen (olvasva, 2026-10-11) a 8 995 lead közül 0 nevében és 0 címében
van `<` — kihasználva nem volt.

**Döntés.**
1. **Egy közös függvény:** `src/text/jsonForScript.ts` — `JSON.stringify` + `<` `>` `&` `'` U+2028 U+2029 → `\uXXXX`.
   Az érték nem változik (mindegyik karakter csak JSON-sztringben fordulhat elő, ahol a `\uXXXX` ugyanazt jelenti);
   a `'` miatt egyszeres idézőjeles kezelő-attribútumban (`onclick='f(…)'`) is biztonságos.
2. **Minden inline `<script>`-be írt szerver-adat ezen megy át** — a helyi `scriptJson`/`j` segédek és a kézi
   `.replace(/</g,"\\u003c")` megszűntek. A `jsStr` (egyszeres idézőjeles JS-literál) `<`-t, CR-t és U+2028/2029-et is
   escape-el.
3. **Őr:** `scripts/json-for-script-check.mts` — statikus (`${JSON.stringify(` `<script`-et író fájlban, saját `<`-escape,
   `<script>` + `JSON.stringify` összefűzés, `const x = JSON.stringify(…)` + `${x}`) minden `src/*.ts` változásnál; dinamikus
   (scratch-DB, mérgezett lead, valódi konzol `/scrape/map`, Chromium) a lead-térkép útján. Önteszt: a javítás előtti fán
   mindkét fele piros (statikus 99 lelet, dinamikus 4 bukás).

**Nem tartozik ide (jelezve a koordinátornak):** az AI-mock útvonal (`src/generator/generate.ts`) a modell által írt teljes
HTML-t szűrés nélkül írja ki — egy scrape-elt véleménybe rejtett prompt-injekció szkriptet tehetne a mockba.

**Visszafordíthatóság.** 🔄 olcsó: tisztán kimeneti escape, adat és séma nem változik.
