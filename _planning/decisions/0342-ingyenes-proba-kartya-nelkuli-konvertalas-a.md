## ADR-0342 — Ingyenes próba: kártya nélküli konvertálás, a próba-állapot külön táblában (nem az előfizetésen)

**Dátum:** 2026-10-09 · **Státusz:** ELFOGADVA (tulaj-döntés 2026-10-09: próba VAN, full funkció,
végén szünetel, nem terhel; a szerkezeti döntés a SUB A-é) · **Kapcsolódó:** ADR-0080 (előfizetés-motor),
ADR-0088 (offer-réteg, ⑥ nem halmozódik), ADR-0285 (app_setting-minta), ADR-0330 (előnézeti aldomain),
ADR-0111 (piac-kapu), §A (fotó-nyilatkozat), ADR-0056 (ÁSZF-verzió).

**Kérdés:** `subscription.trial_until`, `trial` státusz — vagy máshol éljen a próba?

**Döntés: külön `free_trial` tábla (0097), a próbázó tenantnak NINCS `subscription` sora.**
- A `subscription` a fizetés szülötte: `anchor_date NOT NULL` = az első fizetés napja (ADR-0080 ①).
  Próba alatt nincs fizetés → nincs fordulónap; egy kitalált anchor hamis fordulót adna.
- A napi billing-tick (`runBillingCycle`, `mintRenewalForTenant`) CSAK subscription sorokon iterál →
  próbázóra szerkezetileg nem mintázhat számlát és nem indíthat dunninget. Egy `trial` státusz ezzel
  szemben a tick minden ágába (mint, dunning, freeze, cancel) új kivételt kényszerítene — egy kifelejtett
  ág = számla egy ingyenes próbázónak.
- Az első valódi fizetés a meglévő úton születteti az előfizetést (`ensureSubscriptionForOrder`, anchor =
  a fizetés napja), és ugyanott `free_trial.status → converted`.

**Konvertálás** (`src/trial/start.ts` → `startTrial(token, {name, email, phone, aszfAccepted,
photoRightsAccepted, viewId?})`, végpont `POST /p/<token>/trial`): a fizetett út elemei — mock
jóváhagyása a látogató saját beküldésével, `convertLead`, live render (§A szűrő), site `live` az
aldomainen (ADR-0330 címke elsőként), belépő-levél a meglévő úton — fizetés, Barion, számla, saját domain
nélkül. **Idempotens szerkezetből:** `free_trial.lead_id UNIQUE`, a sort a provisioning ELŐTT foglalja;
párhuzamos második kérés `in_progress`, későbbi ismétlés ugyanazt a próbát adja (`existing:true`); félbe-
szakadt foglalást a következő beküldés folytat. Vásárolt/fizetett lead (`ownedSiteForLead`) → `already_owned`;
lejárt/konvertált próba → `trial_used`. Piac-kapu: a lead scrape-országa (ADR-0111).

**§A — egy mezővel több, indokkal:** a próba-oldal NYILVÁNOS és a demó-fotókat közli, ezért a fotó-jog
nyilatkozat ugyanúgy kell, mint a fizetett checkoutnál. `photoRightsAccepted` — a felület kötheti ugyanahhoz
a pipához, mint az ÁSZF-et, de a mellette álló szövegnek tartalmaznia kell a `PHOTO_RIGHTS_DECLARATION_V1`-et.
Mindkét szöveg szó szerint a `free_trial` sorra pecsételődik; a szerkesztő (`loadSiteForEdit`) innen is olvassa.

**Full funkció:** minden nem-kivezetett modul (a `multilang` is) `module_entitlement` aktív +
`trial_grant = true` (új oszlop). Fizetéskor a `syncEntitlementsToPaid` a megvett modulokról leveszi a jelet,
a többit (aktív és nem fizetett) kikapcsolja — a vevő által választott csomag marad.

**Kupon + ajánlat:** induláskor `offer(kind=coupon, scope=purchase, tenant_id)`, % a beállításból,
lejárat = `trial_until` + 90 nap; a tenant EGYETLEN kuponja (`offer_tenant_coupon_uq`) — a fizetéskori
üdvözlő kupon ütközéskor nem születik, nincs halmozódás. A prospect élő `initial` ajánlatai (outreach,
eszkaláció) a próba indulásakor lejárnak: a próba a kedvezmény HELYETT választható.
⚠️ A `scope=purchase` kupon ma a tenant-vásárlásokra (modul, egyszeri) vonatkozik; hogy a próba utáni
folytatás-fizetésre is, azt a folytatás-út (C SUB) köti be (`bestActiveCouponForTenant`).

**Paraméterek:** `app_setting 'free_trial'` JSON `{enabled, days, couponPercent}` (alap 14 / 25; napok
1–90, % 0–90 egész; 0% = nincs kupon; érvénytelen sor → alapérték) — `getFreeTrialConfig()` /
`setFreeTrialConfig()` (`src/trial/config.ts`).

**Mérés:** `mock_event type='trial_start'` a látogatáson (viewId, különben a legutóbbi); a forrás-igazság a
`free_trial.started_at`.

**Őr:** `scripts/free-trial-check.mts` (pre-commit, `EMAIL_PROVIDER=mock` kötelező; `--self-test` szabotázzsal).

**Visszafordíthatóság:** 🔄 additív (új tábla + oszlop); `enabled:false` → nem indul új próba.
🚪 kifelé tett ígéret: „kártya nélkül, a végén szünetel, nem terhelünk” — ÁSZF-pont kell (1.3 → 1.4 javaslat,
a tulajé).
