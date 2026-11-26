## ADR-0498 — Élesi végpróba [TESZT]-leaddel: minimum-terhelés, ablak- és keret-kivétel, visszautalás és sztornó kódból

- **Dátum:** 2026-11-26 (este)
- **Státusz:** elfogadva (tulaj „Végpróba” 22:08; „7 € helyett 0,10 €”, „a küldési ablakot CSAK a [TESZT] leadekre … ma este”, a koordinátoron át, `cit9b4690e3`)
- **Érinti:** `src/payment/testCharge.ts` (új), `src/console/server.ts`, `src/tenant/moduleUpsell.ts`, `src/payment/billing.ts`, `src/tenant/multilangOrder.ts`, `src/outreach/autoDispatch.ts`, `src/outreach/sharedContactGate.ts`, `src/payment/refund.ts` (új), `src/payment/gateway.ts`, `src/payment/barion.ts`, `src/payment/mock.ts`, `src/invoicing/{invoice,szamlazz,mock}.ts`, `src/outreach/mockRenderGate.ts`, `hooks/pre-commit`, `migrations/0159_payment_refund.sql`, `scripts/test-lead-clone.mts`, `scripts/payment-refund.mts`, `scripts/test-lead-purge.mts`, `scripts/test-charge-check.mts`, `scripts/test-lead-clone-e2e.mts` (újak)

### Mi
A tulaj (és a próba-session) a teljes ÉLES láncot egy valódi, a lánc által talált lead **[TESZT]-másolatán** játssza végig: jóváhagyó lap, kiküldés, mock, próba, valódi kártyás fizetés, admin, bővítés, lemondás, visszautalás, takarítás. A „[TESZT]” névelőtag (`isTestLeadName`) az egyetlen jel:
1. **Minimum-terhelés.** A [TESZT]-lead minden rendelése (első vásárlás vagy próba-folytatás, bővítés, megújítás, többnyelvűség) a fizetési szolgáltató minimumát terheli a rendelés pénznemében (Barion: 0,10 € / 10 Ft). Az ár ott születik, ahol a rendelés ára (`order_intent.price`), így a fizetés, a kapu és a számla egyezik. Az ársor nem változik, a képernyő a listaárat mutatja, és az ár-ellenőrzés a listaárral fut. Domain-díj és kedvezmény-levezetés ilyen rendelésen nincs. `TEST_LEAD_CHARGE_MINOR`: más összeg (a minimum alá nem mehet) vagy `off`.
2. **Ablak és keret.** A [TESZT]-levél a tulaj saját címére megy (a küldés eddig is kivette az ablak, az egyszeri-cím és a közös-kontakt alól), ezért az időzítő kör zárt ablakban és betelt keretnél is felveszi, de ilyenkor CSAK a [TESZT]-et. Nem számít bele sem az ország napi keretébe, sem a felfutás napi összegébe. A valódi leadek ablaka és kerete változatlan.
3. **Ikerkapu.** Egy korábbi [TESZT] a közös (tulaj-)címen nem tartja vissza a következő [TESZT]-et. Valódi lead a közös kontakton továbbra is visszatartja.
4. **Másoló** (`test-lead-clone.mts`): a másolat egyetlen kontaktja a tulaj címe (env, sosem a parancssorban vagy a naplóban). Mindkét terv saját fájlba renderelődik újra, AI nélkül. A forrás verdiktjeit és jóváhagyását nem másolja, a render-kapu újra ítél. A sor a tulaj lapjára kerül. A forrás érintetlen.
5. **Visszautalás + sztornó kódból** (`payment-refund.mts` → `refund.ts`): Barion `/v2/Payment/Refund`, a fizetés `refunded` (0159), és minden kiállított számla Számlázz-sztornót kap (`action-szamla_agent_st`). Az eredeti sor `storno` lesz, a sztornó bizonylat saját sor (`cancels_invoice_id`). Valódi leadre csak `--real`-lel fut.
6. **Takarító** (`test-lead-purge.mts`): csak [TESZT]-lead. A láncot az adatbázis saját idegen kulcsai mentén járja be, mindent ment (sorok + mock- és tenant-fájlok), és egy tranzakcióban töröl. Nem fut, amíg van visszautalatlan fizetés vagy sztornózatlan számla.
7. **Mért hiba, közben a mainen javítva (`431c83ac`):** a `/jovahagyas` Mehet-je csak a régi jegyzetű sort írta át, a lap viszont a „gépi kapura vár” jegyzetűeket is listázza. A `test-lead-clone-e2e` ② ezt méri.
8. **Hibajavítás menet közben:** a render-kapu „hálózat elcsendesült” várakozása a falióra (`Date.now()`) szerint mérte az eltelt időt. Befagyasztott órán, amin a teszt-világok a küldést futtatják (`hr-world`), a ciklus soha nem ért véget, és a mai mainen a `hr-vegproba-e2e` is végtelenül lógott (mérve 2026-11-26 23:40, változtatás nélküli fán is). Az eltelt időt most monoton óra (`performance.now()`) méri.

### Miért
A horvát piac 2026-11-26-án élesedett. A scratch-próba (42/42) megvolt, az élesben valódi pénzzel végigjátszott lánc nem. Kód nélkül csak kézzel lett volna: SQL-lel tolt 98 %-os kampány (2026-10-04 Muschel, a megújítás listaáron terhelt volna), kézi Barion- és Számlázz-kattintás, kézi törlés. A §2c szerint a kézi lépés kódhiba.

### Visszafordíthatóság
🔄 — `TEST_LEAD_CHARGE_MINOR=off`, illetve a [TESZT]-kivétel egy-egy feltétel. A 0159 csak bővít (új státusz és oszlopok).

### Elvetett
- Az éles ársor átírása a próba idejére: minden valódi vevő ezt olvassa.
- Egy 98 %-os kampány a teszt-prospectnek: csak az első rendelést fedi, a megújítás és a bővítés listaáron menne.
- Kézi visszautalás a Barion felületén és kézi sztornó a Számlázzban: a tulaj szabálya szerint hiány, amit kódban kell pótolni.
