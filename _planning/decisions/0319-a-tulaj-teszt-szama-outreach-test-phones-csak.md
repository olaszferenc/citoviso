## ADR-0319 — A tulaj teszt-száma (OUTREACH_TEST_PHONES) csak [TESZT] leaden mentes a közös-elérhetőség és a szám-szintű leiratkozás alól

**Dátum:** 2026-10-04 · **Státusz:** elfogadva (lokál; az éles env beállítása külön élesi művelet) ·
**Kiegészíti:** ADR-0258 (közös elérhetőség = küldési kapu), ADR-0082 (SMS-engedélylista) ·
**Őr:** `scripts/owner-test-phone-check.mts` (negatív kontrollal)

### Kiváltó

A tulaj: „nem tudok sms-t mms-t küldeni élesen és teszten”. Mérve (2026-10-04):

- **Éles** (`admin.citoviso.com`, [TESZT] Lovász apartman): „ez a telefonszám (+36305161631) egy másik szálláshoz is
  tartozik: [TESZT] Muschel Panzió”. Élesen nincs `OUTREACH_SMS_ALLOWLIST` (és nem is lehet: az a valódi leadek felé
  minden hideg SMS-t letiltana), így a tulaj teszt-száma ott semmilyen kivételt nem kapott. Két élő teszt-lead viseli
  a számot, köztük nincs `lead_link` ítélet.
- **Dev** (Üdülő tábor): „erre a telefonszámra korábban leiratkoztak (szám-szintű suppression)”. Forrás: az
  Éden üdülőház prospectje 2026-09-25 18:14-kor leiratkozott (a tulaj levél-tesztje, `actor=lead`). Mivel a
  leiratkozás a SZEMÉLYÉ, egy kattintás a teszt-számot minden dev teszt-leaden letiltotta.

Mindkét kapu helyesen működött, a tesztelés viszont szerkezetileg ellehetetlenült. 7 vagy több teszt-lead felett a
közös-elérhetőség kapu már „közvetítő” üzenetet ad, a Duplikátumok lap pedig nem is mutatja a csoportot, így semmilyen
ítélet nem oldaná fel.

### Döntés (tulaj, 2026-10-04: „3: igen”)

1. Új env: **`OUTREACH_TEST_PHONES`** — vesszővel elválasztott számok (bármely írásmód, E.164-re normalizálva). Nem
   korlátoz semmit, ezért élesen is beállítható.
2. A kivétel **mindkét feltételt** megköveteli: a szám listázott **ÉS** a lead neve `[TESZT]`-tel kezdődik
   (`src/outreach/ownerTestPhone.ts`).
3. Hatása a mobil kapu-láncban (`phoneContactBlocks()` a `src/outreach/sendOutreachSms.ts`-ben):
   - **közös-elérhetőség kapu:** átugorja (minden környezetben);
   - **szám-szintű leiratkozás:** átugorja, de **csak az éles hoston KÍVÜL** (`isLiveHost`). Élesen a leiratkozás
     leiratkozás marad, bárki kattintott.
4. **Valódi lead ugyanazzal a számmal SEMMIBEN nem változik:** a közös-elérhetőség és a leiratkozás kapuja ugyanúgy
   tilt. A küldési ablakot és az engedélylistát ez a kivétel nem érinti.

### Őr

`scripts/owner-test-phone-check.mts` (pre-commit, eldobható fixture a valódi DB-ben): a predikátum (név, szám, üres
lista); [TESZT] lead + teszt-szám → mehet; **negatív kontroll: valódi lead + ugyanaz a szám → TILT** (közös
elérhetőség, teszten és élesen is; leiratkozás teszten és élesen is); élesen a [TESZT] lead leiratkozása is tilt; nem
listázott szám → mint eddig; huzalozás. Mutációs próba: a `[TESZT]`-feltétel kivételével 5 ellenőrzés pirosra vált.

### Ismert korlát (dev)

A dev DB-ben 20 lead viseli a tulaj számát (Éden üdülőház, Üdülő tábor, Aranykagyló 36, …), **egyik sem
`[TESZT]` nevű**: valódi leadekre tett teszt-szám. Rájuk a kivétel a döntés szerint NEM hat. Dev-ben a
közös-elérhetőség kaput az engedélylista (`OUTREACH_SMS_ALLOWLIST`) már eddig is feloldotta, a leiratkozást viszont
nem. Kiút: a leiratkozás egyszeri visszavonása a lead lapján („Leiratkozás visszavonása ▸” → „Visszavonás”), vagy a
dev teszt-leadek `[TESZT]` előtagot kapnak (dev adatmódosítás, a tulaj döntése).

### Élesítés

Az éles `/opt/citoviso/app/.env`-be kell: `OUTREACH_TEST_PHONES=06305161631` (+ a kód a nagy deployjal), majd a
`citoviso-console` és a `citoviso-public` újraindítása. Ez külön élesi művelet, külön engedéllyel.
