# MEMORY — Citoviso
Utolsó frissítés: 2026-07-13

## Aktív feladat
**ÉPÍTÉS — MOCK-MOTOR kész és éles-validált (ADR-0009/0010/0011) + runtime-modulok bővítve.**
A generátor-lánc működik end-to-end, konzolból is. Következő logikus szeletek: (a) korpusz-bővítés
(luxus csak 1 db; tierenként több archetípus), (b) hibrid vélemény-adatréteg (`_planning/memory/project_hybrid_review_model`),
(c) Brave presence-tail — DE csak amikor a kurátor is automata (időzítés-döntés a presence-memóriában).
**KÉSZ (2026-07-13):** a túlméretezett-szekció „lágy airiness" csiszolás — ADR-0012 (prompt-budget + render-mért QA-gate), éles A/B-vel validálva.
**ÚJ SZÁL (2026-07-12):** DOMAIN-horgonyzott ŐR-AGENT réteg (fix identitású, esemény-triggerelt verifierek) — 3 kapu él.

### 2026-07-12 — Őr-agent réteg + ontológia-megszilárdítás (3 guardian-kapu)
- **Koncepció:** nem mesterség-szerinti (frontend/backend) agentek, hanem a projekt INVARIÁNSAIRA horgonyzott
  esemény-triggerelt VERIFIEREK (őrök) — a doktrínát a gép tartja be, nem az én figyelmem. Minta:
  **kontraktus (DOMAIN-invariáns élesítve) → subagent (`.claude/agents/`) → runtime-kapu (ahol van felület) → dev-hook.**
- **Ontológia átvezetve** (`_inbox/20260712` distill-review): 00-GLOSSARY Architektúra-fogalmak (Control/Data plane,
  Iparág×Ország, Site-képlet, hibrid render); 02-ENTITY-MAP iparág-agnosztikus 6-entitásos közös mag (Property→történeti);
  03-INVARIANTS új §G (izoláció/jog/ember-a-hurokban), §H (SEO/lokalizáció). Commit `cef6736`.
- **1. őr — TÉNYHŰSÉG (2 réteg, commit `4d26165`):** §B.17 enforce-olható kontraktussá élesítve. Runtime-kapu
  `src/generator/factCheck.ts` (determinisztikus előszűrő + LLM-verifier, AI-mockra MINDIG fut) bekötve `generate.ts`-be;
  dev-hook `scripts/factcheck-scan.mjs` + `.claude/settings.json` (PostToolUse, minden `mock-*.html`). FLAG→kurátor-sor (§G.20).
  Ugyanebben a commitban az ADR-0012 airiness QA-gate is (generate.ts-ben összefonódott) — lásd lentebb, KÉSZ.

### 2026-07-13 — Levegősség-kontroll (ADR-0012): prompt-budget + render-mért QA-gate
- **Rés:** a reveal-fix után maradt „lágy airiness" — a mockok mobil átlaga ~20% HOLT függőleges sáv
  (szekció-magasság − a tartalom valós kiterjedése). 3 ok: nem-skálázódó mobil-padding, kitöltetlen
  nem-hero `min-height`/`vh`, túl nagy belső al-blokk-rés.
- **Fix (a tulaj választása 3 opcióból): PROMPT-BUDGET + QA-GATE** (NEM vak runtime CSS-felülírás, NEM auto-regen).
  (1) `ADAPT_SYSTEM` 8. szabály: számszerű ritmus — reszponzív `padding-block:clamp()`, nem-hero magasság a
  tartalmat kövesse, belső rés ≤2,5rem, ~85% kitöltés, tier-érzék. (2) `src/generator/qaAiriness.ts` render-alapú
  mérő (tag-agnosztikus sáv-detektálás) → `generateMock`-ba best-effort, nem-blokkoló → `airinessDeadPct` az
  artifactba. CLI: `scripts/qa-airiness.ts <mock> [width]`. ADR-0011-re épül.
- **Éles A/B (Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%. A budget
  STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, fent/lent-rés 114→68px, nincs nem-hero min-height);
  a maradék = belső rés + hero-kompozíció (részben legitim lélegzés). Ha küszöb fölött marad → QA-gate célzott regen (A2).
