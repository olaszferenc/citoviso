# „Árak és rendelés” + „havi X Ft-tól” — a lead-lap rendelő gombjának felirata (JÓVÁHAGYOTT TERV, 2026-10-27)

A tulaj felvetése (2026-10-27): több lead-visszajelzés is azt kérdezi, mi mennyibe kerül. Tetszik nekik a
honlap, de nem mernek a „Megrendelés”-jellegű gombra kattintani. Javaslata: „Árak és megrendelés”.
§2b terv-kör a valódi Laguna Panzió dev-mockon (a feliratot a lap betöltésekor cseréltük, a tördelést a
valódi CSS és a valódi szélesség-elosztó adta): A „Árak és rendelés” · B ugyanez + alatta „havi X Ft-tól” ·
C „Mennyibe kerül?”. **A tulaj a B-t választotta.** Döntés: ADR-0408.

Kattintható terv: `plan.html` (felirat- és méretváltó; a gombra a valódi rendelő-panel képe nyílik; a
szélesség-mérés élőben mutatja, mi vágódik le). Képek: `valtozatok-mobil.jpg` (balról Ma · A · B · C ·
a szó szerinti javaslat) · `valtozatok-asztali.jpg` · a megvalósítás a valódi lapon:
`megvalositas-390-fekvo-asztali.jpg`, `megvalositas-domain-jelvennyel.jpg`.

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`
(a `.cit-cfg-launch` pirula).
Felülírja az `../order-pill/` README 1. pontját (felirat); minden más pontja (szín, hely, kikerülés,
mindig kint) változatlanul köt.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Felirat:** első sor **„Árak és rendelés”**, alatta kisebben (11,5 px, 600) **„havi {price}-tól”** —
   mindkettő `tr()`-rel. Aria: „Árak és rendelés — havi {price}-tól”.
2. **A szám a legolcsóbb csomag HAVI LISTAÁRA**, a lap betöltésekor a rendelő-panel saját képletéből
   (`presetMonthly`, ugyanaz, amit a csomag-kártya havi fizetésnél mutat), a panel pénz-formázójával.
   ⛔ Soha nem beírt szám, és soha nem az egyszeri ajánlat-ár (az az első díj, nem az, amibe kerül).
   Nincs csomag vagy nincs ár → nincs második sor, a felirat egyedül áll.
3. **Egy pirula, két sor, ugyanaz a magasság:** a próba-pirula mellett 48 px (fekvő telefonon 44 px),
   asztalon is (a függőleges belső margó adja a második sor helyét). Mérve 360 · 390 · 844×390 · 1280 px-en:
   semmi nem vágódik le, a „14 nap ingyen” sem.
4. **A szó szerinti „Árak és megrendelés” nem használható:** telefonon levágódik, és a próba-pirulát is
   levágja („14 nap ing…”); asztalon a hosszabb pár a bal szélre ugrik. Ezért „rendelés”.
5. A „+ saját .hu cím” jelvény (package-domain-badge) a kétsoros pirulán is a helyén ül.
6. A próba-űrlap belső linkje („Inkább most rendelné meg? … Itt rendelheti meg”) mondatba illő szöveg,
   nem változik.

## Mérés

A változás előtti alap: 55 megnyitóból 55 nem nyitotta meg a rendelő-panelt
(`_planning/RESEARCH-2026-10-valos-oldal-eroforrasigeny.md` §4). A hatást a Riport „Rendelés-panel” füle
mutatja (`panel_open {via:"pill"}`), az élesítés dátuma előtti és utáni megnyitókat összevetve.
