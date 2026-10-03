# Lead-ajánlatok: a bemutatkozó kedvezmény és a döntés-segítő (eszkalációs) ajánlat a /pricing-on. Jóváhagyott terv

**Jóváhagyva:** 2026-09-30, két körben, tulajdonosi döntés a koordináló sessionön át.
- **1. kör (ADR-0285):** az „A” változat (saját szekció az alapdíj alatt): kapcsoló, küszöb, kedvezmény. A nem
  választott „B” a modul-sorok után, kompakt sorokban ült, és csak a Magyarország oldalon volt szerkeszthető.
- **2. kör (ADR-0286):** ismét az „A” változat (egy rács: bemutatkozó sor, alatta a döntés-segítő két sorban).
  Új mező az ajánlat érvényessége, az emlékeztető késleltetése és a bemutatkozó kedvezmény. A nem választott „B”
  két kártyát tett egymás mellé, a „C” idővonal-lépésekbe rendezte a mezőket.

Kiváltó kérés: a tulaj a megnyitások darabszámát, a kedvezményeket és az időzítést az árazási felületen akarja
állítani, mert eddig be volt égetve (`offers.ts`: 3 / 50 / 72 óra / 24 óra / 25 %). Kapcsolódó: ADR-0088 §4 (az
eszkalációs mechanizmus), `offer-ui/` (a lead oldali döntés-kártya, változatlan), `outreach-mail/` (a levél, ami a
bemutatkozó %-ot idézi), `pricing-sales/` (a /pricing kötött elemei, változatlanok).

- Terv: `plan.html` (önhordó, kattintható: kapcsoló, élő validáció a mező-közi szabályokkal, előnézet, régió-váltó,
  mentés; „Mobil 390px / Asztali” váltó)
- Képek: `plan-desktop.png`, `plan-mobile.png`

**Hatókör:** `src/console/views.ts` · `src/payment/offers.ts` · `src/console/server.ts`

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Hely:** saját **„Lead-ajánlatok”** szekció közvetlenül az Alap-előfizetés alatt, az alapdíjjal azonos
   mező-formában (felirat fölül, szám + egység egy keretben, 3 oszlop asztalon, 1 oszlop telefonon).
2. **Globális:** a szekció MINDEN régió-oldalon ott van és szerkeszthető, a **„minden piacra érvényes”** jelzéssel;
   bármelyik régió mentése menti. Tárolás: egyetlen `app_setting` sor (`escalation_offer`, JSON:
   `enabled`, `threshold`, `percent`, `offerHours`, `followupHours`, `outreachPercent`), migráció nincs. Ha nincs
   ilyen sor, az `offers.ts` konstansai adják az értéket; egy hiányzó kulcs a saját alapértékét kapja (az 1. kör sora
   így változatlanul érvényes); egy sérült vagy a szabályt sértő sor egészében az alapértékre esik vissza.
3. **Két rész, egy szekcióban.** Fent a **„Bemutatkozó ajánlat”** egy mezővel (**„Bemutatkozó kedvezmény (a levéllel jár)”**,
   5–50 %). Ezt a kapcsoló NEM érinti: a levélhez tartozik, nem a döntés-segítőhöz. Alatta a kapcsoló a
   **„Döntés-segítő (eszkalációs) ajánlat”** előtt, és a hozzá tartozó négy mező. Kikapcsolva nem keletkezik ÚJ
   döntés-segítő ajánlat, a négy mező halvány és tiltott, a számok megmaradnak. A már futó ajánlatok a lejáratukig élnek.
4. **A döntés-segítő mezői:**
   - **„Hányadik megnyitásnál kapja”**: egész, 2–10, egység: „. megnyitás”.
     Alatta kapcsoló (C változat, tulaj-döntés 2026-10-03, Elek L3-1): **„Csak a különböző napokon történt megnyitások számítanak”**,
     alapból BEKAPCSOLVA. Bekapcsolva a küszöb a lead azon NAPJAIT számolja (Europe/Budapest naptári nap), amelyeken megnyitotta a
     tervet; egy napon belül akárhány megnyitás egynek számít. A mező alatti sor ezt kimondja (bekapcsolva: „egy napon belül akárhány
     megnyitás egynek számít (telefon + gép ugyanaznap = 1)”, kikapcsolva: „Minden megnyitás számít — egy napon belül is”). A kapcsoló
     a döntés-segítő főkapcsolójával együtt tiltódik; kikapcsolt döntés-segítőnél a tárolt értéke marad. Az előnézet és a mentés-
     visszajelzés bekapcsolva „(különböző napon történt) megnyitáskor” alakban mondja a küszöböt. A kapcsoló változása „élő ajánlat”
     sort vált ki, mint a többi döntés-segítő mező. Ok (mérve, Elek 3. kör): a 3. megnyitás kb. 2 perccel a kiküldés után jött — egy
     valódi tulaj telefonon és gépen is gyorsan megnyitja, és a −50% még a döntése ELŐTT ment ki.
   - **„Kedvezmény az első díjból”**: egész, a bemutatkozó %-nál nagyobb, legfeljebb 90 %.
   - **„Az ajánlat érvényessége”**: egész óra, 24–168. Alatta a napokra váltott érték (pl. „= 3 nap”).
   - **„Emlékeztető levél a kiadás után”**: egész óra, legalább 1, és kevesebb az érvényességnél. Alatta: hány óra
     marad utána a döntésre.
