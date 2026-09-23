## ADR-0209 — A Felszereltség és a szobák felszereltsége KÉT KÜLÖN LISTA (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:**
ADR-0192 ⑧.4 (lezárja), ADR-0059 döntés 2 (pontosítja), ADR-0194 (a „kifizette, de üres” sor).

### A mért tényállás (2026-09-22/23, eldobható fixture-rel, pozitív kontrollal)

A renderelő (`moduleContentFor`, rooms-ág) kihúzta a ház-szintű Felszereltségből azt a tételt,
ami egy szobánál is szerepelt (kisbetűsítve egyező). Ha a tulaj MINDEN ház-szintű tételét a
szobáknál is bejelölte, a lista kiürült, és a **kifizetett szakasz eltűnt a lapról**. Ennél is
rosszabb: az Áttekintés erre az üres kimenetre az ADR-0194 sorát adta — *„kifizette, de üres,
ezért a vendég ma nem látja”* —, egy KITÖLTÖTT listáról, és a „Kitöltöm” egy csupa-pipa lapra
vitt. Részleges átfedésnél a lista némán fogyatkozott, erről semmi nem szólt.

A szoba-szerkesztő eközben már a helyes modellt követte: a ház-szintű tételt a szobánál
„az egész szállásra” jelöléssel, nem kapcsolhatóan mutatja. A kiürülés csak akkor állt elő, ha
a tulaj előbb a szobáknál jelölt be valamit, és utána a ház-listába is felvette.

### A döntés (tulajdonosi, 2026-09-23)

**Két külön lista.** A Felszereltség a kezdőlapon azt mutatja, amit a tulaj ott kiválasztott —
se többet, se kevesebbet. A szobák a SAJÁT listájukat viszik a kártyájuk részleteiben. A
renderelő a kettőt nem veti össze. „Ház-szintű” = a tulaj választása, nem származtatott érték.

⛔ **Eljárási tanulság:** a munkaátadás azzal a feltevéssel jött, hogy „a kihúzás helyes, csak
szólni kell”. Ezt átvéve három tájékoztató-változat (§2b kör) készült arra, hogyan magyarázzuk
el a tulajnak a viselkedést — a tulaj kérdezett rá, hogy maga a szabály ellentétes azzal, ahogy
a két modult elképzeli. A változatok elvetve. **Előbb azt kell megkérdezni, hogy a viselkedés a
tulaj modelljét követi-e; csak utána azt, hogyan mondjuk el.**

### Őr

`scripts/amenities-house-list-check.mts` (pre-commit, `src/tenant/(editor|modules|units).ts`
változásakor): közös DB-n eldobható fixture, a `moduleContentFor().data`-n és az Áttekintés
saját predikátumán mér. Pozitív kontroll (nincs átfedés), részleges és teljes átfedés (a lista
teljes, nincs hamis sor, a szobák a saját 3-3 tételüket viszik), **negatív kontroll** (valóban
üres lista → a szakasz nincs, és a „kifizette, de üres” sor TOVÁBBRA IS megjelenik).
`--self-test` a régi szűrőt visszaalkalmazva pontosan 3 bukást követel.
