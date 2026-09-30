# Lead-ajánlatok: a döntés-segítő (eszkalációs) ajánlat küszöbe és kedvezménye a /pricing-on. Jóváhagyott terv

**Jóváhagyva:** 2026-09-30, tulajdonosi döntés a koordináló sessionön át: az „A” változat (saját szekció az
alapdíj alatt). A nem választott „B” a modul-sorok után, kompakt sorokban ült, és csak a Magyarország oldalon volt
szerkeszthető. Kiváltó kérés: a tulaj a megnyitások darabszámát és a kedvezmény mértékét az árazási felületen akarja
állítani, mert eddig be volt égetve (`offers.ts`, 3 / 50). Kapcsolódó: ADR-0088 §4 (az eszkalációs mechanizmus),
`offer-ui/` (a lead oldali döntés-kártya, változatlan), `pricing-sales/` (a /pricing kötött elemei, változatlanok).

- Terv: `plan.html` (önhordó, kattintható: kapcsoló, élő validáció, előnézet, régió-váltó, mentés; „Mobil 390px / Asztali” váltó)
- Képek: `plan-desktop.png`, `plan-mobile.png`

**Hatókör:** `src/console/views.ts` · `src/payment/offers.ts` · `src/console/server.ts`

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Hely:** saját **„Lead-ajánlatok”** szekció közvetlenül az Alap-előfizetés alatt, az alapdíjjal azonos
   mező-formában (felirat fölül, szám + egység egy keretben, 3 oszlop asztalon, 1 oszlop telefonon).
2. **Globális:** a szekció MINDEN régió-oldalon ott van és szerkeszthető, a **„minden piacra érvényes”** jelzéssel;
   bármelyik régió mentése menti. Tárolás: egyetlen `app_setting` sor (`escalation_offer`, JSON), migráció nincs.
   Amíg nincs ilyen sor, az `offers.ts` konstansai (3 / 50) adják az értéket.
3. **Kapcsoló** a **„Döntés-segítő (eszkalációs) ajánlat”** előtt. Kikapcsolva nem keletkezik ÚJ ajánlat, a mezők
   halványak és tiltottak, a számok megmaradnak (visszakapcsoláskor nem kell újra beírni). A már futó ajánlatok a
   lejáratukig élnek.
4. **Két mező:** **„Hányadik megnyitásnál kapja”** (egész, 2–10, egység: „. megnyitás”) és **„Kedvezmény az első díjból”**
   (egész, a bemutatkozó kedvezmény +1 és 90 % között). A harmadik cella a bemutatkozó −25 %-ot mutatja
   összevetésül, csak olvashatóan. A 25 % nem ezen a kártyán állítható.
5. **Élő validáció:** a hibás mező pirosan keretezett, alatta a konkrét ok (pl. a 25 % miért kevés: a kedvezmények
   nem adódnak össze, a legnagyobb él). Hiba esetén a mentés-gomb tiltott, mellette összesítő. A szerver ugyanazzal
   a szabállyal (`escalationConfigErrors`) újra ellenőriz, és hibás értéknél SEMMIT nem ment.
6. **Előnézet:** egy mondat arról, mit fog tenni a beállítás: a lead az N. megnyitáskor −P %-ot kap az első díjból,
   72 órára. A Magyarország oldalon ehhez egy valós példa is tartozik (a középső díjcsomag listaára → a kedvezményes ár,
   `floor`, ugyanaz a matek, mint a szerveren). Kikapcsolva az előnézet ezt mondja ki.
7. **A már kiadott ajánlatok megtartják a %-ukat.** Ha az érték változott, és van élő eszkalációs ajánlat, a
   felület kimondja, hány darab fut és mekkora kedvezménnyel, és hogy a változás csak az ezután kiadottakra hat.

Megvalósítás: `src/payment/offers.ts` (`getEscalationConfig` / `setEscalationConfig` / `escalationConfigErrors` /
`escalationFromForm`, az `ensureEscalationOffer` innen olvas), `src/console/views.ts` (`escalationSection`),
`src/console/server.ts` (GET / POST /pricing), `public/assets/ui/citui-console.css` (`.pr-esc*`, `.pr-ferr`).
Őr: `scripts/escalation-config-check.mts`.
