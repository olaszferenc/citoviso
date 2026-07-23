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

## Amit a mai session VÉGÉIG megcsináltunk (kraft-passzok)
- **① keret:** sticky nav + gazdag lábléc (`chrome.ts`).
- **② gazdagítás:** amenity-rács SVG-ikonokkal (`icons.ts`, doktrína: ikon=SVG) · szoba + vélemény
  minta-modulok **§B.17 fázis-kapuval** (mock: jelölt minta; live: valós adat híján KIESIK —
  `renderSite(recipe,data,{phase})`, `convertLead` phase:"live"; bizonyítva `engine-convert.ts`).
- **max-craft:** szoba-kártyák KÉP-VEZÉRELTEK + `stats` modul (csak valós adat) + accent-szó a címekben.
  `scripts/engine-max.ts` (sűrű, teljes adat) → **~80% Silva-szint, NEM gagyi.**

## ⚠️ NYITOTT STRATÉGIAI DÖNTÉS (innen folytatjuk a következő sessionben)
A tulaj szerint a motor-kimenet még mindig „gagyibb" a referencia-mintáknál. Plafon-bizonyítékot
csináltunk (A vs B), UGYANARRA az adatra (Silvana):
- **A = motor** (`sites/_engine-proof/max-craft.html`): ~80% Silva, `mock=live` + szerkeszthető + skála.
- **B = bespoke AI-HTML** (`sites/_engine-proof/bespoke-mock.html`, `scripts/bespoke-mock.ts` — egy
  Claude-futás egész oldalt ad): igényesebb (egyedi szekció-címek, GYIK, változatosabb, oldalanként
  egyedi), DE nem `mock=live` / nem szerkeszthető / minden oldal külön AI-futás.
- **HIBRID (javaslatom):** a hideg outreach-MOCK bespoke AI-HTML (max wow → konvertál), élesítéskor
  a tulaj a MOTOR szerkeszthető verzióját kapja. Mock ≠ live, de a mock feladata a konverzió.
- **⚠️ Fontos tény:** a referencia-minták (és B) IS tele vannak FABRIKÁLT adattal (ár/vélemény/stat) →
  a §B.17-kérdés MINDKÉT útra vonatkozik. A max-craft „gazdag" nézete is teljesen feltöltött adaton áll;
  hideg leadnél (Sissi) ez nincs → a wow jelölt-mintát igényel akárhogy is.
- **A DÖNTÉS a következő session ELSŐ lépése.** Előtte: nyisd meg a két fájlt (:4700/max-craft.html vs
  :4700/bespoke-mock.html) és döntsd el: A / B / HIBRID. Utána a többi (GYIK, térkép, bespoke szekció-
  variánsok, vagy a bespoke-mock pipeline) ehhez igazodik.

## Eszközök (böngészhető nézetek, :4700 statikus szerver a `sites/_engine-proof`-on)
`scripts/engine-shot.ts <fájl> --width=1440` (desktop screenshot) · `engine-qa.ts` (7 hangulat) ·
`engine-skins.ts` (9 skin) · `engine-archview.ts` (6 archetípus) · `engine-max.ts` · `bespoke-mock.ts`.

## Módosított/létrehozott fájlok (a mai ív)
- `src/engine/{archetypes,siteData,skins,primitives,render,planner,recipe}.ts` · `src/generator/{generate,
  generateEngine,run}.ts` · `src/console/{server,views}.ts` · `src/conversion/provision.ts` ·
  `assets/runtime/cit-modules.css` (@layer fix)
- `scripts/engine-{prove,plan,archetypes,from-lead,generate,convert,skins,archview,variants,qa,shot}.ts`
- `assets/design-refs/reference-quality/` (5 minta + README = MÉRCE) · `_planning/DECISIONS.md` (ADR-0017, 0018)
- Commitok: d27e76b · 7ed347c · 8e04ca2 · 024de90 · 4c89393 · b850944 · 1c9f0b9 (+ a mai hero-kraft + mentés)
- ⚠️ Push továbbra is deploy key-re vár (lokál).
