# 2026-10-09 — Egy kupon mindenkinek (SUB G, ADR-XXXX)

**Elvégezve:** a közvetlen vevő üdvözlő kuponja és a próbázó kuponja EGY beállításból jön (`app_setting
'welcome_coupon'` {percent, days}, `src/payment/couponConfig.ts`); `/pricing` új „Kupon” szekció (% + nap),
a próba-blokk kupon-mezője megszűnt; a régi próba-% migrálódik (getter-fallback). Egy tenant = egy kupon
(`offer_tenant_coupon_uq`), egyszer, bármire. Szövegek átnézve, nem kellett változtatni. KB: console-pricing.

**Fájlok:** src/payment/couponConfig.ts (új), src/payment/offers.ts, src/trial/config.ts, src/trial/start.ts,
src/console/views.ts, src/console/server.ts, src/i18n/catalog.json, kb/entries/console-pricing/entry.hu.md,
scripts/free-trial-{config-,expiry-,retention-,}check.mts, _planning/decisions/ADR-XXXX.

**Nyitott:** a /pricing KB-képernyőkép (assets/hu/screen.png) nem frissült — a lap tetejét mutatja, a szekció nincs rajta.
