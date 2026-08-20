# 2026-08-20 — Automata nyelvi provisioning (ADR-0036) + doktrína-szintű kikényszerítés

## Kiváltó
Tulaj-kérdés: „működik a multilanguage? ha pl lengyel leadre?” → tényszerű válasz: NEM, minden
vevő-felület magyarul volt beégetve. Majd a tulaj iránya: **automatizáltan** — ha a scrape új
nyelvterületet érint, minden felület álljon elő magától az adott nyelven, „ne kelljen manuálisan
belenyúlogatni”. Végül: **doktrína-szintre** emelni, hogy minden jövőbeli felület eleve nyelvi
csomagot fogadjon; és tracking/deploy-check, mert fejlesztés közben a katalógus nő.

## Amit építettünk
- **ADR-0036 — a nyelv PARAMÉTER:** régió `country` → nyelv (`src/i18n/lang.ts`); nyelvi csomag =
  egyszeri AI-fordítás nyelvenként (`language_pack` tábla, migráció 0021), **a kulcs maga a magyar
  forrás-string** (nincs kitalált kulcs-nevezés); placeholder-őrzés + katalógus-fedettség guard.
  Trigger: scrape-indulás + mock-generálás (`ensureLanguagePack`). `SiteData.lang` perzisztált →
  mock=live. AI-szövegírók (brief/copywriter) cél-nyelvet kapnak. Sablonok `T(d,"…")`, kliens-widgetek
  `tr("…")` + `CIT_I18N`/manifest-injektálás. **§C ORSZÁG-KAPU:** nem-hu nyelvterületre outreach FLAG
  az ország JOGI csomagjának tulaj-jóváhagyásáig (mock/oldal/konfigurátor szabadon megy).
- **§B.18 DOKTRÍNA** (03-INVARIANTS) + **06-UI-CONTRACT C) nyelvi kontraktus** + CLAUDE.md kód-konvenció:
  vevő-felirat SOHA nem beégetett.
- **HÁRMAS KAPU:** (1) PostToolUse-hook `scripts/i18n-scan.mjs` (szerkesztéskor blokkol, exit 2),
  (2) versionált git **pre-commit** (`hooks/pre-commit`, `core.hooksPath=hooks`): i18n-lint +
  katalógus-frissesség + design-token-lint, (3) kézi `scripts/i18n-lint.mts`.
- **ADR-0036/b — tracking + deploy-kori self-heal:** `scripts/i18n-pack-status.mts` (lefedettség-riport,
  `--ensure` pótol); **boot-time** `ensureAllLanguagePacks()` mindkét szerveren → deploy+restart
  automatikusan feltölti az összes ismert csomagot a friss katalógusra.

## Bizonyítékok
- PL csomag legenerálva és többször feltöltve (207 → 215 → 225 → **292 string**), lengyel próba-render
  2 sablonon PASS (`lang="pl"`, Galeria/Opinie/„Przykład…”, CIT_I18N injektálva).
- **hu-regresszió 21/21 PASS** — magyarban bájtazonos (T/tr identitás).
- Negatív próba: szándékos beégetett felirat → a scan ÉS a pre-commit is elutasította.
- A kapu élesben is fogott: a `horizontal` sablon commitját elutasította elavult katalógusra.

## Nyitott / hátra
- Outreach-levél/SMS/privacy fordítása CSAK az országonkénti JOGI csomaggal együtt (lengyel opt-in!).
- Tenant-admin + belső konzol i18n: post-pilot (a doktrína rájuk is áll — új kód csak burkolva).
- Kompozíciós fallback (`primitives.ts`/`chrome.ts`) burkolása: ismert adósság.
- **⚠️ Változatlanul a legfontosabb (előző sessionből):** a purge előtti `live` site 6 `places`-fotóval
  ment ki (§A-sértés) — az OK kivizsgálása az első valódi go-live ELŐTT kötelező.

## Módosított/új fájlok (fő)
`src/i18n/{lang,packs,catalog.json}.ts`, `migrations/0021_language_pack.sql`,
`scripts/{extract-i18n,i18n-lint,i18n-pack-status}.mts`, `scripts/i18n-scan.mjs`, `hooks/pre-commit`,
`.claude/settings.json`, `src/engine/templateKit.ts` + 8 art-sablon, `assets/runtime/cit-{runtime,configurator}.js`,
`src/generator/{generateEngine,brief,configurator,runtime}.ts`, `src/engine/copywriter.ts`,
`src/outreach/{draft,outreachCheck,sendBatch}.ts`, `src/console/{server,scrapeJob}.ts`, `src/server/public.ts`,
`_planning/DOMAIN/{03-INVARIANTS,06-UI-CONTRACT}.md`, `CLAUDE.md`.
