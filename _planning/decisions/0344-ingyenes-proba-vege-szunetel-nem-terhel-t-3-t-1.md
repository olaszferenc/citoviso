## ADR-0344 — Ingyenes próba vége: szünetel (nem terhel), T−3/T−1 figyelmeztetés, folytatás = a meglévő első fizetés

**Dátum:** 2026-10-09 · **Státusz:** elfogadva (backend); a levelek szövege jóváhagyva és bekötve (C2), az SMS él (C2b), az admin-sáv bekötve (C2c)
**Előzmény:** ADR-0342 (próba-állapot, kártya nélküli konvertálás), ADR-0080 (⑥ freeze = 503 + Retry-After
udvariassági lap; ① fordulónap), ADR-0088 (kupon: egyszeri, az első díjra, nem halmozódik), ADR-0334 (9–16 ablak),
ADR-0287 (óránkénti tick). Tulaj-döntés 2026-10-09: a próba végén LEFAGY, nem terhel, kártya nem kell; 3 és 1 nappal
előtte e-mail + SMS, hétköznap 9–16.

### Döntés

1. **Lejárat = szünet, nem terhelés** (`src/trial/expiry.ts` `lapseExpiredTrials`, a napi billing-tick mellett,
   `scripts/billing-cycle.ts`): `free_trial` `active → lapsed` (`lapsed_at`), a site `live → suspended` — a nyilvános
   host a MEGLÉVŐ freeze-lapot adja (503 + Retry-After, nem 404), és a `trial_grant` jelű modulok `active=false`.
   A fizetett modul (trial_grant törölve) érintetlen. Admin-belépés és minden adat marad. Idempotens (`status='active'`
   szűrő). A trial tenantnak nincs subscription sora, ezért a billing-létra sem érinti, és ő sem a létrát.
   - A freeze-lap szövege („Ez az oldal jelenleg nem érhető el.” + a szállás elérhetőségei) okot nem mond, visszatérést
     nem ígér → próbára is igaz, új terv nem kell.
2. **`isSubscriptionFrozen` kiterjesztése:** subscription sor nélkül a `free_trial.status='lapsed'` = fagyott — az admin
   ugyanazt a fagyott állapotot látja, mint a létra ⑥ fokán.
3. **Figyelmeztetés T−3 és T−1** (`runTrialNotices`): csak `mockOutreachWindowOpen` (hétköznap 9–16 Budapest).
   - **Hétvégére eső lépcső → VISSZA a péntekre.** Előre (hétfőre) tolva egy vasárnapi lejárat T−1-e a fagyás UTÁN
     menne ki — a figyelmeztetés értelme pont az, hogy előtte érkezzen.
   - **T−3 és T−1 ugyanarra a napra esik → csak T−1.** Két levél egy órán belül ugyanazzal a dátummal zaj, nem gondoskodás.
   - A próba első napja előtti lépcső nem létezik (rövid próba).
   - **Idempotencia:** a `free_trial_notice` (próba, lépcső, csatorna) sort a küldés ELŐTT foglalja (unique) → kétszer
     nem megy, két átfedő futásnál sem. Csak a legmagasabb esedékes lépcső megy; a kimaradt alacsonyabb `skipped`
     (kiesés után nem megy két levél egyszerre). Telefon nélkül az SMS `skipped`.
   - **Ütemezés:** az óránkénti `citoviso-offer-followup` tick (ADR-0287) viszi — a napi 07:00-s billing-tick sosem
     esik a 9–16 ablakba. **A szöveg jóváhagyásáig SZÁRAZON fut** (`dryRun`): naplózza, mi esedékes, de nem küld és
     NEM foglal sort — egy száraz foglalás a lépcsőt végleg elégetné. Kapcsoló szándékosan nincs: a küldők a jóváhagyott
     szöveggel együtt kerülnek be.
