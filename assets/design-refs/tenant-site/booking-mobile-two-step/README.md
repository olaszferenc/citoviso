# Foglalás-widget telefonon — „B · Két lépés” (JÓVÁHAGYOTT kontraktus)

**Tulaj döntése:** 2026-09-26 — a három vázlatból (A üzenet a mezőnél · B két lépés · C ragadó sáv) a **B**-t választotta,
és a §2b „megállsz és vársz” lépést erre a körre feloldotta: a megvalósítás a saját ergonómiai belátás szerint
készül, a tulaj utólag a kész felületen ítél. Terv: `plan.html` (méret-váltó: „Mobil 390 px / Asztali”; a MOTOR
valódi runtime-ját futtatja, nem külön prototípust). Képek: `shots/`.

**Miért:** mérve 38 mockon (2026-09-26, guest-mobile-check): a hibaüzenet ~750 px-re a dátum-sávtól, az ár-összegzés
~700 px-re a küldő gombtól — telefonon a vendég sosem látta őket együtt.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Csak telefonon** (`≤ 559 px` szélesség): asztalon a jóváhagyott kéthasábos kártya (2026-08-23) VÁLTOZATLAN —
   a két-lépés elemei ott nem látszanak, a `.cit-book--step2` osztálynak nincs hatása.
2. **1. lépés** = naptár + dátum-sáv + **állapot-mondat a dátum-sáv ALATT** (`.cit-book__status`: a widget saját
   `say()` mondatának tükre — egy forrás, egy szabály; csak hiba esetén látszik) + ár-doboz + bizalmi lista +
   **egy „Tovább” gomb** (`.cit-book__go`, ≥ 44 px): felirata az állapotot mondja — „Válassza ki a napokat a
   naptárban” (nincs tartomány, tiltott) · „Javítsa a dátumot a folytatáshoz” (hiba, tiltott) ·
   „Tovább a kérés adataihoz (N éjszaka)” (érvényes, aktív). Az űrlap-mezők és a küldő gomb az 1. lépésben REJTVE.
3. **2. lépés** (`.cit-book--step2`): a naptár-oszlop rejtve; felül **összegző sáv** (`.cit-book__sum`: érkezés → távozás ·
   éjszakák · az ár-sor VAGY „Egyedi ár — a szállásadó árajánlattal válaszol” · „Módosítom a napokat” gomb, ≥ 44 px, ami
   visszavisz az 1. lépésbe a naptárhoz), alatta a mezők és a küldő gomb; az összegző és a küldő gomb egy képernyőn belül.
4. **A hibaüzenet egy képernyőn a dátum-sávval** (fordított, múltbeli, foglalt napok) — ezt az őr méri
   (`guest-mobile-check` ⑥hibaüzenet-távol / ⑥két-lépés), negatív kontrollal (`--selftest`: rejtett „Tovább” → piros).
5. Feliratok `tr()`-rel (i18n), színek csak `--cit-*` tokenből; a görgetés-tisztás a tapadó sáv alatt (`--cit-stick`).
6. A minta-nyugta és a küldés viselkedése változatlan (ADR-0061); a „Tovább” nem küld semmit.

Landolt: `src/engine`/`assets/runtime` (cit-runtime.js `syncSteps`, cit-modules.css „PHONE: TWO STEPS”), ADR-0235 kiegészítés.
