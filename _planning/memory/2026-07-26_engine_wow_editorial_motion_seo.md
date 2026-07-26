# 2026-07-24/26 — A „wow" a MOTORON belül (ADR-0019) + éles bekötés + finomítás + SEO

## Mit csináltunk

### ADR-0019 — a plafon-döntés eldőlt: MOTOR-ÚT nyert, NINCS HIBRID
Az ADR-0018 nyitva hagyta: `A`=motor vs `B`=bespoke vs HIBRID. Elvégeztük a teherhordó kísérletet
UGYANARRA az adatra (`A'`=felokosított motor vs `B`=bespoke). Eredmény: **a bespoke előnye NEM
sablonozhatatlan varázslat**, hanem három forrásból jön, és mindhárom BEÉPÜL a motorba, a `mock=live`
feláldozása nélkül:
1. **Szerkesztőségi szöveg** (per-szekció márkahang + hero költői vezércíme).
2. **Strukturális ízlés** (editorial hero: a lead a H1, a név eyebrow-ba; aszimmetrikus showcase szobák).
3. **Mozgás** (lépcsőzött scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés).

A tulaj visszaigazolása: „wow" → „sokkal jobb". A HIBRID-et azért is elvetettük, mert a §I invariánst
sértené (lásd lent): a fizetés utáni downgrade tilos.

### §I ÚJ INVARIÁNS — Ígéret ⇔ Szállítás hűség (bait-and-switch tilalom)
`03-INVARIANTS.md §I` (+ auto-memória `invariant_no_bait_and_switch_delivery`): amit a leadnek MEGAJÁNLUNK
(outreach-mock), PONTOSAN azt kapja fizetés után. Az áteresztés a nulladik ponton ABSZOLÚT TILOS
(üzletileg öngyilkos + jogilag súlyos: Fttv./megtévesztő gyakorlat). A `mock=live` (egy motorból) ezt
konstrukció szerint garantálja. Külön a §B.17 tényhűségtől: *igaz tartalom + HŰ szállítás.*

### Implementáció (mind additív, mock=live-biztos, reduced-motion/no-JS-barát)
- `src/engine/recipe.ts` — `SectionCopy` (eyebrow/cím/akcent + hero-lead) a receptbe; `Faq` típus;
  `Stat.icon`; `SiteData` += `stats`/`faqs`/`geo`/`rating`.
- `src/engine/primitives.ts` — `heroEditorial` + `roomsShowcase` variánsok; `accentPhrase`/`sectionHead`;
  szerkesztőségi cím a features/gallery/rooms/reviews-hoz; `MOTION_CSS` (reveal/ken-burns/hover); hero
  háttér-réteg (`cit-hero-bg`) a ken-burnshöz; `faqSection` (natív `<details>` akkordeon); SVG-csillag a statban.
- `src/engine/copywriter.ts` (ÚJ) — grounded editorial copywriter, a motor 2. AI-lépése a planner után;
  §B.17-hű (számot CSAK valós tényből; vízió-alapú a fotókra).
- `src/engine/seo.ts` (ÚJ, §H) — meta description + fázis-tudatos robots (mock=noindex, live=index) +
  Open Graph/Twitter + Schema.org **LodgingBusiness JSON-LD** a valós adatból (név/cím/geo/telefon/rating).
- `assets/runtime/cit-runtime.js` — `autoReveal()` (auto-horgozás + `--cit-i` lépcsőzés) + `cit-in` aktiválás.
- `src/generator/generate.ts` — `resolveGatedPhotos` visszaadja a valós **ratinget** is (ugyanaz az A4-kapu).
- `src/generator/generateEngine.ts` — **ÉLES BEKÖTÉS:** copywriter-hívás + `enrichRecipe` (hero→editorial,
  rooms→showcase, copy rákötés, stats-beszúrás) + geo/rating a SiteData-ba. A copy a PERZISZTÁLT receptbe sül.

### Bizonyíték (éles-validált)
Valós scraper-leadek a kanonikus éles úton (`scripts/engine-generate.ts`): **Villa Oliver/Gödöllő** (4★/46),
**Villa Pátzay/Badacsony** (4,1★/57), **Rózsakő ház/Badacsony** (5★/12) — mind HIGH-match, valós Google-fotó+rating,
3 külön skin. Minden kapu zöld: `tsc` tiszta, dizájn-doktrína PASS, **`mock=live` round-trip AZONOS**
(a `convertLead` LIVE = a mock), a LIVE fázis robots=index + teljes JSON-LD (geo+rating).
Letölthető minták: `sites/_engine-proof/sample-*.html` (böngésző: `:4700`).

### Tanulság — a Fortuna-eset (A4 működik élesben)
A „Fortuna vendégház"-hoz a Places a *borozót* párosította (név-egyezés 0,17) → helyesen KÖZEPES sáv +
„kurátor-review ajánlott". A rating 4,8/301 a borozóé lehet → a rendszer NEM attribuál vakon. Ez a
[[project_a4_confidence_gap_contextual]] rés élő példája (kontextuális korroboráció még hátra).

## Commitok (ebben a menetben)
`8e351fa` §I invariáns · `fb4e669` editorial+mozgás · `12d46bf` éles bekötés · `2d2771b` finomítás+GYIK+SEO ·
`cf4304c` memória-zárás. ( + ez a fájl.)

## Nyitott / következő
- **A KÖVETKEZŐ SESSION ELSŐ TÉMÁJA (a tulaj kérése): a SEO CANONICAL + PROVISIONING terv átnézése FEJLESZTÉS ELŐTT.**
  Ma a `seo.ts` szándékosan KIHAGYJA a `<link rel=canonical>` + `og:url`-t, mert nincs élő domain mock-időben;
  ezt a provisioning-fázisban (a preview-token URL / a tenant élő domainje) kell injektálni. Terv-kérdések:
  canonical a preview-n vs. live-on, a domain forrása (site.preview_token vs. custom domain), a `<head>`-injektálás helye.
- Opcionális: hero-parallax · a proof-scriptek dedupe-olása a kanonikus `generateEngineMock` mögé.
- Kapcsolódó: [[project_reference_quality_bar]] · [[project_composition_engine]] · [[project_visibility_engine]] ·
  [[invariant_no_bait_and_switch_delivery]] · [[project_conversion_pilot_and_sales_visibility]].
