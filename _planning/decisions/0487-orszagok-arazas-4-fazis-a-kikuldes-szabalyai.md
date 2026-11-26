## ADR-0487 — „Országok / Árazás” 4. fázis: a kiküldés szabályai országonként, az ország során; az auto-approve a repóba költözik

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva. A tulaj a megvalósítási tervet a koordinátoron (`cit9b4690e3`) át hagyta jóvá; a jóváhagyásról 2026-11-26-án döntött, ez a „B”.
- **Kontraktus:** `assets/design-refs/console/orszagok-arazas/` README ⑪ + D 12–14 (a ⑪4 alapértéke ebben a fázisban „Tulaj-jóváhagyás”-ra javítva)
- **Épít:** ADR-0484 (1. fázis), ADR-0409 (sorrend), ADR-0479 (településkép-tár), ADR-0461 (ország-ablak)
- **Érinti:**
  - `migrations/0155_country_dispatch.sql`, `src/country.ts` (`CountryDispatch`), `src/countryDispatch.ts` (új);
  - `src/outreach/` alatt: `autoApprove.ts` (új), `mockPhotoGate.ts`, `autoDispatch.ts`, `countryOutreach.ts`, `nonOpenerFollowup.ts`, `escalationFollowup.ts`, `mockRenderGate.ts`, `sendBatch.ts`, `secondPlan.ts`;
  - továbbá `src/crm/countryClock.ts`, `src/generator/generateEngine.ts`, `src/generator/mockRefresh.ts`, `src/media/townPhotoSet.ts`, `src/console/countryHub.ts`, `src/console/countryData.ts`, `src/console/approvalQueue.ts`, `src/console/server.ts`, `src/db/leadCountrySql.ts` (új).

### Mi volt a baj
A kiküldés szabályai szét voltak szórva, mindegyik egyformán érvényes volt minden országra:
- kódba égetett értékek: legalább 5 saját kép, fix kiküldési sorrend, 8–17 óra, 14 napos nem-nyitó késleltetés;
- globális kulcsok: `town_photo_dispatch`, `nonopener_followup_daily_cap`, `escalation_followup`, `outreach_auto.dailyCap` és `countryCaps`;
- egy repón kívüli éles szkript: `/opt/citoviso/auto-approve.mts`. A Debian crontab egyik sora futtatta, és a fejlesztőgép kontakt-láncának fájljaiból (`checked-ids.txt`) döntött.

### Döntés
1. **Minden szabály az ország során él.** A 0155-ös migráció 14 új oszlopot vesz fel a `country`-ra, a `lead`-re pedig a `contact_checked_at`-et. A visszatöltés a MAI működést írja az oszlopokba:
   - az ablak a sor és a 8–17 metszete, így a HU 8–20 → 8–17;
   - a HU napi keret 100, a HR 20;
   - a településképes mód az éles kapcsolóból jön;
   - a nem-nyitó és az eszkalációs levél a globális kulcsokból.

   Ettől semmi nem mozdul.
2. **Az olvasók a sorra álltak:**
   - a fotó-kapu SQL-je: a lead országának minimuma és módja;
   - a kiküldési sorrend és a kör-kizárás (`dispatch_sites`);
   - az ablak: a sor az egyetlen ablak (D13), hétnap-maszkkal és ünnepnap-kapcsolóval;
   - a napi keret: a sor `daily_quota`-ja, a felfutás a hazai keretet felfelé emeli;
   - a nem-nyitó levél országonként (D14), és az eszkalációs levél is;
   - a render-kapu MINTA-szabálya;
   - a generátor kevés képes ága, a településkép-tár és az újragenerálás.

   A kiváltott konstansokat és kulcsokat a kód sehol nem olvassa. Ezt a `dispatch-settings-check` őrzi.
