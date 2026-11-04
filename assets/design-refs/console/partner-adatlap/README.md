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

---

# Üzenetváltások — JÓVÁHAGYOTT terv: M1 csevegő-szál (2026-11-04)

**Döntés:** a tulaj 2026-11-04 (a koordinátoron át): Üzenetváltások fül = **M1**, nem az M2 (postafiók).

- `JOVAHAGYOTT-M1-uzenetvaltasok.html` — a kattintható terv (méret-váltó, működő írás-doboz,
  bemutató-kapcsolók), valós éles szállal (Duna Vibe House, 2026-11-03).
- `kepek/M1-{asztali,mobil}.png`, `kepek/M1-{asztali,mobil}-sms-iras.png` — amit a tulaj látott.

## Amit a terv KÖT

1. Fül az Áttekintés után; a neve mellett szám (a mi utolsó üzenetünk óta jött partner-üzenetek).
2. Egy szál, időrendben, napi elválasztóval: a miénk jobbra, a partneré balra, a rendszerlevél
   lenyitható kártya (tárgy → szöveg), melléklet-név. Buborék fölött: csatorna-ikon, forrás,
   címzett/feladó, idő, állapot-címke (elküldve / sorban / ütemezve / nem ment ki + „újra”).
3. Szűrők: Mind · E-mail · SMS / MMS · Kézi · Rendszerlevél.
4. Írás-doboz a szál alatt: E-mail / SMS váltó, címzett-lista (csak a partner és a kapcsolattartói
   címei), tárgy csak e-mailnél, SMS-számláló GSM-7 / UCS-2 + „Ékezet nélkül küldöm”, 5-rész-limit,
   aláírás-pipa, a mikor-megy sor (csendes óra 22–07), „Küldés…” → állapot, és az üzenet AZONNAL
   megjelenik a szálban.
5. Elutasító / leiratkozott partner: piros sáv az okkal, az írás-doboz letiltva.

## Ahol a kód TUDATOSAN eltér a képtől

- A mock „Bejövő: … ma senki nem gyűjti” sávja helyett a valós állapot áll: a partner és a
  kapcsolattartói címeiről jött levél / SMS is a szálba kerül (koordinátor-döntés 2026-11-03).
- A szűrők linkek (szerver oldali), nem JS-gombok — JS nélkül is működnek.
- A küldés-gomb a konzol elsődleges gombja (navy), mint a partner-szerkesztő „Mentés”-e; a mock a
  közös dizájn-mag cián változatát mutatta.
- A bejövő buborék fölött a partner (számlázási) neve áll; nem megkeresési bejövőnél elöl
  „Bejövő levél” / „Bejövő SMS”.
- A bemutató-kapcsolók (éjszaka / hiba / őr) a mock részei; a kódban ezek valós állapotok.

## Őr

- `scripts/partner-messages-check.mts` — a szál, az írás (kliens + szerver, JS nélkül is), a sor
  követése, a bejövő besorolás és az elutasító-őr, 390/1280 px.
