## ADR-0344 — Ingyenes próba vége: szünetel (nem terhel), T−3/T−1 figyelmeztetés, folytatás = a meglévő első fizetés

**Dátum:** 2026-10-09 · **Státusz:** elfogadva (backend); a levelek szövege jóváhagyva és bekötve (C2 kiegészítés, lent); az admin-sáv és az SMS formája a tulajnál
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

### Nyitott (a tulajé)
- Az admin próba-sáv (A/B) és az SMS formája (linkkel/link nélkül, ékezetes/ékezet nélkül) — mock:
  `~/rc-briefs/proba-C-mock-20261009/proba-C.html`. (A levelek: jóváhagyva, C2.)
- **Meddig marad meg a lejárt próba adata?** Ma semmi nem törli; a szövegek „megmarad”-ot mondanak, határidő nélkül.
- ~~A platform-levél lábléce próbánál nem pontos~~ → C2: a három próba-levélben javítva.
- A lejárat a napi 07:00-s tickkel fut: a `trial_until` után legfeljebb ~1 napig az oldal még él.
