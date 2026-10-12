# 2026-10-11 — JSON az inline `<script>`-ben: közös `jsonForScript()` + őr (ADR-0365)

SUB az Elek-teszt koordinátornak (`cit333dea6d`), fa `~/wt/cit90a04c3b`. Brief: `~/rc-briefs/json-for-script-xss-20261011.md`.

## Elvégezve
- `src/text/jsonForScript.ts` — `<` `>` `&` `'` U+2028/2029 escape, értéktartó.
- Minden szerver-oldali inline `<script>`-be írt JSON erre átállítva (~100 hely, 18 fájl): `src/console/views.ts`
  (lead-térkép `LEADS`/`AREAS`, kereső-index, ikonok, fordítások, `onclick='citEditArea(…)'`), `src/server/adminViews.ts`,
  `bookingViews.ts` (az ADR-0363 javítása is), `contactViews.ts`, `moduleConfigViews.ts`, `offerViews.ts`, `consent.ts`,
  `modulePreview.ts`, `src/console/testLogViews.ts`, `pricingPage.ts`, `scoutViews.ts`, `curatorViews.ts`,
  `copyEditViews.ts`, `src/tenant/zonePicker.ts`, `src/engine/seo.ts` (JSON-LD), `src/engine/motion.ts` (intro-képlista,
  generált oldal), `src/generator/runtime.ts` (`CIT_I18N`), `src/generator/configurator.ts` (manifest a lead nevével +
  `CIT_PAY_BANNER`).
- `jsStr` (views.ts) `<`, CR, U+2028/2029 escape-pel bővítve.
- Őr `scripts/json-for-script-check.mts` (`--static` ~4 mp bármely `src/*.ts`-re; teljes ~45 mp a lead-térkép útjára),
  bekötve `hooks/pre-commit`. Önteszt a javítás előtti fán: statikus 99 lelet, a lead-térképen a payload 2× lefutott.

## Mérés
- Konzol lead-térkép régi kóddal: a `</script><img onerror>` nevű lead LEFUTOTT → valódi XSS (scrape-elt névvel elérhető).
- Éles (olvasás): 8 995 lead, 0 név / 0 cím `<`-gel, 0 `</script`; 225 névben `>&'"` valamelyike.

## Nyitott
- AI-mock útvonal (`src/generator/generate.ts`): modell-HTML szűrés nélkül → prompt-injekcióval szkript a mockba (koordinátornak jelezve).
- Kliens-oldali `innerHTML` + `p.url` (views.ts, fotó-lista) — csak az URL-normalizálás védi.
- Élesítés: csak a nagy deployjal.
