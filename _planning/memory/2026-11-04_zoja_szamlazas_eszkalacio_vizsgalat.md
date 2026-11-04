# 2026-11-04 — Zója Apartmanház: számlázási kilépés és eszkaláció vizsgálata

**Kérés (tulaj):** Zója kétszer eljutott a számlázásig, cégként, de kilépett — rendben van-e a felület? Az admin eszkaláció 2 napra állítása után kapott-e Zója további kedvezmény-levelet?

**Mérés (éles DB, csak olvasás):**
- Zója (prospect `380c4d69…`): 2 látogatás (10-29, 11-02, asztali Windows Chrome). Nincs `client_error`, nincs `billing_invalid`, nincs `order_intent` — fizetést sosem nyomott. 11-02: cég-típus választás után 7 mp-cel bezárta a panelt.
- `app_setting.escalation_offer`: enabled, küszöb 2 külön nap, 30%, 72 h (módosítva 11-03 19:42). Zójának csak az `outreach` 25% ajánlata van, eszkalációs nincs, emlékeztető sem ment.
- Ok: `ensureEscalationOffer` csak oldal-megnyitáskor mint, visszamenőleg nem. Zójának nincs e-mail címe (MMS-lead), így emlékeztető-levelet akkor sem kapna.
- `scripts/billing-checkout-check.mts`: 38/38 zöld; az éles számlázó kód a látogatás óta azonos (csak `invoiceMirror.ts` új, fizetés utáni).

**Módosított fájlok:** `MEMORY.md`, ez a jegyzet. Kód nem változott, élesen nincs teendő.

**Nyitott javaslatok (a tulaj kérésére):**
- Barbara Wellness Panzió 11-02: `client_error` „Cannot read properties of undefined (reading 'M_ID')” — kivizsgálható.
- Küszöb-változtatáskor visszamenőleges eszkalációs ajánlat-kiosztás — kódváltozás lenne.
