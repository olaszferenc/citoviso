# 2026-10-04 — Generátor-tényhűség: 3 hiba a Kerekerdő-újragenerálásból (SUB)

Brief: `~/rc-briefs/generator-tenyhuseg-3hiba-2026-10-04.md` (deploy-koordinátor, tulaj „2: igen”).

## Javítva (őrrel, piros-zöld önteszttel)
1. **Régió-fallback nem hely.** Mechanizmus (élesen olvasva): a konzol a DB-területeket csak a /scrape oldalon töltötte
   be (`loadRegions`); újraindítás után a beépített dobozok egyike sem fogta Hárskutat (47.183, 17.815 — élesen a
   `balaton-kelet` dobozában van), a `resolveRegion` fallbackje `badacsony, known=true`. Most: fallback mindig
   `known=false`; explicit kontextus-id csak a dobozán belüli leadre kezeskedik (tárolt `inputs.regionId`-ból a recopy
   sem támasztja fel); `getRegionContext(region)` nem kezeskedett régióra üres taglinet ad; `generateEngine` és
   `copySources` maga tölti a területeket. Őr: `region-phrase-drop-check` (29 zöld, önteszt 17 piros).
2. **„Saját parkoló” csak forrásból.** `DESCRIPTION_FACT_LABELS`: „parkol” → „Parkoló”, „saját parkol” → „Saját parkoló”.
   Őr: `description-fact-label-check` (új, bekötve).
3. **Elutasított kontakt nem kerül a vendég elé.** Élesen 17/1734 lead mostani e-mailje a főkönyvben elutasított
   (Rozé: `mpolgarmester@keszthely.hu`, Ferenc Vendégház: `info@keszthelyinfo.hu`). DE a Kerekerdő `kuci01@axelero.hu`
   ISP-postafiók (volt Matáv), az osztályozó hiányos FREEMAIL-listája ítélte „idegen domain”-nek. Most:
   `contactLedger.guestVisibleContact` (e-mail + telefon), FREEMAIL a tiszta `contactLedger.ts`-ben, bővítve
   (axelero, t-email, gmx, web.de, digikabel, chello); „idegen domain” ítéletet freemail-re a mai lista újraítél →
   a Kerekerdő címe kint marad. Őr: `guest-contact-check` (12 zöld, önteszt 10 piros).

## Nyitott (a koordinátornál)
- **„Panoráma”/„kilátás” címke** kontextus nélkül (Kerekerdő: a Papod-kilátó panorámája lett a ház panorámája) — tulaj-döntés.
- **Mellékes szöveghibák** (tűzrakó + ösvények összekötése, „Bakony határában”, „Erdei ösvények” galéria-cím) — nem javítva.
- Az outreach is a `raw.email`-t használja-e elutasított kontaktnál — nem vizsgálva.
- `brief.ts:97` prompt-példa „JÓ: … Saját parkoló” — a modell másolja a példát (ADR-0317), nem javítva.
- §2b felület-kapu kivételt (`siteData.ts`, hibajavítás) MAGAMNAK adtam meg — a tulaj utólagos jóváhagyása kell.

## Módosított fájlok
`src/generator/{generate,generateEngine,copySources,marketCheck}.ts`, `src/engine/siteData.ts`,
`src/scraper/{contactLedger,enrichWebSearch}.ts`, `scripts/{region-phrase-drop-check,guest-contact-check,description-fact-label-check}.mts`,
`scripts/engine-from-lead-plus.ts`, `hooks/pre-commit`.

## Deploy után esedékes
Kerekerdő mock újragenerálása élesen (külön tulaj-engedéllyel, a koordinátor kéri). Élesítés nem történt.
