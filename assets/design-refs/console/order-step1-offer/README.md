# Kontraktus: az 1. lépés összesítője ugyanazt a megtakarítást mondja, mint a 2. lépés (L3-2)

**Jóváhagyva:** tulaj, 2026-10-03, **B változat** („áthúzott listaár, mint a 2. lépésen”), koordinátoron át.
**Hatókör:** `assets/runtime/cit-configurator.js`

A `syncMini` (`cit-cfg-mini__amt`, `cit-cfg-mini__offer`).
**Módosítja:** `console/order-two-step` ① („Ajánlatnál alatta áll: −{p}% az első díjból · érvényes {d}-ig”). A többi pontja érvényes.
**Forrás:** Elek 3. kör, L3-2: az 1. lépés alján zöld „−2 325 Ft/hó” állt (a VÁLTOZÁS-jelző, 6 975 → 4 650 Ft), a 2. lépésen
„−4 650 Ft” (a listaárhoz mérve) — ugyanaz az ajánlat két különböző megtakarítással.

## Amit a terv KÖT (elvárt viselkedés)

1. Ajánlatnál a futó összeg előtt **áthúzva a listaár** (ugyanaz, amit a 2. lépés kártyája áthúz), utána a terhelt összeg
   (változatlanul `currentCharge()`).
2. Alatta: `<ajánlat neve> (−<p>%) −<listaár − terhelt összeg> az első díjból`, döntés-segítő ajánlatnál
   „· érvényes <d>-ig” utótaggal — ugyanaz a név és ugyanaz a forintösszeg, mint a 2. lépésen.
3. Ajánlatnál **nincs változás-jelző csip** az összeg mellett (a „−… Ft/hó” megtakarításnak olvasható). Ajánlat nélkül a
   csip változatlanul jelzi a változást.
