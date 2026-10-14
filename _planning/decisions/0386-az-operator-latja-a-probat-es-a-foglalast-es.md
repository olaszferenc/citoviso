## ADR-0386 — Az operátor látja a próbát és a foglalást, és értesítést kap az új próbáról

**Dátum:** 2026-10-14 · **Kontextus:** Elek éles teszt (2026-10-13), O-2 lelet (`_planning/memory/2026-10-13_elek_eles_teszt_harom_szerep.md`). A §2b terv-kör után a tulaj 2026-10-14-én a deploy-koordinátoron át jóváhagyta („mehet”). Terv: `assets/design-refs/console/proba-foglalas-lathato/`. **Kiterjeszti:** ADR-0342…0359 (próba), ADR-0374/0376/0379 (riasztó levél + SMS, csendes óra), ADR-0384 (próbázónak nincs hideg megkeresés).

### Kiváltó
- Próbázó lead lapján és sorában csak „jóváhagyva” állt.
- Az Irányítópult a próbáról nem szólt, a Riport „Tenantok” füle „készül”, csak a `/pricing` írta ki: „Most 1 próba fut”.
- Az élő oldalra érkezett foglalás a konzolban sehol nem látszott.
- A próba indulása csak egy `trial_start` esemény volt a látogatáson, az operátor nem kapott róla értesítést.

### Döntés
1. **Egy szabály az ügyfél-állapotra** (`clientKind`, `src/console/leadClient.ts`). Sorrend:
   - futó próba (`free_trial.status='active'`);
   - különben élő előfizetés (`subscription.status` `active`/`past_due`): előfizető;
   - különben lejárt vagy törölt próba: próba lejárt.

   A lista jelvénye, a szűrő-sor és a lead-lap kártyája ugyanazt a függvényt olvassa (`loadLeadClients`).
2. **Lista (C + B).**
   - A név alatt jelvény: próbázik · még N nap / előfizető / próba lejárt, és N foglalás. Ha a tulaj még nem döntött egy kérésről, sárgán: „N foglalás válaszra vár”.
   - A cím alatt szűrő-sor (Mind · Próbázik · Foglalás érkezett · Előfizető · Próba lejárt), a darabszámmal az egész aktív listán.
   - A `?client=` nézet nem hordozza tovább az oszlop-szűrőket, és kikapcsolja az alapszűrést (`anyLeadFilter`). Különben a saját honlapos próbázó kiesne, és a gombon álló szám hazudna.
3. **Lead-lap (B): ügyfél-kártya a munkamenet-sáv alatt.**
   - Napok hátra (csíkkal), Élő oldal gomb, indulás és lejárat, folytatási kedvezmény, kapcsolattartó a próba-űrlapról, honnan indította.
   - A foglalások táblázata (≤ 10, a legújabbal kezdve).
   - Ha egy kérés ≥ 24 órája `pending`, sárga sor mondja ki a webhely lejárati szabályát (`autoDeclineHours`), és ezzel zárul: „Érdemes felhívni.”
   - A sáv Rendelés-állomása próbánál „próba fut — lent”, „ez a következő” jelölés nélkül.
4. **Értesítés (E2), a meglévő ház-riasztás csatornáján** (`alertHouse`).
   - **Új próbánál** levél megy, és SMS saját, ékezet nélküli szöveggel (`HouseAlert.smsText`, új mező; az éjszakai összesítő továbbra is a tárgyat listázza). A csendes óra, az éles-host-szabály és a zajszűrő változatlan.
   - Egyszer megy (`house_alert_once` `trial-start:<id>`): azonnal a `startTrial` után, és az óránkénti tick (`runClientNotices`) pótolja, ha elveszett. A tick 24 órára tekint vissza, így a deploy utáni első futás nem jelez régi próbákat.
   - **Válasz nélküli foglalásnál** (≥ 24 órája `pending`, ≤ 7 napos) csak levél megy, kérésenként egyszer (`booking-silent:<id>`). Kimarad, ha a webhely lejárati ablaka ≤ 24 óra.
5. Migráció nincs: a meglévő `house_alert_once`, `free_trial`, `booking_request` és `subscription` táblák elegendők.

### Őr
`scripts/client-visibility-check.mts` (saját scratch-DB) ellenőrzi:
- a szabályt, a valódi olvasást, a lista jelvényét és szűrő-sorát;
- a kártya kötő szövegeit;
- az értesítéseket: egyszer megy, felszabadít és újrapróbál, a régi próbát nem jelzi, az SMS GSM-7 és egy szelet.

A pre-commit a `leadClient`, `clientNotify`, `houseAlert` és `offer-followup` változásakor futtatja.

### Visszafordíthatóság
🔄 könnyű: nézet, olvasó lekérdezés, értesítés, séma nem változott. Élesre a következő deployjal; az SMS-hez élesen kell a riasztási telefonszám a `/settings`-ben (ADR-0374).
