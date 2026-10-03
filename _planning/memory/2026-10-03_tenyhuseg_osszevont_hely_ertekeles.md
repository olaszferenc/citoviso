# 2026-10-03 — Tényhűség: összevont hely-állítás + a Google-értékelés egy szabállyal

**Szál:** SUB (brief `~/rc-briefs/fix-tenyhuseg-szoveg-ertekeles.md`), a 2026-10-02-i Séta / Kapunyitás SUB tényhűség-őr FLAG-jeiből. Döntés: ADR-XXXX.

## Elvégezve
- **A) Összevont hely-állítás** („két külön tény egy mondattá kötve új állítássá”): `guestCritic.ts` `placedClaims` / `lintPlacedClaim` — szolgáltatás
  vagy létesítmény + helyhatározó csak viszonyt mondó forrás-egységgel; a „kerttel / kertes / kertre néző / teraszos / with a garden” nem viszony.
  Ugyanez a generátor-kapuban: `factCheck.ts` `placedClaimsOnPage` (blokkonként, minta nélkül, kulcs nélkül és verifier-hibánál is FLAG).
  A `recopy` kapuja megkapja a vélemény-idézeteket. Promptok: szövegíró (a „Saját parkoló az udvarban” / „Kerti grillezés lehetősége”
  JÓ-példa ki), kritikus, tényhűség-verifier (az editorial-prompt felület-kapus fájl, nem változott).
- **B) Értékelés:** `scraper/confidence.ts` `ratingAttributable` (≥ 0,7) — `generate.ts` `attributedRating` és `reviews/placeRating.ts` is ezt hívja.
  A kurátor fotó-panelje a párosítás számát továbbra is látja (`matchRating`).
- Őrök: `scripts/placed-claim-check.mts`, `scripts/rating-attribution-check.mts` (pre-commit, önteszttel — a régi szabályon pirosak).
- §B.17 (03-INVARIANTS) kiegészítve: tiltott kimenet (5), és a 7. pont az egy függvényre mutat.

## Mérés
- 172 tárolt mock: szövegben 45 mock / 11 lead / 58 előfordulás (parkoló@udvar 37 — a prompt-példa másolata; az Alig-vár Tanyánál és a
  Lagunánál parkoló-forrás sincs), a renderelt lapon 46 mock / 62. A 165 értékelést hordozó mockból 60 (6 lead) 0,7 alatti párosításon.
- Valódi kritikus-kör (AI, Places nélkül, két hurok): Három Huszár „Kontinentális reggeli a kertben” → „Kontinentális reggeli”; Lidó
  „Uszoda … a helyszínen” kiesik, az író „a villában”-ra cserélte → felvéve a szabályba.

## Módosított fájlok
`src/generator/guestCritic.ts`, `src/generator/factCheck.ts`, `src/generator/brief.ts`, `src/generator/recopy.ts`,
`src/generator/generate.ts`, `src/scraper/confidence.ts`, `src/reviews/placeRating.ts`, `src/console/server.ts`, `src/outreach/draft.ts` (komment),
`scripts/placed-claim-check.mts`, `scripts/rating-attribution-check.mts`, `hooks/pre-commit`, `_planning/DOMAIN/03-INVARIANTS.md`, az ADR, `MEMORY.md`.

## Nyitott
- A tárolt mockok újrageneráláskor kapják meg (fizetős AI; tömegesen nem futtattuk). A kiajánlott mock fagyott (§I).
- A portál lapos „Szolgáltatások” listája (balaton.hu) a környék kínálatát a házéval keveri — hogy az „Uszoda” a házé-e, scraper-kérdés.
- A Három Huszár Séta-szövegen egy meglévő ai_sablon-lelet marad („várják a kicsiket”) — nem ennek a szabálynak a tárgya.