4. **Folytatás = a meglévő első (initial) fizetés egy predikátummal, nem új order-kind.** `continuableTrialForLead`
   (active|lapsed próba, nincs fizetett initial) + `ownedBlocksInitialPurchase` engedi át a `requestPayment`,
   `resolvePayEntry`, `handleOrderRequest` kapun; az árat a tenant kupona (`bestActiveCouponForTenant`) adja.
   Miért nem új kind: a fizetés utáni `activate()` már mindent megcsinál — convertLead idempotens →
   `syncEntitlementsToPaid` (a választott csomag marad, trial_grant le) → live render → `site.status='live'`
   (a suspended is visszakapcsol) → `ensureSubscriptionForOrder` (**fordulónap = az első fizetés napja**, ADR-0080 ①;
   `free_trial → converted`). Egy új kind ezt másolná, és a két másolat elválna.
   - **Belépési pont:** `GET /p/<token>/folytatas` — a megszokott konfigurátor a próba-kuponnal mint ajánlat, a
     `/p/<token>/request`-re küld; csak folytatható próbára, mindenki más vissza a `/p/<token>`-re. A sima `/p/<token>`
     és a `startTrial` továbbra is a SZIGORÚ `ownedSiteForLead`-et nézi (a próbázó ott tulajdonos).
5. **Kupon egyszer:** a próba-kupon (`offer_tenant_coupon_uq`, tenantonként egy) a folytatás-fizetésen ég el
   (`redeemOfferForOrder`, `used_count=1`); üdvözlő kupon nem születik mellé.

### Őr
`scripts/free-trial-expiry-check.mts` (pre-commit): saját scratch-DB, a szolgáltatók mockra kényszerítve és
visszaolvasva. Lábak: `noticeSendDay` tiszta esetei; ablakon kívül 0, ablakban 1+1, második futás 0, kimaradt t3 →
skipped; száraz futás: esedékes, 0 küldés, 0 sor; lejárat → lapsed, suspended, próba-modulok le, fizetett marad,
fagyott; vásárlási kapu; `/folytatas` 200 + kupon / idegennek vissza / fizetés után vissza; valódi `applyWebhookResult`
→ live, converted, anchor = ma, kupon egyszer. `--self-test`: a szabotázs pirosra viszi.

### Kiegészítés — C2: a jóváhagyott levelek bekötése (2026-10-09)

Tulaj-döntés 2026-10-09: a T−3 és T−1 e-mail és a próbás belépő-levél szövege JÓVÁHAGYVA. Terv-kontraktus:
`assets/design-refs/console/proba-levelek/` (README = mit köt).

1. **E-mail ÉLES, SMS SZÁRAZ.** Az óránkénti tick (`scripts/offer-followup.mts`) a `trialNoticeDeps(now)`-val fut
   (`src/trial/notices.ts`): `sendEmail` a jóváhagyott levelet küldi (`src/email/trialEmail.ts`) és a tenant
   postafiókjába naplózza (`tenant_message`, kind `other`, related `free_trial_t3|t1`); `sendSms: null`.
   **`sendSms` null → az SMS-csatorna se nem küld, se nem FOGLAL** (a kimaradt alacsonyabb lépcsőnek sem írunk
   SMS-`skipped` sort) — a száraz foglalás elégetné a lépcsőt, és a jóváhagyás napján a próbázó nem kapna semmit.
   A `dryRun` (deps = null) megmarad diagnosztikának.
2. **A cím a VALÓS hátralévő napokat mondja**, nem a lépcső nevét: a hétvégére eső lépcső pénteken megy (§3), így
   egy hétfői lejárat T−1-e pénteken „Még 3 nap…”, nem „Holnap…” (§B.17). A lejárat napján menő pótlás: „Ma lejár…”
   (ez a forma nem volt a mockban — a jóváhagyott minta logikus folytatása, a tulajnak jelezve).
3. **Link nélkül nincs levél:** üres `PUBLIC_BASE_URL` vagy hiányzó prospect-token → a küldés hangosan bukik
   (`failed` sor), mert a levél célja a „Folytatom” gomb. Kupon nélkül (0%-os próba-kupon, lejárt/elhasznált kupon)
   a kedvezmény-bekezdés és -sorok elmaradnak.