- **Fájlok:** ÚJ `src/generator/qaAiriness.ts`, `scripts/qa-airiness.ts`; MÓD `mockFromCorpus.ts` (8. szabály),
  `generate.ts` (QA-gate), `_planning/DECISIONS.md` (ADR-0012). Commit `4d26165` (a tényhűség-kapuval összefonódva).
- **2. őr — JOG/PROVENANCE (commit `35b6165`):** §A provenance×fázis mátrix + §C outreach 4 eleme, NOW/DEFERRED címkézve.
  Runtime: `provenanceCheck.ts` demo-framing check (az EGYETLEN valós felület ma; konverziós asset-kapu + outreach-küldés
  DEFERRED, mert a pipeline nincs). Subagent `jog-provenance-or.md` (fázis-tudatos).
- **3. őr — DIZÁJN-DOKTRÍNA (commit `35b6165`):** §B dizajn-enforce. `designCheck.ts` determinisztikus (emoji-tilalom
  `\p{Extended_Pictographic}`, 11 `--cit-*` token, booking-horog). Subagent `dizajn-doktrina-or.md` az ítélet-igényű részre.
- **Mind a 3 kapu füst-tesztelve** (pozitív+negatív), `tsc` tiszta. ⚠️ NINCS élő end-to-end generálás-teszt (valós API+DB).
  Új subagent-típusok natív hívhatósága session-újraindítás után. Részletes tudás: `_planning/memory/2026-07-12_guardian_agents.md`.

### 2026-07-12 (este) — Őr-agentek ÉLES PRÓBA + guardian-bug fix + matchConfidence bekötés
- **A fenti nyitott kérdések LEZÁRVA:** mindhárom subagent (`tenyhuseg-or`, `jog-provenance-or`, `dizajn-doktrina-or`)
  **natívan hívható** session-restart után ÉS ítéletet hoz. A grandis mockon mind PASS; a tényhűség-őr megtalálta a
  `leads-godollo.json` igazságforrást és minden HARD tényt strukturált mezőhöz kötött (nem hitte el vakon).
- **Guardian-bug fix (commit `ecce21e`):** `designCheck.ts` emoji-szűrő false-positive-olt a `©`/`®`/`™` jogi jeleken
  (footer-copyright miatt 3 jó mock tévesen FLAG-elt) → `EMOJI_ALLOWLIST` (a `★` szándékosan bukik: dekoratív = SVG).
- **matchConfidence bekötve (commit `408f445`):** eddig csak a kontakt/fotó-hiányos OSM-leadek kaptak konfidenciát;
  a Places-natív leadek (pl. GRANDIS, `sources=[google_places]`) `undefined`-del maradtak → §F.17b nem tudott zárni.
  Fix: Places-natív = self-match (`scoreMatch` táv 0 / név 1 / OSM-korroboráció) → google_places önmagában **0.85 high**,
  +osm **1.00**. ⚠️ A meglévő JSON-artifactek csak a **következő éles scrape-nél** töltődnek (tulaj-döntés: nincs backfill).
- **BREV-IRÁNY halasztva (tulaj-döntés):** a `webSearch()` MA is Google CSE-t hív (kivezetés alatt); a Brave-backend
  NINCS megírva és **nem is íródik, amíg a kurátor nem automata**. `BRAVE_SEARCH_API_KEY` nem kell most.
- **API-kulcs állás:** a re-scrape magját kulcs nem blokkolja — `GOOGLE_MAPS_API_KEY` + `GOOGLE_CSE_ID` +
  `ANTHROPIC_API_KEY` mind kitöltve a `.env`-ben. SMTP/outreach + Brave halasztva; `DATABASE_URL` = beágyazott dev-PG.
- Commitok: `ecce21e`, `5dc79a3` (distiller inbox-archív), `a3438b6` (doksik), `408f445`. Kapcsolódó rés a
  BACKLOG A4-ben: match-konfidencia ma mechanikus (név+táv+OSM), kontextuális/vélemény-korroboráció nélkül.

### 2026-07-11/12 — Runtime-modulok (gallery/map/reviews) + üres-sáv réteges fix + Sissi presence-fix
- **3 új runtime-modul** (ADR-0011 minta, progresszív fejlesztés → JS nélkül is tartalom):
  `gallery` (megosztott lightbox), `map` (kattintásra-betöltő Google-embed facade, GDPR), `reviews`
  (snap-carousel valós kártyákra; kamu tilos → gyakran kimarad). `assets/runtime/` + 2 fixture. Commit `aba5e05`.