3. **Az auto-approve a repóban van:** `src/outreach/autoApprove.ts`, a régi szkript öt ága, mindegyik a sor pipája mögött.
   - A kiküldő ütemében fut, legfeljebb 20 percenként, és csak az `outreach_auto.autoApprove` kapcsoló mellett. Ez alapból KI.
   - Csak a `dispatch_approval = 'auto'` országot dönti el.
   - Az „ellenőrizve” jel a `lead.contact_checked_at`, a kontakt-lánc a konzolon át írja: `POST /contact-checked`, `scripts/contact-checked-push.mts`. Visszatöltés: `scripts/contact-checked-import.mts`.
4. **Jóváhagyás = „B”** (tulaj, 2026-11-26): most minden országban a tulaj hagy jóvá, de ez országonként beállítható. A visszatöltés mindenhol `owner`, a fülön egy kattintással Automatára állítható. A reggeli „HR is Automata” ezzel felülírva.
5. **A Kiküldés fül szerkeszthető:**
   - `POST /countries/dispatch/check` élő számot és módosítás-listát ad, ugyanazokból az SQL-darabokból, mint a kiküldő;
   - `POST /countries/dispatch` ment, ugyanazzal a validálással;
   - mentés előtt összesítő mutatja, mennyi a megfelelő lead most és holnaptól, naponta mennyi megy, mikor az első küldési nap, és mi változik (*Most → Új*).
6. **Kivételek:**
   - mobil kiküldést nem építettünk (tulaj 11-20: csak e-mail);
   - az e-mail csatorna és az „e-mail cím nélkül nem küldünk” szabály nem kapcsolható ki;
   - a nem-nyitó levél egyetlen levél marad.

### Átállás élesen (a koordinátor viszi, külön tulaj-engedéllyel; ⛔ a régi cron-sor és az új tick soha nem fut egyszerre)
1. Deploy (a migráció lefut, az `autoApprove` KI).
2. `npx tsx scripts/contact-checked-import.mts /opt/citoviso/checked-ids.txt --go`
3. `npx tsx scripts/dispatch-equivalence.mts`: zöldnek kell lennie.
4. A Debian crontab 21. sorát a `scripts/contact-checked-push.mts --go` futtatására cseréli (a checked-ids feltöltés megszűnik).
5. Az `outreach-dispatch.mts auto-approve on` csak akkor kell, ha egy ország Automatára kerül. Ma mindenhol `owner`, így ez a lépés várhat.
6. Élesítés után, külön engedéllyel: a régi szkript és fájl archiválása, a kiváltott globális kulcsok törlése.

### Igazolás (2026-11-26)
- **Az éles adat másolatán** (`pg_dump` olvasva, helyi scratch DB, migráció, `contact-checked-import`), a `dispatch-equivalence` mind zöld:
  - a checked jel 19 728/19 728;
  - a jóváhagyó döntés 800 bemenet-kombináción azonos;
  - az ablak 7 országon, 14 napon át 15 percenként azonos;
  - a napi keret azonos: HU 100, HR 20, a többi 40;
  - a fotó-kapu ítélete 5 162 soron azonos (759 átengedve);
  - a sorrend-kulcs 631 várakozó soron azonos.

  A várakozó jóváhagyási sor a másolaton üres volt, mert a mock-fájlok nem jöttek vele; ezt a kimerítő próba fedi. Élesen a 3. lépés futtatja.
- **Böngészős tesztek:**
  - `country-page-e2e` ⑧: szerkesztés, élő KPI, ↑↓ sorrend, mentés előtti ablak, mentés a sorba, a hibás és a szabályt sértő kézi POST elutasítva, mobilon a hat szakasz;
  - `country-hr-e2e` 47/47.

  Két, a mainen régóta piros e2e-pontot javítottunk, mindkettő teszt-hiba volt: egy időzítési versenyt és egy sablon nélküli fixtúrát.
- **Kapuk:** `dispatch-settings-check` (önteszttel), `country-layer-check`, `town-photo-check`, `qa-review-check`, `nonopener-followup-check`, `escalation-config-check`, `dispatch-priority-check`. Mind zöld.

### Visszafordíthatóság
🔄 A migráció additív, a kiváltott globális kulcsok megmaradnak (a kód nem olvassa őket), a régi szkript `.disabled` néven ott van élesen.