4. **Próbás belépő-levél:** `buildCredentialsEmail({ trial })` — a `startTrial` adja át a próba végét és a kupont.
5. **Lábléc:** `platformMail({ footerReason: "trial" })` → „…oldalát a Citovisónál próbálja ki.” (`T()`); a rendelő
   vevőnél változatlanul „…rendelte meg.” Csak a három próba-levél kapja; a próba alatti egyéb platform-levél
   (pl. jelszó-visszaállítás) ma még a vevői láblécet viszi.
6. **Őr:** a `free-trial-expiry-check` ②b lába: bekötött `sendSms === null`, péntek → 1 e-mail + 0 SMS-sor, a gomb
   linkje, kupon, lábléc, tenant-napló, a hétfői lejárat őszinte címe, a tick a bekötött deps-szel hív (nem dryRun),
   vevői vs. próbás lábléc, a valódi próba-indítás a próbás belépő-levelet küldte. `--self-test`: egy becsempészett
   SMS-küldő pirosra viszi.

#### C2b — az SMS ÉLES (2026-10-09)

Tulaj-döntés (a koordinátoron át): **ékezet nélkül, linkkel**, ≤ 2 szelet, GSM-7; hétköznap 9–16 marad.

7. **`trialNoticeDeps` SMS-küldője ÉL** (`sendTrialNoticeSms`, `src/trial/notices.ts`): a szöveg
   `buildTrialNoticeSmsText` (`src/email/trialEmail.ts`) — a mock szövege, `T()`-ből fordítva, UTÁNA
   GSM-7-re hajtva (`toGsm7`, `src/sms/encoding.ts`): ékezet le, „”–… → ASCII, a maradék nem-GSM jel ki.
   Ugyanaz a valós-napszám szabály, mint a levélnél (≥2 nap → dátum „okt. 22-en lejar”, 1 → „holnap”,
   0 → „ma”); a T−3 záró mondata („Nem terhelunk, ha nem folytatja.”) csak a T−3-ban van, mint a mockban.
   Ha nem fér 2 szeletbe: előbb a záró mondat megy, aztán a szállásnév rövidül „...”-tal — **a link soha**.
   A link séma nélküli (`citoviso.com/p/<t>/folytatas`). Kupon nélkül „Folytatas: <link>”.
   A küldés `sendSms`-en át (Elek-őr, provider-választás ugyanaz); `blocked` → dob → a ledger `failed`
   (nem „sent” egy ki nem ment SMS-re); a kiment SMS a tenant postafiókjába naplózódik (`channel sms`,
   kind `other`, related `free_trial_t3|t1`).
8. **A modem eddig MINDEN SMS-t `-unicode`-dal küldött** (`injectViaGammu`) — az ékezet nélküli szöveg is
   70/67 karakteres szeletekben ment volna, a jóváhagyott T−3 (176 kar.) 3 szelet lett volna. Mostantól a
   tisztán GSM-7 (alap-tábla) szöveg 7 biten megy, minden más változatlanul `-unicode`. Ez MINDEN SMS-t érint,
   ami véletlenül tiszta GSM-7 (pl. a modul-függőség operátor-riasztás): kevesebb szelet, ugyanaz a szöveg.
   A kiterjesztett tábla (€ [ ] { } …) szándékosan UCS-2 marad. A `replies/answerRules.ts` `smsParts`-ja
   UCS-2-vel számol — ez mostantól felső korlát, nem pontos érték.
9. **Őr ②b átírva:** bekötött `sendSms` NEM null; péntek → 1 e-mail + 1 SMS (`sent` sor mindkettőre);
   az SMS GSM-7, ≤ 2 szelet, benne a `/p/<t>/folytatas` link, a tenant-postafiókban; a T−3 a jóváhagyott
   szöveg ékezet nélkül; hosszú ékezetes név → GSM-7, ≤ 2 szelet, ép link; a modem-injektálás GSM-7-nél
   nem kér `-unicode`-ot. `--self-test`: a bekötött SMS-küldő visszacserélve száraz-ra → pirosra megy.

#### C2c — az admin próba-sáv és a próba-lábléc a többi platform-levélen (2026-10-09)

Tulaj-döntés: az admin-sáv **A** változata (vékony sáv minden fülön). Kontraktus: `assets/design-refs/console/proba-admin-sav/`.

