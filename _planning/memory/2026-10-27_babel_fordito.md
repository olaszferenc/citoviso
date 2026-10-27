# 2026-10-27 — Bábel, a fordító munkatárs + a nyelvi csomag egy-futás/plafon javítása

**Forrás:** OF-brief `~/rc-briefs/babel-fordito-20261027.md` (Ferenc kérése az OF sessionön át). ADR-XXXX.

## Elvégzett munka
- **Hibajavítás (az éles `sl`-eset, $130/óra):** `ensureLanguagePack` nyelvenként egy futás (közös ígéret
  + Postgres advisory lock, a várakozó a lock mögé áll és a DB-ből olvas); `requestLanguagePack` háttér-indítás;
  `prepareRenderLang` a konzol-operátor betöltésében, a `/operator/lang`-ban és a tenant admin / login /
  felfüggesztett-oldal renderben; konzol „készül” sáv (`packNotice`); scrape-indítás: fordítás a „már fut”
  kapu mögött; napi/futásonkénti plafon (`src/i18n/budget.ts`, env `TRANSLATION_DAILY_CAP_USD`=25,
  `TRANSLATION_RUN_CAP_USD`=12) minden hívás előtt, ⛔⛔ + alertHouse (SMS) naponta egyszer.
- **Bábel motor** (`src/i18n/babel.ts`): ontológia + glosszárium + feladat-szerződés egy cache-jelölt
  rendszerblokkban; felület-kontextus soronként (`catalog-context.json`, az extract-i18n írja); sorszám-kulcsos
  válasz; a UI-csomag, a súgó és a többnyelvűség-modul honlap-fordítása mind `babelCall`-on át.
- **Bábel mag** (`src/i18n/babel/packs/<lang>.json`) — a deploy `--ensure` alkalmazza, felülír.
- **Bábel perszóna:** `babel/charter/CHARTER.md`, `ONTOLOGIA.md`, `RUNBOOK.md`; munkaeszköz
  `scripts/babel-pack.mts` (export / import --seed|--apply / audit).
- **Őr:** `scripts/i18n-single-flight-check.mts` (pre-commit, diff-scope-olt) — 5 hívó + 3 folyamat → minden
  string egyszer; a kérés-út <50 ms; plafonnál 0 hívás; a mag elsőbbsége; statikus bekötés.

## Mérések
- Élesen (translation_spend, 1 nap): translateUiBatch 1940 hívás, átlag 1273 be / 1877 ki token, $103,37;
  translateKbEntry 212 hívás, 4552 / 4131 token, $26,72.
- Dev-csomagok: en „Elérhetőség” → „Availability” (helyesen Contact); több önálló felirat (Csomag, Modul,
  Élesítés, Ellátás, Kupon) minden nyelven üres.
- `babel-pack audit en`: 354 átnézendő sor (lista, nem ítélet) — Bábel első feladata.

## Módosított / új fájlok
src/i18n/{babel.ts,budget.ts,packs.ts,kbPacks.ts,mail.ts,catalog.json,catalog-context.json},
src/i18n/babel/{ontology.md,glossary.json}, src/config.ts, src/auth/operatorAuth.ts,
src/console/{server.ts,scrapeJob.ts,views.ts}, src/server/public.ts, src/tenant/multilangGenerate.ts,
scripts/{extract-i18n.mts,babel-pack.mts,i18n-single-flight-check.mts}, hooks/pre-commit,
babel/charter/{CHARTER.md,ONTOLOGIA.md,RUNBOOK.md}, _planning/decisions/XXXX-babel-….md,
_planning/DOMAIN/00-GLOSSARY.md, MEMORY.md.

## Nyitott
- Élesítés: tulaj-engedéllyel (deploy). Utána a deploy `--ensure` a 2 új konzol-feliratot nyelvenként
  lefordítja (centek).
- Bábel saját RC-sessionje és (ha kell) `babel` konzol-fiókja: a tulaj döntése.
- Bábel első munkája: glosszárium-audit a meglévő csomagokon (en, de, sk, hr, it, pl, sl), a hibás sorok a magba.
