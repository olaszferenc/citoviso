## ADR-0346 — Egy kupon mindenkinek: aki admin-hozzáférést kap (első fizetés VAGY próba), egyet kap, egyszer, bármire

**Dátum:** 2026-10-09 · **Státusz:** ELFOGADVA (tulaj-döntés 2026-10-09, szó szerint: „aki belép az adminfelületre,
annak jár az egyszerű huszonöt százalék … annak, aki próbaverziót kér, úgy jár a huszonöt százalék, hogy bármire,
amit egyszer vesz.”) · **Kapcsolódó:** ADR-0088 (§6 üdvözlő kupon, ⑥ nem halmozódik), ADR-0285 (app_setting-minta,
/pricing mezőpár), ADR-0342 (próba-kupon), ADR-0344 (folytatás a tenant kuponjával, ⑤ kupon egyszer).

**Kérdés:** a közvetlen vevő fix konstanssal (25%, 90 nap) kapta a kupont, a próbázó a `/pricing` próba-blokkjának
külön %-mezőjével. Két szabály, két szám egyetlen ígéretre.

### Döntés

1. **EGY kupon-szabály, EGY beállítás:** `app_setting 'welcome_coupon'` JSON `{percent, days}` (alap 25 / 90;
   % 0–90 egész, 0 = nincs kupon senkinek; nap 1–365 egész; érvénytelen sor → alapérték) —
   `getCouponConfig()` / `setCouponConfig()` (`src/payment/couponConfig.ts`). Ebből ver MINDKÉT út:
   - közvetlen vevő: `grantNewSubscriberCouponForOrder` az első fizetéskor, lejárat = fizetés + `days`;
   - próbázó: `startTrial` a próba indulásakor, lejárat = a próba utolsó napja + `days`
     (a próba alatt a kupon nem költhető el — a modulok ingyen aktívak, modul-vásárláshoz előfizetés kell —, ezért
     a próbázónál az érvényesség a próba végétől számít).
   A `NEW_SUBSCRIBER_COUPON_PERCENT/DAYS` konstans megszűnt; a `FreeTrialConfig`-ból a `couponPercent` kikerült.
2. **Egy tenant = egy kupon, egyszer, bármire** — szerkezetből, a meglévő `offer_tenant_coupon_uq`-val: amelyik út
   előbb ver, az a fiók egyetlen kuponja; a másik ütközéskor no-op (felhasznált vagy lejárt kupon mellé sem születik
   új). `scope=purchase` → a próbázónál a folytatás-fizetésre (`/p/<t>/folytatas`, ADR-0344 ④) VAGY egy modulra,
   amelyik előbb jön; ott ég el (`redeemOfferForOrder`). Második kupon nincs (a tulaj kifejezetten így kérte).
3. **`/pricing`: új „Kupon” szekció** az „Ingyenes próba” alatt (ADR-0285 mezőpár, kapcsoló nélkül — a 0% a „ki”):
   „Kedvezmény” (%) + „Érvényesség” (nap), előnézet-mondat, és a kint lévő fel nem használt kuponok száma
   (`liveTenantCoupons`) — a kiadott kupon megtartja a saját %-át és lejáratát. Jelenlét-jelölő `coupon_present`;
   a POST MINDEN írás előtt ellenőrzi (`couponConfigErrors`), hibás értéknél semmit nem ment. A próba-blokk külön
   kupon-mezője megszűnt; az előnézete a „Kupon” szekcióra mutat.
4. **A tárolt ADR-0342 érték migrálása (nem vész el csendben):** amíg nincs `welcome_coupon` sor, a getter a régi
   `free_trial.couponPercent`-et olvassa (`legacyTrialCouponPercent`), ha érvényes — különben 25. A következő
   `/pricing` mentés kiírja az új sort (a szekció mindig az űrlapon van), és a próba-mentés a régi mezőt már nem írja
   vissza. Egy régi, nyitva hagyott fül (kupon-szekció nélkül) próba-mentésénél a POST az ÉRVÉNYES kupont menti
   előbb, így a régi mező eldobása sem visz el semmit. Mérve 2026-10-09: sem a dev, sem az éles DB-ben nincs
   tárolt `free_trial` sor — a migráció ma üres, de a szabály áll.
   ⚠️ Következmény: a közvetlen vevő %-a mostantól operátor-állítható (eddig fix 25) — szándékos, ez az egy szabály.
5. **Szövegek:** átnézve — a próbás belépő-levél, a T−3/T−1 levél és SMS, az admin próba-sáv egyetlen kupont
   neveznek meg („a próbához kapott kedvezmény”, % + dátum az `offer` sorból), második kupont semmi nem ígér
   (a checkout/konfigurátor nem ígér fizetés utáni kupont). A Modulok bolt kupon-kártyája az előfizetés-adatból
   (`getSubscriptionAdmin`) jön, ami próbázónak null → próba alatt nem jelenik meg; a folytatás-fizetés a kupont
   elhasználja, így utána sem. Szöveg-változás ezért nem kellett (a kötött „Az induló előfizetéséért kapta.”
   felirat érintetlen).

### Őr
- `scripts/free-trial-config-check.mts`: ① kupon-határok; ② `couponFromForm` (régi fül → null, normalizálás,
  elutasítás; a régi fül `trial_coupon` mezője nem számít); ③ a kupon-ellenőrzés minden írás előtt, a kupon a próba
  ELŐTT íródik; ④ a próba-szekcióban nincs kupon-mező, a „Kupon” szekció a tárolt értékekkel + a kint lévők száma;
  ⑦ mindkét verő út a `getCouponConfig()`-ot olvassa, rögzített konstans nincs; migráció-parser.
- `scripts/free-trial-check.mts`: a próba-kupon a közös beállítás %-a, lejárata = próba vége + a beállítás napjai.
- `scripts/free-trial-expiry-check.mts`: a folytatás után a kupon %-a a beállításé, és a fizetéskori üdvözlő kupon
  újrafuttatva sem ver másodikat (egy tenant = egy kupon).

**Visszafordíthatóság:** 🔄 egy app_setting sor; a 0% kikapcsolja mindkét utat. A már kiadott kuponok érintetlenek.
