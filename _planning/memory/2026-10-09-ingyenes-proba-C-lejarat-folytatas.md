# 2026-10-09 — Ingyenes próba, SUB C: lejárat (szünetel), T−3/T−1 figyelmeztetés, folytatás-fizetés

Koordinátor: `f3e80964`. Három session egy fában (`~/wt/cit1bd25926`), két átadással. Döntés: ADR-0344
(`_planning/decisions/…-ingyenes-proba-lejarat-figyelmeztetes-folytatas.md`). Élesre semmi (nagy deploy).

## Elvégezve
- **Lejárat** `lapseExpiredTrials` (napi billing-tick): `lapsed`, site `suspended` (meglévő 503-as freeze-lap),
  `trial_grant` modulok le, fizetett marad; `isSubscriptionFrozen` subscription nélkül a lejárt próbát fagyottnak látja.
- **Figyelmeztetés** `runTrialNotices`: T−3/T−1, hétköznap 9–16, hétvége → péntek, ütközés → csak T−1, foglalás
  a küldés előtt (`free_trial_notice`, migráció 0098). Az óránkénti `scripts/offer-followup.mts` futtatja, **SZÁRAZON**
  (naplóz, nem küld, nem foglal), amíg a tulaj a szöveget jóvá nem hagyja.
- **Folytatás:** `continuableTrialForLead` / `ownedBlocksInitialPurchase` a három vásárlási kapuban; az árat a
  tenant-kupon adja; a `/p/<token>/folytatas` GET = konfigurátor a próba-kuponnal (keretező szöveg nélkül).
  A fizetés utáni út a meglévő `activate()` (fordulónap = a fizetés napja, kupon egyszer).
- **Őr** `scripts/free-trial-expiry-check.mts` (pre-commit, `--self-test`).
- **§2b mock** `assets/design-refs/_drafts/proba-C/proba-C.html` + PNG-k (mobil/asztali): (a) admin próba-sáv
  A „sáv minden fülön” / B „kártya + jelvény”, állapotok 10/3/1/ma/lejárt + szimulált fizetés; (b) T−3/T−1 levél a
  VALÓDI `platformMail` keretben; (c) SMS linkkel/link nélkül, ékezetes/ékezet nélkül, élő GSM-7/UCS-2 számlálóval;
  (d) próbás belépő-levél. Nincs bekötve.

## Mért tények
- SMS: ékezetes szöveg (á, ó) → UCS-2, 70/67 kar./szelet: a linkes T−3 176 kar. = 3 szelet; ékezet nélkül 2;
  link nélkül, ékezet nélkül 1 szelet. A prospect-token 24 karakteres → a link ~57 karakter.
- A fizetés után a belépő-levél NEM megy újra (csak a számla) — a próba indulásakor már kiment.

## Nyitott (tulaj)
- A mock döntései (A/B sáv, SMS-változat, levélszövegek).
- Meddig marad meg a lejárt próba adata (ma semmi nem törli).
- A platform-levél lábléce („…rendelte meg”) próbánál pontatlan.
- A lejárat a napi 07:00-s tickkel fut (≤ ~1 nap késés a `trial_until` után).
- ÁSZF 1.4 (a tulajé).

## Fájlok
`src/trial/expiry.ts` · `scripts/billing-cycle.ts` · `scripts/offer-followup.mts` · `src/conversion/owned.ts` ·
`src/payment/service.ts` · `src/payment/payEntry.ts` · `src/payment/subscription.ts` · `src/console/server.ts` ·
`src/db/schema.ts` · `migrations/0098_free_trial_notice.sql` · `scripts/free-trial-expiry-check.mts` · `hooks/pre-commit`
