# „Honnan tudjuk?" forrás-panel — jóváhagyott terv (A változat, 2026-09-07)

Tulajdonosi jóváhagyás: 2026-09-07 („legyen az A"). Ez a terv a megvalósítás
KONTRAKTUSA — elvárt viselkedés, nem stílus-javaslat. Referencia: `forras-panel-a.html`
(ADR-0106 ⑥).

## Hol él

A konzol lead-oldalán, a „A mock szövege" panel MELLETT/UTÁN — a legutóbbi mock-artifact
forrás-térképe. Csak olyan artifacton jelenik meg, amely már hordozza a
`inputs.sourcePanel` adatot (régebbi artifactokon a panel el sem indul — nem hazudik
üres leltárt).

## Mit KÖT a terv

1. **Behúzási státusz — 4 forrás-kártya** (portál-adatlapok · vendég-vélemények ·
   tulaj-bemutatkozás · képek). Mindegyik VALÓS számokat mutat a generáláskor
   perzisztált leltárból; a hiányzó forrás (pl. nincs ownerIntro) szaggatott
   „nincs megadva" kártyát kap, magyarázattal — a hiány is információ.
2. **Szöveg-elem → tény → idézet lánc.** A mock szöveg-elemei (főcím, bemutatkozó,
   kiemelések) alatt tény-chipek; a chip forrás-színpöttyöt visel (portál = navy,
   vendég-vélemény = cián, csak-fotó = borostyán, forrástalan = piros). **Chipre
   kattintva a SZÓ SZERINTI, gépileg verifikált idézet nyílik** a forrás
   megnevezésével; újra-kattintás csukja; elemenként egyszerre egy idézet nyitva.
   A chip-hozzárendelés determinisztikus (ugyanaz az egyeztető, mint a
   marketing-őré — nem külön heurisztika).
3. **Figyelmeztetés-sáv.** „Forrás nélküli állítás: N" (0 = zöld, >0 = piros, a
   tételek felsorolva) + „N igazolt tény kimaradt a szövegből" a kimaradt tények
   listájával.
4. **„Csak a problémák" kapcsoló**: bekapcsolva a leltár és az egészséges elemek
   eltűnnek, a figyelmeztetések maradnak.
5. **Jelmagyarázat** a panel alján (forrás-színek).
6. **Reszponzív**: asztali = 4 oszlopos forrás-rács; mobil (≤700px konténer) =
   2 oszlopos rács, tördelt fejléc. `@container` alapú, nem viewport-media.

## Adat-kontraktus

A generálás (`generateEngine`) perzisztálja az `inputs.sourcePanel` objektumot:
beolvasott portálok (host, band, számok), vendég-vélemény darab/forrás, ownerIntro
megléte, kép-darabszám jogállás szerint, valamint a tények forrás-attribúciója
idézettel (`facts: [{label, source, quote?}]`). Idézet CSAK gépileg verifikált
(substring-match a forrás-korpuszban) lehet — §B.17.

## Nem köti

Pixel-pontos méretek, betű-fokozatok — a konzol meglévő `--citui-*` tokenjeit és
panel-mintáit követi.