5. **Mező-közi szabályok, mindkét mezőt jelölve:**
   - eszkalációs % > bemutatkozó % (a kedvezmények nem adódnak össze, a legnagyobb él). Kikapcsolt döntés-segítőnél
     is él: ekkor a bemutatkozó mező jelez, mert visszakapcsoláskor a tárolt eszkalációs % soha nem érvényesülne.
   - emlékeztető < érvényesség (különben lejárt ajánlatról szólna).
6. **Élő validáció:** a hibás mező pirosan keretezett, alatta a konkrét ok. Hiba esetén a mentés-gomb tiltott, mellette
   összesítő (hány mező hibás). A szerver ugyanazzal a szabállyal (`escalationConfigErrors`) újra ellenőriz, és hibás
   értéknél SEMMIT nem ment (az árakat sem).
7. **Előnézet:** egy mondat arról, mit fog tenni a beállítás: a levél −O %-ot ígér, a lead az N. megnyitáskor −P %-ot
   kap H órára, és F óra múlva emlékeztetőt. Az emlékeztetőt óránként küldjük, csak 8:00 és 20:00 (Europe/Budapest)
   között (`citoviso-offer-followup.timer`, ADR-0287), ezért legfeljebb egy órát késik, és az éjjel esedékes reggel 8
   után megy. Ha az emlékeztető után legfeljebb 12 óra (az éjszakai szünet) marad a lejáratig, a mező alatti sor
   kimondja, hogy egy éjszakára eső lead nem kapja meg. Egy ajánlatra legfeljebb egy emlékeztető megy (atomi foglalás). A Magyarország oldalon valós példa is
   tartozik hozzá (a középső díjcsomag listaára → a kedvezményes ár, `floor`, ugyanaz a matek, mint a szerveren).
   Kikapcsolva az előnézet ezt mondja ki.
8. **A már kiadott ígéretek nem változnak, és a felület ezt kimondja, ha az érték változott:**
   - **A levél %-a köt.** A bemutatkozó %-ot a kiküldés RÖGZÍTI (`offer` sor, `kind='outreach'`, a sikeres küldés
     után). Egy %-állítás után a már kiküldött levél leadje, akár megnyitotta már, akár nem, a levélben ígért %-ot
     kapja. Az új érték csak az ezután kiküldött levelekre vonatkozik. Az ugyanannak a leadnek később küldött levél is a
     rögzített %-ot idézi.
   - A futó döntés-segítő ajánlat a saját %-át és lejáratát tartja (a sorba van pecsételve). Ha van ilyen, a felület
     kiírja, hány darab fut és mekkora kedvezménnyel.
   - Az **emlékeztető késleltetése a futó ajánlatokra IS hat** (tulajdonosi döntés): minden futáskor a kiadás óta
     eltelt időből számol, és ha az ajánlat addigra lejár, nem megy ki emlékeztető. A felület ezt is kimondja.

Megvalósítás: `src/payment/offers.ts` (`getEscalationConfig` / `parseEscalationSetting` / `setEscalationConfig` /
`escalationConfigErrors` / `escalationFromForm`; `stampOutreachOffer` / `outreachPercentForProspect`; az
`ensureEscalationOffer` és az `escalationFollowupsDue` innen olvas), `src/outreach/draft.ts` (a levél a
prospecthez tartozó %-ot idézi), a négy küldési út (`sendBatch.ts`, `sendOutreachSms.ts`, `sendOutreachPair.ts`,
`console/data.ts markProspectSent`), `src/console/views.ts` (`escalationSection`), `src/console/server.ts`
(GET / POST /pricing), `public/assets/ui/citui-console.css` (`.pr-esc*`, `.pr-ferr`, `.pr-hint`).
Őr: `scripts/escalation-config-check.mts`.