- **⚠️ QA üres-sáv — RÉTEGES fix (commit `cd1e1c9`):** (1) `injectRuntime` determinisztikus no-JS háló:
  üres booking-slot → statikus érdeklődés-kártya (mailto); `<noscript>` + `cit-anim` a scroll-reveal
  tartalomra. (2) `cit-runtime.js::initReveal()` — a **reveal MOSTANTÓL RUNTIME-viselkedés** (IntersectionObserver
  a `.reveal`-re). Kiváltó: a `vertical-timeline-scroll`/`vertical-ribbon-nav` archetípusok JS-sel is üres sávosak
  voltak (a per-archetípus IO törékeny; a gated CSS-t az LLM megírta, az observert elhagyta → JS-sel örökre rejtett).
  Valós telefon-teszt fogta el (GRANDIS). Fix után: no-JS 76%→0%, mobil 14/14 reveal felszabadul. Prompt-szabály:
  reveal = PE, saját IO tiltva. (3) Két friss éles mock generálva validálásra (Sissi, GRANDIS).
- **Presence fals negatív — FORDÍTOTT SORREND fix (commit `3eba776`):** Sissi Panzió `no_site` volt, PEDIG van
  saját oldala (`panziosissi.hu`; a domain = típus-szó ELÖL). A `enrichPresence.candidateHosts` most a fordított
  token-sorrendet is próbálja. Élőben verifikálva → `has_own`. GRANDIS NEM hiba volt (`modern`, force-generált teszt-mock).
