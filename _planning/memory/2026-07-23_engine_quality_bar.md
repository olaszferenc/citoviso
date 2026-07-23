# 2026-07-23 — Kompozíciós motor: kit-passzok + ÉLES minőség-korrekció (referencia-mérce)

## Mit csináltunk (ADR-0016 lezárás + ADR-0017 kit-passzok)
A kompozíciós motor (ADR-0016) végigépítve és éles-validálva, majd bővítve (ADR-0017):
- **Archetípus-réteg** (registry, `arrange()`) + **lead→SiteData mapping** (`siteData.ts`) +
  **generálás motorra kötve** (`generateEngine.ts`, perzisztálja a recept+SiteData-t az `inputs`-ba) +
  **`convertLead` motorra kötve** (a live = a perzisztált recept determinisztikus re-renderje, `mock=live`).
- **Motor = alapértelmezett generátor** a konzolban+CLI-ben (ADR-0017). A régi AI-HTML út fallback marad.
- **Kit-passzok:** SKIN 2→9 (korpuszból desztillálva) · PRIMITÍV-VARIÁNS (hero/features/gallery variánsok,
  recept `variant` mező) · ARCHETÍPUS 3→6. **⚠️ Runtime bugfix:** a `cit-modules.css` fallback `:root`-ja
  felülírta a skin-tokeneket → `@layer cit-fallback`-be került (a rétegtelen skin nyer).
- **Planner variáció-QA** (`engine-qa.ts`, 7 hangulat-fixture): a planner hangulat-helyesen varál
  (skin/archetípus/variáns). Éles-készenléti léc gépi része: skin 9≥8, archetípus 6≥5, designCheck zöld.

## ⚠️⚠️ A FŐ TANULSÁG (ADR-0018) — a minőség-rés
A desktop-screenshot megmutatta: a motor-kimenet **„template" szintű volt, messze a wow-mércétől.**
**Diagnózis:** vékony 4-primitíves vázat (hero/features/gallery/enquiry) építettem, és a kit-passzok
ennek a **kombinatorikáját** húzták fel — nem a **gazdag kézműves szekció-készletet**. Rossz tengely.

**A tulaj leadott 5 referencia-mockot → ELMENTVE a repóba MÉRCEként:**
`assets/design-refs/reference-quality/` (01-fullbleed-glass, 03-dark-luxury, 04-card-sidebar,
05-editorial, 06-immersive-parallax) + `README.md` = **kraft-standard ellenőrzőlista**. Ez a mérce;
minden motor-kimenetet EHHEZ hasonlítunk (screenshot: `scripts/engine-shot.ts <fájl> --width=1440`).

**Kraft-standard röviden:** immerzív 100svh hero (full-bleed kép + scrim + eyebrow + óriás display-cím
`clamp(40,7vw,78px)` + CTA) · szerif-display+sans body · prominens foglaló-sáv (üveg/dock/sticky-kártya) ·
gazdag szekciók (sticky nav, room-kártyák árral, amenity-rács, vélemény-sáv, GYIK, térkép, lábléc) ·
szekció-padding 90-110px · hover/reveal mikrointerakciók.

**Első javítás (KÉSZ):** immerzív hero + prominens érdeklődés-sáv + nagyvonalúbb ritmus/tipó a
`primitives.ts`-ben (hero default = `immersive`: fotóval kép-háttér+scrim, e nélkül tall typographic).
Screenshot: nagyságrendi ugrás (Sissi, dark-boutique). DE csak az 1. lépés.

## Következő (a mérce eléréséig)
1. sticky nav + gazdag lábléc + polírozott foglaló-sáv (a „keret");
2. gazdag szekció-modulok: amenity-rács · szoba-kártyák · vélemény-sáv · GYIK · térkép (05-MODULES).
**Tényhűség (§B.17):** a gazdag szekciók a MOCK-ban jelölt minta-állapottal tölthetők (ADR-0015 fázis-határ);
ÉLESRE csak valós adattal. A kraft (hero/tipó/nav/lábléc) adat-független → azonnal alkalmazható.

## Módosított/létrehozott fájlok (a mai ív)
- `src/engine/{archetypes,siteData,skins,primitives,render,planner,recipe}.ts` · `src/generator/{generate,
  generateEngine,run}.ts` · `src/console/{server,views}.ts` · `src/conversion/provision.ts` ·
  `assets/runtime/cit-modules.css` (@layer fix)
- `scripts/engine-{prove,plan,archetypes,from-lead,generate,convert,skins,archview,variants,qa,shot}.ts`
- `assets/design-refs/reference-quality/` (5 minta + README = MÉRCE) · `_planning/DECISIONS.md` (ADR-0017, 0018)
- Commitok: d27e76b · 7ed347c · 8e04ca2 · 024de90 · 4c89393 · b850944 · 1c9f0b9 (+ a mai hero-kraft + mentés)
- ⚠️ Push továbbra is deploy key-re vár (lokál).
