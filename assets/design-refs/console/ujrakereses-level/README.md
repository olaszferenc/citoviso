# Újrakereső levél (A2) — jóváhagyott terv

**Jóváhagyva:** 2026-10-26, tulajdonosi döntés (§2b terv-kapu, a CIT „Megkeresés újraindítása” főszálon, szó szerint):
„mehet a renderelés + az új lead megkeresés + a korábban már kiküldöttek újra megkeresése a megbeszélt kommunikációval”.
A „megbeszélt kommunikáció” az A2 kör (10-22 15:13, a koordinátoron át bemutatva): az A változat
(„Mi változott”, egy gomb) + a B „mi tartja vissza?” blokkja + a „más stílusú változat” mondat + az átírt vég.
Jogalap: eldöntve, nem nyitjuk újra.

**Terv (jóváhagyott kép):** `terv-A2.html` · `terv-A2-mobile.png` · `terv-A2-desktop.png` · `terv-A2.txt`
(Gilice Panzió és Étterem, valós adattal, hamis tokennel).
**Valódi render:** `level.html` · `level-mobile.png` · `level-desktop.png` · `level.txt`
(a VALÓDI építővel, mintaadattal: `npx tsx scripts/trial-campaign.mts --render`).
**Megvalósítás:** `src/email/trialCampaignEmail.ts` (a levél) · `src/outreach/trialCampaign.ts` (célcsoport, kapuk,
egy-lövés, küldés) · futtató: `scripts/trial-campaign.mts` · őr: `scripts/trial-campaign-check.mts` · ADR-0348.
Az SMS-iker VÁLTOZATLAN: `../proba-visszamenoleges-level/` 8. pont.

**Hatókör:** `src/email/trialCampaignEmail.ts` · `src/outreach/trialCampaign.ts` · `scripts/trial-campaign.mts`

> **Felülírja** a `../proba-visszamenoleges-level/` levél-részét (1–6. pont: tárgy, nyitás, gombpár, „Ha kipróbálja”, vég).
> Az ottani 7. (egy-lövés), 8. (SMS) és 9. (küldés) pont él, a lábléc mondata az alábbi szerint módosul.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Tárgy:** **„{name}: azóta élesben is kipróbálhatja”**. Fejléc-címke: **„Újdonság”**.
2. **Nyitás:** **„Tisztelt {name}!”** · **„{when} küldtünk Önnek egy honlap-tervet.”** (a hideg megkeresés napja,
   Budapest, „Október 8-án” alakban) · **„Azóta három dolog változott, ami Önnek is számíthat.”**
3. **„Mi változott” — a terv képe FÖLÖTT, három pont, mind élesen igaz a küldés napján (§B.17):**
   - **„{days} napig ingyen, élesben kipróbálhatja a tervét: bankkártya nélkül, és a végén semmit nem terhelünk.”**
   - **„Bármelyik csomagunk díja egy .hu webcímet is tartalmaz, külön havidíj nélkül (pl. a szálláshelye nevével). A próba citoviso.com-os címen fut, a .hu cím a megrendeléssel jár.”**
     (forrás: `pricing_config.domain_free_in_package`; a próbában csak `<slug>.citoviso.com`)
   - **„A foglalási naptár iCal-linkkel, szobánként összeköthető a Booking.com, a Szállás.hu és az Airbnb naptárával. Az árak nem szinkronizálódnak: a portálon és a honlapon külön állítja őket.”**
     (ADR-0361; a jog-provenance-őr javította: „kétirányú” ígéret és ár-szinkron NINCS)
   - ⛔ „Több terv egy linken” NEM pont: élesen nincs (`feat/multimocktabs` nincs a mainen).
4. **A terv képe** (a hideg levél outreach-shotja, CID) a tervre nyit (`forras=proba`), alatta **EGY gomb:**
   **„Kipróbálom {days} napig ingyen”** → a mock linkje `forras=proba&proba=nyit` paraméterrel; alatta a puszta URL.
