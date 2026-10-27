# 2026-10-27 — Fordítás API-hívással TILOS: csak Bábel (doktrína + kód)

**Forrás:** tulaj-brief `~/rc-briefs/b-bel-20261027-174040.md`: „Ha bábel a nyelvész felállt: doktrína szinten,
sőt kódszinten is ki kell venni, hogy a nyelvi fordításokat api hívásokkal oldjuk meg! TILOS! csak Bábel
előfizetői tokenjeivel lehet költeni fordításra!” ADR-0412 (`_planning/decisions/XXXX-forditas-api-hivassal-tilos-csak-babel.md`).
Alapja az aznap landolt ADR-0411 (Bábel + single-flight), annak A4 („a keze”) és B3 (plafon) pontját írja felül.

## Elvégzett munka
- **Kód — a gépi fordítás kivezetve:** `src/i18n/babel.ts` (nincs transzport/`babelCall`, csak ontológia-glosszárium-
  felület), `src/i18n/packs.ts` (`ensureLanguagePack` = a Bábel-mag alkalmazása single-flight alatt; gyors út: nincs
  alkalmazandó mag → nincs zár, nincs írás; `translateStrings`/`translateBatch` törölve), `src/i18n/kbPacks.ts`
  (súgó-mag `src/i18n/babel/kb/<lang>/<cikk>.json`, csak egyező `source_hash` + ép szerkezet), `src/tenant/multilangGenerate.ts`
  (honlap-mag `src/i18n/babel/sites/<site>/<lang>.json`, hiánynál `AwaitingBabelError`), `src/i18n/budget.ts` törölve, `src/i18n/spend.ts`
  főkönyv-írója törölve (a `public.ts` boot-címkéje miatt csonkként marad — a `public.ts` booking-kapuja a tiszta mainen piros volt), `src/config.ts` (plafon-env ki), boot-blokk (`console/server.ts`),
  `scripts/i18n-pack-status.mts`, `scripts/kb-translate.mts`, `scripts/kb-translation-coverage-check.mts` (javítási útmutató),
  `scripts/deploy-prod.sh` (GATE 5 kiváltója a `src/i18n/babel/` is; a bukás Bábelt nevezi).
- **Bábel eszköze:** `scripts/babel-pack.mts` + `glossary`, `kb-export`/`kb-import`, `site-export`/`site-import`.
- **Őrök:** új `scripts/no-api-translation-check.mts` (statikus, önteszttel, minden commitnál); `scripts/i18n-single-flight-check.mts`
  átírva (mag egyszer íródik 5 hívó / 3 folyamat mellett, a kérés nem vár, mag nélkül semmi nem íródik, a hiány hiány
  marad); `scripts/i18n-retry-check.mts` a placeholder-/névelő-szerződésre szűkítve (az újrapróbáló gépi fordító megszűnt).
- **Doktrína:** `CLAUDE.md` §4 i18n-pont, `_planning/DOMAIN/03-INVARIANTS.md` §B.18, `_planning/DOMAIN/00-GLOSSARY.md` (Bábel),
  ADR-0411 fejléc („részben felülírva”), `babel/charter/{CHARTER,RUNBOOK,ONTOLOGIA}.md`, `MEMORY.md` Tények és döntések.

## Mérés
- Élesen (olvasás, 2026-10-27): élő nyelvek `en`, `sl` — 5656/5656 felirat, KB 24/24; éles HEAD `8658ed58`.
- Dev: de/en/hr/it/pl/sk ~4270/5655, KB 8/24 (a dev boot-szinkron ki van kapcsolva).

## Nyitott
- Élesítés a tulaj engedélyével. Az első deploy, amelynek tartománya új feliratot hoz, a GATE 5-ön bukik, amíg Bábel
  le nem fordítja a deltát `en`-re és `sl`-re — ez szándékos (Bábel-sessiont kell indítani rá).
- Bábel még nem fut saját sessionként (nincs `~/babel/`); indítása a koordinátor/tulaj döntése.
- Fizetett többnyelvű honlap: a vevő Bábel munkájáig + egy deployig vár (ma 0 tenant); ha ez a kártya ígéretével ütközik, tulaj-döntés.
