## ADR-XXXX — Több terv egy követett linken: a lead a saját linkjén vált 2–3 jóváhagyott terv között

**Dátum:** 2026-09-23 · **Kiváltó:** tulajdonosi kérdés: „mekkora meló, hogy ha több generált mockot hagy jóvá
a kurátor, akkor a tenant a linkjét megnyitva tudjon tabon váltva a mockokat változtatni? … Az összeállítás
folyamatát nem változtatná.” Kontraktus: `assets/design-refs/prospect-page/plan-tabs/` (négy §2b-kör, az **A**
változat, a tulaj szabályaival: „a felső sáv ne legyen túl vastag … elveszi a WOW hatást”, és „nem elég
látványos, hogy több opció van”).

**⛔ KIADÁS:** a `feat/multimocktabs` ágon él, és **a pilot elindulása UTÁN** kerül a main-re (tulajdonosi döntés,
2026-09-23). Oka: a main-ről megy az élesítés, és az ág — bár alvó (kurátori felület nélkül minden link egy-tervű,
a levél bájtra a mai) — a pilot kritikus küldési útját (a claimeket) is módosítja. Az ágra `land.sh` nem fut.

**① Adatmodell — az invariáns érintetlen:** az 1. terv marad a `prospect.mock_artifact_id` (a jóváhagyott mock,
a levél és az MMS képe); a 2. és 3. terv egy új táblában él (`prospect_variant`, migráció 0071). Az „egy leaden
egy jóváhagyott mock” szabály (0064, `curateArtifact`) NEM lazul — az elvetett „N egyenrangú approved” út épp azt
a mért hibát hozta volna vissza, amire a szabály született (Elek FK-003b ⑤). Egy alternatíva megrendelésekor a
vevő rendelése maga a jóváhagyás (`approveArtifactForBuyerOrder`, 2026-09-13), így a fizetési kapu nem tagad meg.

**② A lead lapja:** `/p/<token>/v/<n>`, teljes oldalbetöltéssel (a sablonok CSS-e egymásra rakva szétesne).
Vékony keretező sáv a képes tervváltóval (mobil 116 px, asztal 44 px egy sorban), lap alji „Tetszett? Nézze meg
a másik kettőt is.” blokk a jogi lábléc FÖLÖTT, véges felvillanás (max. 3×/látogatás — a rendelés-gomb már
végtelenül pulzál). Nem ragad (sticky): mérve a képernyő ~negyedét vinné el. Egy-tervű lap: változatlan.

**③ A tervváltás folytatja a látogatást** (`?s=<viewId>`): különben három kattintás három látogatás, és az
ADR-0088 §4 „3. látogatás” kedvezménye másodpercek alatt kijönne.

**④ A megkeresés szövege a tervek számából:** tárgy „{név} – N honlap-terv” (mérve 598 néven: 82% fér ki a
~38 karakteres előnézetben), többes szám, képaláírás („A képen az első terv látható …”), rövid SMS-formák
(a hosszú páros forma 598 névből 50-et vitt 5 részre, a rövid 16-ot). Egy tervnél a levél és az SMS bájtra a mai.

**⑤ A levél szavai igazak maradnak** (jog/provenance-őr, három kör, hat §I/§B.17 lelet — mind zárva): a
tervkészlet BÁRMELY csatorna claimjénél zárol; a claim tranzakciójában újraszámoljuk a tervszámot; megajánlás
után a terv áll (elutasítás, törlés, nyitókép-csere, szöveg-újraírás sem veheti el/írhatja át); a csatolás
eltérő sablont és azonos fotókészletet követel („háromféle kinézettel”, „ugyanazokból a képekből”).

**Őrök:** `scripts/plan-switcher-check.mts` (a renderelt lap, 234 állítás, hat piros önteszt) ·
`scripts/plan-variants-check.mts` (a valódi dev DB, eldobható sorok, piros próbákkal) ·
`scripts/outreach-gate-selftest.mts` (2/3 terv §C-kapu + 1 terv = a mai, betűre).

**Visszafordíthatóság:** 🔄 — additív (új tábla, új útvonal, alvó kód); a main-en a merge után is egy
csatolatlan link a mai viselkedést adja.

**Elvetett:** több egyenrangú `approved` mock (az invariáns bontása); kliens-oldali fülcsere egy lapon (CSS-ütközés,
3×150 kB); B (külön csík) és C (választó-kártyák) — több helyet visznek el; ragadós sáv és végtelen felvillanás
(tulajdonosi kérdésre mérve és elvetve).

**Nyitva:** a kurátori felület (alternatívák csatolása a konzolon — §2b terv kell); a rendelés-gomb
ütközés-kerülése a lap alji kártyákkal (kontraktus §F.20); súgó-cikk; a `deleteArtifact` ellenőrzés→törlés közti
szűk verseny (a jog-őr szerint nem sértés, maradék).

**Státusz:** ELFOGADVA (terv + szöveg) · megvalósítás folyamatban a `feat/multimocktabs` ágon.
