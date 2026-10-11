## ADR-XXXX — A próba azt ígéri, amit ad (a beállított csomagból); a bukott próba-indítás nem hagy semmit

**Dátum:** 2026-10-11 · **Kontextus:** Elek 10-11 próba-köre (tenant-szem), B1/B2 BLOKKOLÓ + K1, A1–A3, A5, A7;
koordinátori döntés (Elek-teszt koordinátor). **Kiegészíti:** ADR-0360 ⑥ (a próba csomagja paraméter), ADR-0342
(idempotens indítás, IT A-02 folytatás), ADR-0354 (egy név: „Próba-kedvezmény”). **Megtartja:** a „minden funkció”
szöveget, ha a próba tényleg mindent ad.

### Kiváltó (mérve, Elek 10-11)
- **B1:** a `/pricing`-on „A próbázó ezt kapja” = Ajánlott → a próba 7 modult adott, de a próba-űrlap („14 napig minden
  funkció: foglalási naptár, …”), a belépő-levél („minden modul be van kapcsolva”) és az admin Modulok fül („A próbában
  minden modul…”) mindent ígért. A Foglalások fül közben azt írta: „…ha a Foglalás modul be van kapcsolva”.
- **B2:** egy régi (HTML-másolat) mocknál a `startTrial` CLAIM-elte a próbát, a `convertLead` tenantot + site-ot épített,
  majd a `renderSource === "copy"` ág visszatért — `free_trial` `active` + `tenant_id NULL` maradt, egy árva tenant, és a
  lead lapja „Ez az oldal már az Öné”-t mondta belépő nélkül; újrapróba nem volt (a sorhoz se értesítő, se lejárat nem nyúl).

### Döntés
1. **Egy forrás a próba ígéretéhez:** `src/trial/package.ts`. A `trialModuleIds()` (amit a `startTrial` megad) ide költözött;
   mellette `configuredTrialPackage()` (indulás előtt: a beállított csomag) és `tenantTrialPackage()` (futó próba: a
   `trial_grant` sorok). `everything` = minden eladható, kapcsoló-szerű modul benne van — CSAK ekkor marad a
   „minden funkció / minden modul” szöveg; különben a csomag neve + a ténylegesen adott modulok (egyszeri modul — multilang —
   nem szerepel, mert a próba nem generál fordítást).
   - próba-űrlap: „{n} napig a próba csomagja ({pkg}): {modulok}” (manifest `trial.pkg`);
   - belépő-levél: „… és az {pkg} csomag moduljai be vannak kapcsolva.” + „A próbában: …” sor (HTML és szöveges rész);
   - admin Modulok fül: „A próba csomagja: {pkg}. Az alábbi modulok vannak bekapcsolva …” + „Ami nincs a próba
     csomagjában, azt ugyanitt hozzáadhatja.”;
   - **A7** Foglalások fül, ha a próba csomagjában nincs online foglalás: kimondja, és az Üzenetek-beli érdeklődésekre +
     a meglévő „Folytatom — csomag és modulok” útra mutat.
2. **K1:** a `/p/<t>/folytatas` a próba csomagját jelöli elő (`continuation.preset` = a `trial_grant` sorokra pontosan
   illő csomag), nem a Teljest. Nem illő (egyedi) készletnél marad a régi alapérték.
3. **A bukott indítás nem hagy semmit (B2):**
   - régi HTML-másolat mockon a próba **nem indul**, és ezt a claim ELŐTT dönti el (`isEngineArtifact`, ugyanaz a teszt,
     amivel a `convertLead` a másolásra esik vissza): `not_available`, semmi nem jön létre, az operátor riasztást kap; a
     terv-lap ilyen mocknál nem kínál próbát;
   - bármely más bukás (mock-jóváhagyás, render, live render, kivétel) → `abandonTrialStart`: a claim törlődik, az
     indítás által épített tenant (CASCADE, mint a 90 napos törlésnél) és `sites/<tenant>` is, a lead életciklusa
     visszaáll; **pénzhez nem nyúl** (fizetett/függő fizetés vagy előfizetés esetén a tenant marad, a riasztás kézi döntést kér);
   - a régi kód által hagyott félkész állapot (tenant nélküli `active`/`lapsed` claim + árva tenant) **nem tulajdon**
     (`ownedSiteForLead`), a lap újra kínálja a próbát, a következő beküldés befejezi (IT A-02 folytatás);
   - minden nem induló próbáról azonnali ház-riasztás (`alertHouse`, tárgy: „Citoviso: a próba NEM indult el — …”).
4. **Apró:** A1 — a T−3 SMS dátumos alakja a hátralévő napokat is mondja („… 4 nap mulva, okt. 19-en lejar.”), hogy
   hétvégi eltolásnál a két SMS ne legyen szó szerint azonos. A2 — a kedvezmény neve a felületen „Próba-kedvezmény (−X%)”
   alakban (admin sáv, konfigurátor ár-sor és kártya; a levelek adat-táblája címke/érték marad). A3 — a dupla fizetés
   második fülén „A honlapom megnyitása” / „Belépés a kezelőfelületre”. A5 — a jelszó utáni lap kimondja, hogy magától
   továbblép, és JS nélkül is továbblép (meta refresh). A4 (ünnepnap) és A6 nem változott (tulaj-kérdés / koordinátori döntés).

5. **A próba vége naptári napokkal (IT 5. kör A3, koordinátori kiegészítés):** `trial_until = trialUntilFrom(now, days)`
   (`src/trial/config.ts`) — ugyanaz a budapesti falióra-idő `days` NAPTÁRI nappal később. A régi `now + days × 86 400 000 ms`
   az októberi/márciusi átállításon át 13 vagy 15 naptári napot, máskor ±1 órát adott, míg a T−3/T−1 naptári napot számol.
   A tavaszi lyukba eső idő (02:xx) ugyanazon a napon egy órával később van.

### Őr
`scripts/trial-promise-check.mts` (pre-commit, diff-scope): Ajánlott-próbánál a megadott modulok = a kiírt lista (levél,
manifest, valódi Chromium űrlap 390 + 1280 px, admin Modulok/Foglalások), K1 előválasztás (a valódi lapon az
„Összesen” is az előválasztott csomagé), B2 a három bukási út, ⓪ a próba vége óraátállításon át (okt./márc.). A régi
kóddal 27 állítás piros (mérve 2026-10-11). A1/A2/A5: `free-trial-expiry-check`, `proba-c-checkout-check`,
`optout-offer-price-check` frissítve.
