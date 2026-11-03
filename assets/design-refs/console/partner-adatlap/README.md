# Partner-adatlap — JÓVÁHAGYOTT terv: A — Fülek (2026-11-03)

**Döntés:** a tulaj 2026-11-03 ~13:00 (a koordinátoron át): „A fülek + üzenetváltások tab is kell,
ahol lehet írni is (sms + email)”. Az A változat lett, nem a B (hosszú lap) és nem a C (CRM-rekord).
Az „Üzenetváltások” fül KÜLÖN tervkörben megy (2. mock-kör), ez a terv azt még nem tartalmazza.

- `JOVAHAGYOTT-A-fulek.html` — a kattintható terv (méret-váltó, működő szerkesztő), valós éles
  adattal (Duna Vibe House, 2026-11-03).
- `kepek/A-{mobil,asztali}.png`, `kepek/A-{mobil,asztali}-szerkeszto.png` — amit a tulaj látott.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Fejléc + KPI** a lap tetején: számlázási név, cím, „partner … óta”, jelvények (vevő/szállító,
   előfizetés-, oldal-, domain-állapot), vevőnél 4 csempe: havi díj, következő terhelés (+ kártya),
   kintlévőség, aktív modul.
2. **Fülek:** Áttekintés · Adatok és kapcsolattartók · Előfizetés (csak vevőnél) · Domain ·
   Számlák (szállítónál: Bizonylatok) · Aktivitás · Előzmények.
3. **Az Áttekintés a „Figyelendő” listával indul** (csak ami figyelmet kér), alatta kártyák:
   Előfizetés, Domain, Kapcsolatok, Számlázási adatok.
4. **Szerkesztés helyben**, az „Adatok és kapcsolattartók” fülön: számlázási adatok +
   kapcsolattartók egy űrlapon; ellenőrzés gépelés közben (HU adószám ellenőrzőszám, telefon
   E.164-re, e-mail-alak, szerepenként egy elsődleges, kötelező elsődleges számlázási e-mail);
   „Nem mentett változás” jelzés; „Mentés…” → „Mentve hh:mm”; elvetésnél rákérdez.
5. **Forrás-szabály kiírva** a szerkesztőben („Mire hat a mentés?”), és a céges e-mail cseréjénél
   rákérdez, hogy a számla-címzett is változzon-e.
6. **„Átveszem a partnerre”** a hiányzó telefonnál: a lead számát a szerkesztőbe tölti, mentés
   nélkül semmit nem ír.
7. A Számlák a SUB-A rendszer-számláit mutatja (nincs második lekérdezés), az Aktivitás a SUB-D
   render-függvényének helye (`src/console/partnerActivity.ts`), a domain-adat a SUB-E
   domain-nyilvántartásáé (átmenetileg `partnerDomains()`, csere a `getDomainsForTenant`-re).

## Ahol a kód TUDATOSAN eltér a képtől

- **A következő terhelés ÖSSZEGE:** a mock „4 957 Ft automatikusan”-t írt. Ez hamis volt: a
  megkeresési kedvezmény csak az első fizetésre szól, a Duna 12-03-i terhelése 6 610 Ft. A kód
  a tulaj saját adminjának számát mutatja (`getSubscriptionAdmin().nextChargeTotal`), a fejléc
  „havi díj (listaár)” csempéje a listaárat.
- **Teljes dátum** a következő terhelésnél (éves ciklusnál a „09. 21.” félrevezető volt).
- A fülek linkek (szerver oldali váltás), nem JS-fülek — a szerkesztő nem vész el egy véletlen
  fülkattintással, mert elhagyáskor a böngésző rákérdez a nem mentett változásra.
- A „Belépés” sor „utolsó jelszavas belépés”-t ír: az egyszeri linkes belépés ma nem bélyegzi a
  `tenant_user.last_login_at`-et (SUB-D lelete), ezért ez a mező nem „utolsó belépés”.

## Őrök

- `scripts/partner-edit-check.mts` — a szerkesztő végponttól végpontig (kliens + szerver, 390/1280).
- `scripts/partner-ui-check.mts` — fül-kattintás, tap-méret, szerep-fülek.