5. „Más stílusú honlap-változatot is készítettünk a szálláshelyének. Ha kíváncsi rá, jelezze a gombbal, és elküldjük.”
   + gomb „Kérem a másik változatot” (a kódba kerüléséig NEM kötő felirat — a drift-őr ezért nem méri) → `/p/<slug>/<token>/masik-valtozat`.
   ⏸ **JÓVÁHAGYVA, DE MÉG NINCS A LEVÉLBEN.** Csak akkor kerülhet be, ha kész a kattintás-célja:
   `GET` megerősítő oldal, ami nem ír (ADR-0291); `POST` → egy `outreach_reply` sor a Válaszok postaládába
   (`source_key = alt:<prospect_id>`, idempotens; migráció: a `channel` CHECK `click` értéke) + ház-riasztás; a válasz a
   meglévő válasz-úton (`src/replies/answer.ts`) megy, kurátor által jóváhagyott, újrarenderelt alternatívával. A mondat
   CSAK annál a leadnél jelenhet meg, akinek van alternatív mockja (más sablon, azonos fotókészlet, nem elutasított; élesen
   10-22: 122/128), és ezt a levél-építő a küldéskor méri. Az őr ma azt méri, hogy a mondat NINCS a levélben.
6. **„Ha nem érdekli: mi tartja vissza?”** / **„Koppintson a válaszára, és a megnyíló oldalon egy gombbal elküldheti. Ez nem leiratkozás.”**
   és a három gomb: **„Drágának találom”** · **„Most nem időszerű”** · **„Nem értem, vagy nem bízom benne”**
   → `/p/<token>/why?forras=proba&ok=<ok>`. A GET csak megnyit és előre kijelöl, a POST rögzít (`prospect_feedback`,
   `trial_mail`) — a régi „Egy koppintás, és megtudjuk.” ezért hamis volt, és kivezetve.
7. **„Mi történik a {days} nap végén?”** — pontokban, mindegyik a kódé:
   - **„Ha nem rendeli meg: a próba-honlap leáll, semmit nem fizet, és semmit nem kell lemondania.”** (`suspended`, kártya nincs)
   - ha a leadnek van ajánlata: **„Ha a {days} napon belül megrendeli: megkapja a korábban ígért {p}% kedvezményt (éves fizetésnél az első évre, havi fizetésnél az első hónapra; utána a listaár érvényes).”**
     A {p} = `trialCampaignOffer` (a `pinTrialOffer` szabálya). A **„korábban ígért”** jelző CSAK akkor áll, ha a százalék
     a leadnek ténylegesen kiadott ajánlatból jön (élő ajánlat-sor vagy régi küldés bevezetője); az operátori alap-%-nál a
     jelző elmarad. 0% vagy nincs ajánlat → a pont elmarad.
   - **„A próbában feltöltött képeit és szövegeit a próba vége után még {n} napig megőrizzük, ha később mégis folytatná.”** (`TRIAL_RETENTION_DAYS` = 90)
8. **Lábléc:** **„Erről a próbáról kérés nélkül több levelet nem küldünk.”** (a kért válasz nem új megkeresés), a leiratkozó
   link, a jogalap-sor, a cégazonosítás — változatlanul.
9. **Kapuk a levél-ágban (2026-10-26, a hideg levélével azonos):** a mock kurátori jóváhagyása (`approved`) és a
   generáláskori őr-lelet (`blockingVerdicts`; a kurátor által vállalt lelet átmegy). A kampány leletet nem vállal át:
   ilyenkor a lead kimarad, a száraz futás kiírja, miért.
10. **Kik kapják:** ADR-0348 szerint — az elutasító válasz NEM leiratkozás, ők is megkapják; akit az operátor kímélni
    akar, azt `--kizar`-ral veszi ki. A levelek és az SMS-ek külön hullámban mennek: `--csak-level` / `--csak-sms`.
