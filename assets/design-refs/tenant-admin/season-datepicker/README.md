# Időszaki árak — dátumválasztó, névlista, év-naptár — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-27, két §2b kör után. A tulaj a Camping Carina árak-képernyőjén: „nagy
segítség lenne a dátumválasztó, ráadásul a javasolt segítőszöveg sem egyértelmű”, és „a szezon
megnevezések szabad szavasak… legalább azt ajánlja fel, amit eddig rögzített, mert így simán lehet
Főszezon / főszezon / Föszezon”. 1. kör: A (naptár) / B (hónap + nap lista) / C (naptár + évsáv) →
„A + évsáv” (= C), két kérdéssel: mi van, ha a következő évre akar módosítani (→ az évsáv
kártyája, ADR-0221, csak nem látszott), és hozza fel a meglévő neveket. 2. kör: lenyíló névlista +
év-naptár évszámmal és a hét napjaival → „igen, jó!”, egy kéréssel: a naptár **a dátumgomb
FÖLÖTT** nyíljon, ne az űrlap alján → javítva, „nagyon jó így”. ·
**Kapcsolódó:** ADR-0221 (évsáv, évre szóló ár és napok), ADR-0049 (időszakonkénti minimum),
ADR-0036 (i18n), §B.17. · **Épít rá:** `season-year-price/` (az évsáv kártyái változatlanok).

**Hatókör:** `src/server/moduleConfigViews.ts` · `assets/runtime/cit-season-editor.js` ·
`src/tenant/prices.ts` (azonos név ugyanannál a szobánál)

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez mérjük
(mobil 390 + asztali). A mock a VALÓDI szezon-szabályt futtatja (`cit-season.cjs` beégetve).

## Amit a terv KÖT

**Kötő feliratok** (a kódban szó szerint élniük kell): **„Mettől meddig”** · **„Kezdete”** · **„Vége”** ·
**„Ár / éjszaka”** · **„Legalább”** · **„Az év, egy pillantásra”** · **„Eddig használt nevek”** ·
**„Ennél a szobánál már van”** · **„Napok mentése”** · **„Ez csak erre az évre szól, a többi év nem változik.”**

1. **Gépelés helyett naptár — ismétlődő időszaknál év és hét napjai NÉLKÜL.** A „Mettől meddig” két
   gombja (kezdete, vége) naptárat nyit; előbb a kezdő, aztán a záró napra kattint. Az időszak minden
   évben ismétlődik, ezért nincs évszám és nincs H–V fejléc (egy nap-név évről évre változna). Az év
   végén átnyúló időszak a záró nap korábbi hónapjával adható meg (nov. 1. – márc. 1.). A naptárban a
   **többi időszak napjai sárga aláhúzást** kapnak (átfedés ránézésre). Asztalon két hónap, mobilon egy.
2. **A naptár a dátumgomb FÖLÖTT nyílik** (tulaj, 2026-09-27) asztalon; csak ha fölötte nincs elég
   látható hely (a ragadós fejlécet levonva), akkor alatta. Mobilon a dátummezők ALATT, a folyamban.
   ⛔ Nem az űrlap aljához kötve (az volt a hiba az 1. körben).
3. **Feliratok a mezők fölött:** Időszak neve · Mettől meddig · Ár / éjszaka · Legalább … éj (csak
   foglalás-modullal). A rejtélyes „éj min.” megszűnt.
4. **A régi „hónap-nap alakban kérjük (11-01)…” mondat helyett élő mondat** mondja meg, mit jelent a
   választás: „Minden évben **november 1. – a következő év március 1.** [átnyúlik az év végén] ·
   Legközelebb: 2026. 11. 01. – 2027. 03. 01.”, alatta az átfedés-figyelmeztetés a győztes nevével.
   Állandó sor csak a „Legalább” mezőről: nem kötelező, üresen a foglalás-modul minimuma érvényes.
5. **Évsáv az új időszak alatt** („Az év, egy pillantásra”): 12 hónap, kékkel az új időszak (átnyúlónál
   két darab), sárgával a szoba meglévő időszakai, jelmagyarázattal; egy hónapra kattintva a naptár oda
   ugrik.
6. **Lenyíló névlista** a névmezőn (fókuszra nyílik, gépelésre szűkül, ékezet- és kisbetű-független,
   a talált rész kiemelve, billentyűvel is): „Eddig használt nevek” = a szállás MÁS szobáinál rögzített
   ismétlődő időszakok (napokkal + melyik szobánál); „Ennél a szobánál már van” = nem választható.
   **Egy név kiválasztása a napjait is kitölti** (tulaj: igen), alatta: „A napokat átvettük (kuckó3):
   … Ha ennél a szobánál más, kattintson a dátumra.”
7. **Majdnem-egyező név jelzése:** „Föszezon” → „Ez a név már szerepel **Főszezon** alakban.
   Egységesen írjuk?” + egy gomb; ugyanennél a szobánál meglévő névre: „Ennél a szobánál már van …
   — a fenti listán szerkesztheti.” + „Ugrás oda”. **A szerver is elutasítja** az azonos (ékezet- és
   kisbetű-független) nevet ugyanannál a szobánál, hozzáadáskor és átnevezéskor.
8. **Szerkesztés** („Szerkesztés” gomb) ugyanazt a naptárat kapja, feliratos mezőkkel; a saját időszak
   napjai itt nem számítanak „másiknak”.
9. **Év szerkesztése — valódi naptár.** Az évsáv kártyáján a „Más napokon ebben az évben” a sáv alatt
   naptár-panelt nyit: **évszámmal, H–V fejléccel, a hétvége kiemelve**; alul az összegzés („2027.
   június 12., szombat – 2027. augusztus 28., szombat · 78 nap”), az ismétlődő napok emlékeztetője és
   „Ez csak erre az évre szól, a többi év nem változik.” A kezdő nap abba az évbe esik, a záró nap
   legfeljebb egy évvel később (átnyúlás). A panel a kártya meglévő napjain nyílik (tulaj: igen).
   „Napok mentése” = a kártya űrlapja a napokkal (az üres ár = az ismétlődő ár, ADR-0221).
10. **Szkript nélkül is működik:** a szerver a régi szöveges hónap-nap mezőket adja (a hónap-nap
    útmutatóval); a szkript cseréli naptárra. A szerver-oldali normalizálás változatlan.

## Amit NEM köt

A pontos pixelméretek, árnyékok; a mock saját „Mit dönt el ez a kör?” fejléce. Színek csak
`--citui-*` tokenből (sötét módban is).

## Képek

`r2-names-*` névlista · `r2-new-desk` névből átvett napok + évsáv · `r2-yearpick-*` év-naptár ·
`r2-cal-phone` mobil naptár a mezők alatt · `r3-above-desk` / `r3-edit-desk` a gomb fölött nyíló naptár.
