## ADR-0348 — Visszamenőleges „14 nap ingyen” levél + SMS a már megkeresett leadeknek: egy lövés kódban, „mi tartja vissza?” → prospect_feedback

**Dátum:** 2026-10-09 · **Státusz:** elfogadva (tulaj-döntés 2026-10-09: C levél a „Helyezést nem ígérünk.” mondat nélkül,
a csak-mobilosok SMS-t kapnak, jogalap eldöntve) · **Előzmény:** ADR-0342 (próba), ADR-0343 (pirula, `trial.sub`),
ADR-0344 (C2b ékezet nélküli SMS), ADR-0345 (90 napos megőrzés), ADR-0346 (egy kupon), ADR-0347 ④ (ígért aldomain = slug),
ADR-0291 (GET nem dönt), ADR-0322 ④/B (kimondott ok), ADR-0334 (hétköznap 9–16), ADR-0082/0112 (SMS-út).
**Terv:** `assets/design-refs/console/proba-visszamenoleges-level/` (README = ami köt).

### Döntés

1. **Címzett:** minden lead, akinek a hideg megkeresése TÉNYLEG kiment (`email_sent_at` vagy `sms_sent_at`), az ÉLŐ
   prospectjén át (a legújabb nem archivált), leadenként egy. Csatorna = amin a hideg megkeresés ment: levél, ha ment
   levél és van cím; különben SMS, ha ment SMS és a szám magyar mobil. **Kimarad:** archivált, teszt-lead, leiratkozott
   (bármely prospect-sor, vagy cím/szám szintű suppression), vásárolt (`ownedSiteForLead`), próbázó (`free_trial`),
   rendelési szándék (`order_intent`/`converted` státusz vagy leadott rendelés), operátori kizárás, aki már megkapta,
   csatorna nélküli, és egy cím második leadje. Az elutasító válasz NEM leiratkozás: megkapja.
2. **Operátori kizárás tartósan, nem név szerint:** `scripts/trial-campaign.mts --kizar <prospect|lead> --ok "<ok>"`
   egy `excluded` sort ír a `trial_campaign`-be (a kézi szálban lévő 2 lead így marad ki az éles futás előtt).
3. **Egy lövés kódkényszerként** (`migrations/0101_trial_campaign.sql`): `trial_campaign` — UNIQUE `lead_id`, és
   egyedi (`channel`, `address_key`) (e-mail: `recipientKey`, SMS: E.164). Foglalás a küldés ELŐTT, bukáskor feloldás.
   Az eszkalációs follow-up (`escalationFollowup.ts`) a kampányt kapott leadnek/címnek nem küld — a lábléc ígérete
   („Erről a próbáról több levelet nem küldünk”) így igaz.
4. **Szöveg = a jóváhagyott C**, egy forrásból (`src/email/trialCampaignEmail.ts`): a szöveg-rész a nevesített
   részekből áll össze, a HTML ugyanazokat rendereli (§I), Outlook-biztos táblaszerkezet (az `outlook-lint` listáján).
   A számok forrása: próba-napok `getFreeTrialConfig()`, megőrzés `TRIAL_RETENTION_DAYS`, kupon `getCouponConfig()`
   (0% → a kupon-mondat elmarad), az aldomain `plannedSiteSlug()`. A §C kapu a hideg levél SAJÁT bírája
   (`checkOutreachDraft`, a paramétere `CheckableLetter`-re szélesítve — nem másolat).
5. **SMS:** ékezetes forrás → `toGsm7`, a linkkel, ≤ 2 szelet; hosszú névnél a név rövidül, a link soha. A §C SMS-kapu a
   név GSM-7 alakját keresi (azt viszi az üzenet). A küldés a hideg SMS közös kapu-láncán megy (`mobileOutreachGates`).
6. **„Mi tartja vissza?”:** a három levél-gomb `/p/<token>/why?forras=proba&ok=<ok>`-ra visz; a GET semmit nem ír, a
   koppintott ok előre kijelölt (csak a három levél-ok jelölhető ki), mind az öt választható, a leiratkozás egy koppintásra.
   A POST `prospect_feedback.source = 'trial_mail'` (új CHECK-érték, 0101).
7. **Futtató:** szárazon alapból (számok okonként + minta; `--kapuk` = §C minden célponton, küldés nélkül), `--go` csak
   hétköznap 9–16 (üzenetenként újramérve), sorban, SMS ≥ 90 mp, napló `tmp/trial-campaign.log`. `--render` a mintát a
   `_drafts/proba-E2/` alá rajzolja. Valódi küldés a nagy deploy UTÁN, a tulaj külön „mehet”-jével.

### Mérés (2026-10-09, a kódból — a levél állításai mögé)

- **A próba-oldal NEM noindex.** A próba `rerenderTenantSnapshot(tenantId, { as: "live" })`-val renderel (`src/trial/start.ts`
  5. lépés), azaz `phase: "live"` → `src/engine/seo.ts`: `index, follow`; a tenant-host `robots.txt`-je `Allow: /` +
  `Sitemap:` (`src/server/public.ts`), a `sitemap.xml` a valóban kiírt oldalakat listázza. `noindex` csak az előnézeti
  (/p, preview-host `x-robots-tag`) és a felfüggesztett (lejárt próba: `suspendedPage.ts`) lapon van. → A „Google számára
  olvasható felépítés (szállás-adatok, oldaltérkép)” állítás igaz.
- **A foglalás-modul aktív a próbázónál.** `trialModuleIds()` = minden nem kivezetett modul, a `booking` is (`src/modules.ts`
  nem `retired`), és a `module_entitlement` sorok `trial_grant = true`-val aktívak (`free-trial-check` ④ méri). A naptár a
  tulaj egység/ár-beállításaiból dolgozik (a `booking` a `pricing`-ot igényli, az is aktív). → „Minden funkció be van
  kapcsolva, az online foglalással együtt” igaz. (A dev-DB-ben ma nincs próba-sor, ezért élő példányon nem mértem.)

### Következmény

- Dev-DB célcsoport (2026-10-09): 16 megkeresett lead → 9 leiratkozott, 3 vásárolt, 1 teszt → 3 célpont (2 levél, 1 SMS).
  Az élesi számok (a terv szerint 172: 130 levél + 42 SMS, mínusz a kézi szál 2 leadje) az éles száraz futásból jönnek.
- Őr: `scripts/trial-campaign-check.mts` (pre-commit, diff-scope-olt, `--self-test`-tel).