10. **Aktív próba → sáv MINDEN fülön** (`trialStrip`, `src/server/adminViews.ts`; állapot: `trialAdminState`,
    `src/trial/admin.ts`, minden admin-fülön betöltve, `src/server/public.ts`): a valós hátralévő napok
    (`trialDaysLeft`), a próba utolsó napja, haladás-csík, „Folytatom” → `/p/<t>/folytatas`; nem zárható be;
    `TRIAL_WARN_DAYS = 3` naptól sárga. A kedvezmény-mondat CSAK élő kuponnal (`liveTrialCoupon` — kiemelve a
    `notices.ts`-ből, EGY szabály a levélnek és a sávnak). Ha a `trial_until` elmúlt, de a 07:00-s lejáratás még
    nem futott: „Az ingyenes próba lejárt.” (a mockban nem volt; a „ma” rossz napon hazugság lenne).
11. **Lejárt próba → szünetel-blokk** (`trialLapsedBlock`, `data-trial-lapsed`). Mérve: lejárt próbánál az admin
    eddig SEMMIT nem mondott — az előfizetéses freeze-blokk a `subscription` sorra épül, ami a próbának nincs
    (az `isSubscriptionFrozen` igaz, a nézet nem rajzolt). Ugyanaz a piros `adm-frz` keret, tartozás nélkül:
    próba-kupon %, „Folytatom — fizetés”, „Mi maradt meg”, látogató-sor; a nem-Áttekintés füleken kompakt.
    Fizetett (`converted`) próba → se sáv, se blokk. A mock „Modulok” kártyájának „csak a próbában volt” címkéi
    NINCSENEK bekötve (nyitott).
12. **Lábléc a többi platform-levélen:** `footerReasonForTenant(tenantId)` (`src/trial/footer.ts`) → `"trial"`, ha
    a fióknak AKTÍV próbája van, különben `"order"`. Bekötve: jelszó-visszaállítás (`buildPasswordResetEmail`
    `footerReason`, hívó `sendPasswordResetLinks`), a tulajnak menő foglalási levelek (`ownerLetter` — a
    `footerReason` KÖTELEZŐ paraméter, 3 hívó — és az új kérés értesítője, `notifyOwner`). Felmérve, nem kell:
    domain-levelek (saját domain csak rendeléssel jár, a próba csak aldomaint ad), számla/rendelés/billing
    (próbázónak nem megy). A lejárt (nem fizetett) próbázó ma a vevői láblécet kapja — nyitott kérdés.
13. **Őr:** a `free-trial-expiry-check` új ②c lába (a VALÓDI `adminDashboard` 13 fülön: sáv mindenütt;
    >3 nap nem warn, ≤3 warn; Folytatom-link; lejárt → `data-trial-lapsed`; fizetett → semmi) és a ②b
    lábléc-láb bővítése (`footerReasonForTenant`, jelszó-visszaállítás próbázónak/vevőnek, a küldők bekötése).
    `--self-test`: a keret próba nélkül kapja / a próba vége kicsúszik a warn-ablakból → pirosra megy.

### Nyitott (a tulajé)
- ~~Az SMS formája~~ → C2b: ékezet nélkül, linkkel. ~~Az admin próba-sáv~~ → C2c: A változat bekötve,
  kontraktus `assets/design-refs/console/proba-admin-sav/`. (A levelek: jóváhagyva, C2.)
- **Meddig marad meg a lejárt próba adata?** Ma semmi nem törli; a szövegek „megmarad”-ot mondanak, határidő nélkül.
- ~~A platform-levél lábléce próbánál nem pontos~~ → C2: a három próba-levélben javítva; C2c: a jelszó-visszaállításban és
  a tulaj foglalási leveleiben is (aktív próbánál). **Nyitott:** a LEJÁRT próbázó is kapja-e a „próbálja ki” láblécet?
- A lejárt próbánál a mock „Modulok” kártyájának „csak a próbában volt” címkéi nincsenek bekötve.
- A lejárat a napi 07:00-s tickkel fut: a `trial_until` után legfeljebb ~1 napig az oldal még él.
