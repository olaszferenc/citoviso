## ADR-0408 — „Árak és rendelés” + „havi X Ft-tól”: a lead-lap rendelő gombja az árat is megmondja

**Dátum:** 2026-10-27 · **Státusz:** elfogadva (lokál, nem élesítve) · Felülírja: ADR-0242 1. pont (felirat)

### Kontextus

A tulaj (2026-10-27): több lead-visszajelzés kérdez rá az árakra. A honlap tetszik nekik, de a rendelő
gombra nem kattintanak. Mért alap: 55 megnyitóból 55 nem nyitotta meg a rendelő-panelt, pedig az árak a
panel első képernyőjén állnak. A „Itt rendelheti meg” felirat vállalást sugall, az árról nem szól.

A tulaj javaslata „Árak és megrendelés” volt. A §2b terv-körben a valódi Laguna-mockon mérve ez
telefonon levágódik, és a mellette álló „14 nap ingyen” pirulát is levágja; asztalon a hosszabb pár a
kikerülési szabály miatt a bal szélre ugrik. Változatok: A „Árak és rendelés” · B ugyanez + „havi X Ft-tól”
· C „Mennyibe kerül?”. **A tulaj a B-t választotta.** Kontraktus: `assets/design-refs/prospect-page/arak-gomb/`.

### Döntés

1. A rendelő pirula felirata **„Árak és rendelés”**, alatta kisebben **„havi {price}-tól”** (`tr()`).
2. A szám a **legolcsóbb csomag havi listaára**, a panel saját képletéből (`presetMonthly`) a lap
   betöltésekor számolva — nem beírt szám, nem az egyszeri ajánlat-ár. Ha nincs ár, nincs második sor.
3. A pirula magassága nem nő: a próba-pirulával egy magasságban marad (48 px, fekvő telefonon 44 px).
4. A konzol Riport és a súgó a gombot az új nevén említi.

### Következmények

- A pirula szövege régiónként a régió árlistájából jön (`PRICING.base` + csomag-modulok), a pénz-formázó
  a régió pénznemét írja.
- Egy árlista-változás azonnal a gombon is látszik, külön teendő nélkül.
- A hatás a Riport „Rendelés-panel” fülén mérhető: `panel_open {via:"pill"}` az élesítés előtt és után.
- Az ADR-0242 korábbi képei a régi feliratot mutatják; az történeti kontraktus, nem íródik át.