- **Új tartós tudás:** [[project_hybrid_review_model]] (külső scrape + first-party „oldalon hagyott" vélemény);
  a presence-memória Sissi-tanulság + Brave-időzítés (`_planning/memory/2026-07-07_presence_detection.md`).

### 2026-07-10 — MOCK-MOTOR (két-agent) + modul-UI + Gödöllő-pilot
- **ADR-0009 — archetípus-elsődleges korpusz:** a korpusz tengelye az ARCHETÍPUS (szerkezet), tier a
  partíció; a KÖRNYEZET lefokozva grounding-hintté (nem korpusz-mappa). A 36-metszet (env×tier) modell
  ELDOBVA. Kevesebb dizájn, nagyobb pool/anti-collision, régió-független. Korpusz: `assets/design-refs/corpus/{tier}/{n}.html` + `manifest.json` (27 dizájn, 21 egyedi archetípus).
- **Két agent:** `src/generator/corpus.ts` (agent-1, korpusz-építő, `scripts/build-corpus.ts` — `--tier=`) +
  `src/generator/mockFromCorpus.ts` (agent-2: osztályozás→tier-kiválasztás+anti-collision→grounded).
- **ADR-0010 — modul = FUNKCIÓ-tengely, ADAT nem korpusz-tengely** (nincs archetípus×modul robbanás).
  Katalógus: `_planning/DOMAIN/05-MODULES.md` (Szint 0–1, csak szállás).
- **ADR-0011 — modul-UI: token-kontraktus + hidratáló runtime** (`assets/runtime/cit-modules.css` +
  `cit-runtime.js` + `src/generator/runtime.ts` inline-injektor). Rendszer-költség O(archetípus)+O(modul),
  NEM O(arch×modul). Első interaktív widget: booking/érdeklődés (bar/card), token-témázott. Spec:
  `_planning/DOMAIN/06-UI-CONTRACT.md`. 3 fixture bizonyítja: egy widget, több natív téma.
- **Konzol átkötve az új pipeline-ra** (`generate.ts` régió koordinátából, `server.ts` fire-and-forget +
  auto-frissülő „folyamatban", `views.ts`). Konzol: http://100.97.188.105:4600/ · néző: :8899/
- **Gödöllő-pilot:** 24 hely (cap 40), 13 lead, 10 grounded mock — mind más archetípus, a bor/tó-íz
  groundinggal semlegesítve. Bizonyítja: a korpusz NEM régió-zárt (Balaton-korpusz Gödöllőt is kiszolgál).
  `scripts/build-corpus.ts` `--cap` a scraperben; `poc-corpus-mock.ts <regionId> <n>` régió-szűrővel.

---

**Nulláról tervezés — FÁZIS 1–4 ✅ KÉSZ. Következő: FÁZIS 5 (éles pilot) VAGY a tényleges ÉPÍTÉS.**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Alapmodell:
`.../2026-07-04_business_model_understanding.md`. Kimenetek: phase1/2/3/4 doksik. A régi teszt-kód/modell eldobva.
Stack (MVP): Node/TS, Postgres (RLS+JSONB), Playwright, Claude API; build-vs-buy; managed felhő.

### ⭐ Kereszt-metsző alapelvek (minden fázisra — lásd ROADMAP tetején)
- **A1 — Automatizálás-elsőbbség:** minden folyamat besorolandó (Automatizált / Manuális→tenant / Manuális→ház);
  minden manuális pontnál kötelező kérdés: hogyan automatizálható később? Az automatizáció = fő értékajánlat.
- **A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban** (kuráció, pénzügy, support).
- **A3 — Nyelv ≠ korlát; AI-vezérelt kontextus-lokalizáció** (nem hardcoded; Site/admin/outreach). Határ: jog+formátum+pénznem = determinisztikus, ország-szabály.
- **⚠️ A4 — A mock ALAPJA = bizalmi alapkő; TÖBB-RÉTEGŰ ellenőrzés** (provenance + több-jeles párosítás + kereszt-forrás korroboráció + AI-ellenőr + konfidencia-fallback + kuráció + tulaj-megerősítés). „Bizonytalanság → kevesebb, sosem hamis." A provenance/verifikáció a scraper+generátor melletti 3. bizalom-kritikus komponens. Részletek: BACKLOG.

### Fázis 1–2 fő felismerések (röviden)
- ⭐⭐ **3 becsatlakozási pont: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ** — egy Iparág-definíció = e 3 interfész implementálása; minden más közös (Fázis 2, két iparágon igazolva).
- ⭐ A motor **Iparág × Ország** kétdimenziós: `Site = Tenant + (Iparág-def × Ország-lokalizáció) + Vállalkozás-profil + Modulok`.
- ⭐ **Control plane (mi világunk) vs. Data plane (honlap világa, per-tenant izolált)** — entitlement-vezérelt provisioning (instant modul-aktiválás). Tiered izoláció (RLS+PII-titkosítás), hibrid adatmodell (fix mag+JSONB), hibrid render (statikus+dinamikus szigetek), réteges időtárolás.
- ⭐ **Két moduláris platform:** külső (tenant Site-modulok) + belső (operátor back-office: pénzügy/sales/CRM/bizonylat) — külön RBAC.
- ⭐ **Két kulcs-motor:** scraper/lead-discovery (volumen) + generátor (termék). A **scraper is Iparág × Ország** paraméterezett (platform-regiszter: globális/lokális-nagy/helyi-kicsi + digitális lábnyom-profil; kvalifikáció: nincs/elavult/modern honlap). MVP: szállás + Balaton (teszt).
- ⭐⭐ **A „nincs semmije" lead a LEGÉRTÉKESEBB szegmens** (max hozzáadott érték + konverzió + verseny-mentes). Technikailag legnehezebb (kevés anyag), üzletileg legjobb → a „minimál-adatból varázslatos mock" képesség a fő MOAT. Megoldás standardizáltan: régiós kontextus-scraper + stock/placeholder + AI (lásd BACKLOG).
- ⭐ **Meta-domain jelenlét mindig megmarad** → aggregátor/portál vektor (saját booking-alternatíva; Fázis 6).
- Kötelező **tenant-izoláció**; a vendég nem üzleti aktorunk. Modul-taxonómia + minimum→szofisztikált à la carte lépcső.

## Státusz
- **Alapmodell rögzítve (jóváhagyott):** iparág-AGNOSZTIKUS, AI-üzemeltetett, volumen-alapú
  disztribúciós gép. Elsődleges ígéret = LÁTHATÓSÁG. Horog = előre kész, személyre szabott mock.
  Tölcsér: lead-scrape → mock (előre kész) → multi-csatorna megkeresés → élesítés (= 1. fizetős kapu)
  → moduláris upsell → megszűnéskor inaktiválás.
- **⚠️ A régi `src/` (Property-központú szűk szállás-modell) + DOMAIN `02-ENTITY-MAP` ELDOBVA.**
  Csak teszt-visszaigazolás volt (badacsonyi validáció: 85% nincs saját honlap). Tényleges
  `git rm` az új struktúra scaffoldjakor.
- Git remote: github.com/olaszferenc/citoviso — push továbbra is deploy key-re vár.
- Éles hoszting/deploy: TBD.

## Parkolt ötletek
`_planning/BACKLOG.md` — pl. interaktív mock-konfigurátor + élő próbatér (fizetés előtt); adat-vezérelt lead-priorizálás.

## Következő lépés (folytatás innen)
A tervezés (Fázis 1–4) kész. Két irány közül választ a tulaj:
1. **Fázis 5 — éles pilot:** valós balatoni lead → megkeresés → fizetés → élő oldal; humán-pontok + konverziós arányok mérése.
2. **VAGY a tényleges ÉPÍTÉS megkezdése** a Fázis 4-terv alapján (a mag: scraper + generátor építhető).
Utána Fázis 6 (skálázás + aggregátor-portál + pénzügyi konstrukció + globális piacok/jogi keret). Részletek: `_planning/ROADMAP.md`.

## Nyitott kérdések (szándékosan elhalasztva a folyamat-modellig)
- Pénzügyi séma: előfizetés / egyösszeg / kombináció — képlékeny.
- Visszatérő érték / churn; upsell-időzítés.
- Hotlink-kép üzemeltetési törékenysége (idegen szerver leszedi → kép eltűnik).
- Google Maps kép-kivétel kezelése.
- Kiküldés-előtti belső jóváhagyás részletei.
- Globális enterprise-nyitottak: ki a "user" (tenant vs. végfelhasználó), időtárolás/audit mélysége,
  booking-sync (Booking.com/Airbnb) vs. tiszta direkt-foglalás, i18n-mélység (RTL/CJK, pénznem, jog).

## Előzmények
- 2026-07-07/08 (tervezés+infra szál): **1. INFRA-PILLÉR — tartós adat-réteg leszállítva:** embedded
  Postgres 18 (userspace, `.pgdata`, socket :5433) + Kysely + saját migráció-runner; 6 mag-entitás
  (`migrations/0001`, `src/db/`). **4 planning-doksi:** `PROCESS.md` (réteges, event-driven ügyviteli
  folyamat), `CONTEXT.md` (validációs brief), `PILOT.md` (instrumentált tanuló-pilot a megrendelésig),
  `VISIBILITY.md` (felfedezhetőség-motor + retention). ⭐ Fő felismerések: **iparág-agnosztikus** (a
  szállás csak az ELSŐ vertikum — CLAUDE.md+memória javítva); **láthatóság ≠ honlap** (kell auto
  felfedezhetőség-motor: SEO+Schema.org+GBP fél-automata); **retention = leállítható dinamikus funkció**
  (foglalás=OTA-jutalék-kiváltás), NEM a tartós, odaadott láthatóság; pilot-számlázás **Mineral-híd** +
  fallback. **Következő (build): 2. pillér — motorok átkötése az adat-rétegre + instrumentált preview.**
- 2026-07-07: **Presence-detektálás** (scraper). Feltárt kritikus rés: a „nincs honlap" eddig csak a
  Maps `websiteUri` hiányából jött (nem bizonyíték). Kutatás: Bing Search API halott, Google CSE
  „entire web" kivezetés alatt (2027-ig). Megoldás: guess+geo-verifikált HTTP-proba (0 API). ⚠️ VÉRREL
  TANULT: naiv guess 4/8 hamis pozitív → talált honlap CSAK geo-egyezéssel érvényes (§F invariánsok).
  Leszállítva: `src/scraper/enrichPresence.ts` + run.ts-bekötés + `03-INVARIANTS.md` §F. Következő: Brave.
- 2026-07-04 (session 2): MEGÉRTÉS fázis. A tulaj elmondta az iparág-agnosztikus disztribúciós-gép
  modellt; üzleti-folyamati kérdésekkel közösen tisztáztuk (fő ígéret, mock-mechanika, jogi állás,
  domain, humán-pontok). Alapmodell jóváhagyva és mentve. Régi kód/modell eldobásra jelölve.
- 2026-07-04 (session 1): Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo
  CIT idle-slot. Badacsony piac-teszt (85% nincs saját honlap) validálta az ötletet. Árazás +
  motor-tanulságok + remote-setup a `_planning/memory/`-ban.
