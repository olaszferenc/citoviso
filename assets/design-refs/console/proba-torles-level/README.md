# Ingyenes próba — törlés-figyelmeztető levél (7 nappal a törlés előtt) — jóváhagyott terv

**Jóváhagyva:** 2026-10-09, tulajdonosi döntés (§2b terv-kapu, a koordinátoron át): **az „A” változat** (teljes:
dátumok + kupon a fizetéshez; kupon nélkül az „A kupon nélkül” ág). Képek: `a-*.png`, `a-hetvege-*.png`,
`a-kupon-nelkul-*.png` (a tulaj által jóváhagyott mock). A „B rövid” változat NEM lett jóváhagyva.
**Vázlat:** `proba-torles-level.html` (változat-váltó + Mobil 390px / Asztali váltó); a `level-*.html` a VALÓDI
építővel renderelt levél mintaadattal.
**Megvalósítás:** `src/email/trialEmail.ts` (`buildPurgeWarningEmail`) · küldés: `src/trial/notices.ts`
(`sendPurgeWarningEmail`, `purgeWarningDeps`) · ütemezés: `src/trial/retention.ts` (`runPurgeWarnings`,
`purgeWarningDay`, `effectivePurgeDay`) · óránkénti tick: `scripts/offer-followup.mts` · ADR-0345.

**Hatókör:** `src/email/trialEmail.ts` · `src/trial/notices.ts` · `src/trial/retention.ts` · `src/email/platformLayout.ts`

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **A keret a platform-levél** (`../platform-email/`), próba-lábléccel (`footerReason: "trial"`): **„oldalát a Citovisónál próbálja ki.”**
2. **Tárgy:** **„{n} nap múlva töröljük a próba-honlap adatait – {site}”**, címsor: **„{n} nap múlva töröljük a próba-honlap adatait”**.
   ⛔ Az {n} a VALÓS napok száma a küldés napjától a törlés napjáig (Budapest naptári nap): hétvégére eső
   figyelmeztetés a péntekre kerül (`purgeWarningDay`), és ott **9 nap** áll, nem kerekített 7 (§B.17).
3. **Szöveg:** **„{Art} {site} honlapjának ingyenes próbája {until} lejárt. Az adatait azóta megőriztük; {purge} véglegesen töröljük a honlapot, a szerkesztő-fiókot és a feltöltött fényképeket.”**
   (a dátumok „2027. január 20-án, szerdán” alakúak; a szállás neve és a törlés napja félkövér). A {purge} a levél
   által ígért nap: késve kiment levélnél az `effectivePurgeDay` (a törlés csúszik, az értesítés nem rövidül).
4. **Kupon (csak élő próba-kuponnal, `liveTrialCoupon`):** **„Ha folytatná, a próbához kapott kedvezménnyel még megteheti: {percent} az első díjból, {until}-ig.”**
   Kupon nélkül a bekezdés ÉS a „Kedvezmény” sor elmarad — kedvezményt nem ígérünk, ami nincs.
5. **Adat-panel:** „A próba vége” · „Törlés napja” · „Kedvezmény” („30% az első díjból, 2027. jan. 20-ig”).
6. **Egyetlen gomb:** **„Folytatom”** → `/p/<token>/folytatas` (ADR-0344 ④). Link nélkül a levél nem megy ki (a küldő hangosan bukik).
7. **Zárás:** **„Ha nem folytatja, nincs teendője — díjat nem számítunk fel.”**
8. **Ablak:** csak hétköznap 9–16 (ADR-0334), az óránkénti tick viszi, próbánként egyszer (`free_trial_notice` 'p7').
   A napi törlés CSAK kiment ('sent') figyelmeztetés után, legalább 7 nappal később fut.

## Kötő horgony
- `buildPurgeWarningEmail`
- `purgeWarningDeps`
- `effectivePurgeDay`

## NEM köt (nyitott)
- A kupon-mondat a próbához kapott kupont nevezi meg; ha az egyesített kupon-szabály (G) más megnevezést ad,
  a mondat ahhoz igazodik, a jelentése (egy kupon, az első díjból) nem változik.
