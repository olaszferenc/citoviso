# 2026-10-07 — Fordítás API-költség: dev boot-fordítás KI + mérő (translation_spend)

**Kiváltó.** A dev és az éles ugyanazt az `ANTHROPIC_API_KEY`-t használja (10-07: 125 € utántöltés). A két dev
szerver (`tsx watch`) minden land utáni újraindításkor lefuttatta az `ensureAllLanguagePacks()`-et (ADR-0036/b
boot-önjavítás) — 6 nyelv, UI-stringek + teljes súgó-cikkek opus-szal, duplán, mérés nélkül (becslés 8–10 $/nap).

**Elvégezve.**
- `I18N_BOOT_TOPUP` kapcsoló (`src/config.ts`, alap `1`): `0` mellett a konzol és a publikus szerver boot-kor
  csak MÉR (`packCoverage`, olvasás), API-hívás nélkül. Dev `.env` (fő fa): `I18N_BOOT_TOPUP=0`. Élesen változatlan.
- Mérő: migráció `0092_translation_spend.sql` + `src/i18n/spend.ts` — minden UI-csomag- és KB-fordítási hívás
  egy sor (gép, folyamat, kiváltó `boot`/`cli`/`on-demand`, nyelv, token, USD; árazatlan modell = NULL).
  A `recordAiUsage` mock-futáson kívül no-op volt, ezért a fordítás költsége eddig sehol nem látszott.
  Lekérdezés: `select date(at), host, trigger, sum(cost_usd) from translation_spend group by 1,2,3 order by 1 desc;`
- Terv a tulajnak (koordinátoron át): `_planning/proposals/forditas-csak-elesiteskor-20261007.md` —
  javaslat: fordító munkatárs + a fordítás verziózott fájlként a repóban; a deploy GATE 5 import-módban;
  az (a) API-út vészkapcsolóként.

**Felismerés.** A diff-alapú deploy-fordítás (a) MÁR LÉTEZIK: `deploy-prod.sh` GATE 5 (ADR-0207) tartomány-
szűkített, és csak a hiányt/elavultat fordítja. A pénz a dev boot-on és a közös dev-DB fák közti
újrafordításán ment el. Egy tipikus deploy fordítása ≈ 1–3 $.

**Módosított fájlok.** `src/config.ts`, `src/console/server.ts`, `src/server/public.ts`, `src/db/schema.ts`,
`src/i18n/packs.ts`, `src/i18n/kbPacks.ts`, `src/i18n/spend.ts` (új), `migrations/0092_translation_spend.sql` (új),
`scripts/i18n-pack-status.mts`, `_planning/proposals/forditas-csak-elesiteskor-20261007.md` (új);
fán kívül: a fő fa `.env`-je (`I18N_BOOT_TOPUP=0`).

**Nyitott.** Tulaj-döntés (a) vs (b); a prod boot-háló kikapcsolása (`I18N_BOOT_TOPUP=0` élesen) a nagy
deployjal; a 0092 migráció és a mérő a nagy deployjal megy ki (élesen addig nincs fordítás-mérés).
