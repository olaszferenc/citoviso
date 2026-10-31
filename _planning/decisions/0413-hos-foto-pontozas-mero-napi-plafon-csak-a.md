## ADR-0413 — Hős-fotó pontozás: mérő + napi plafon, csak a generálás pontoz; a generálás nem fizet a Google-nek

**Dátum:** 2026-10-31 · **Státusz:** elfogadva (lokál, nem élesítve) · Kiegészíti: ADR-0293 (Places-politika), ADR-0412 (fordítás API-val tilos) · Felülírja: ADR-0293 „auto” politikájának fizetős ágát, ADR-0106 Google-értékelés újralekérését a generálásban

### Kontextus

Az API-hívás leltár (`_planning/memory/2026-10-27_api_hivas_leltar.md`) mérte: a hős-fotó pontozás
(`scoreHeroCandidates`, Haiku 4.5) élesen napi 6–9 ezer képet ítélt (`photo_hero_score` új sorai: 10-09 8953,
10-21 7843, 10-27 6430), ≈ $0,002/kép → $13–18/nap a csúcsnapokon, és **sehol nem könyvelődött**: a
`recordAiUsage` a mock-futáson kívül no-op, a kurátori út (`buildSourcePack`) és a lead-lap a futáson kívül
pontozott, a generálás utána teli cache-t talált, és „AI-költség: 0 hívás”-t írt. A napi AI-plafon
(`AI_DAILY_CAP_USD`) csak a mock-generálást látja. A generálás közben fizetős Google-hívásokat is indíthatott a
`SCRAPE_PAID_APIS` kapun kívül: Places (portál-fotó nélküli leadnél), Place Details reviews (elavult értékelésnél),
Street View Static (fotó nélküli leadnél, vision-alapozásnak).

**Tulaj-döntés (2026-10-31, a leltár-jelentésre):** „1: igen; 2: igen; 3: ne hívjon fizetős cuccot” —
① fordítás csak kolléga (már ADR-0412); ② a pontozás marad API, de csak a kiküldésre szánt leadekre, mérővel
és napi plafonnal; ③ a generálás ne hívjon fizetős Google-t.

### Döntés

1. **Csak a generálás pontoz élőben.** A fotókapu (`resolveGatedPhotos`) `places: "auto"` (generálás) mellett
   hívja a `scoreHeroCandidates`-t; minden más hívó — lead-lap `GET /lead/:id/photos`, forrás-csomag
   (`buildSourcePack`, a kurátori szöveg útja), Places-gomb — csak a már megvett ítéleteket olvassa
   (`readCachedScores`). A mock-futás a „kiküldésre szánt” lead: amiből mock lesz, azt pontozzuk.
   A közvetlen hívók (`POST /lead/:id/hero`, `rescore-photo-verdicts.mts`) maradnak, a mérő és a plafon őket is köti.
2. **Mérő:** minden pontozó hívás egy `ai_spend` sort ír (0118: gép, folyamat, lépés, modell, token, USD), a
   futáson belül és kívül egyaránt; a mock `aiUsage` változatlan.
3. **Napi plafon:** `HERO_SCORE_DAILY_CAP_USD` (env, alap **$5**, budapesti nap, az `ai_spend` adott lépésének
   összege). Elérve nincs új hívás: a cache-elt ítélet marad, a többi fotó alap-sorrendben. A mérés hibája
   **zárt** plafont jelent.
4. **Pazarlás:** `max_tokens` 2048 → 4096 (24 magyar indoklású ítélet nem fért el; az elvágott válasz nem
   cache-elődött, a következő kérés újra fizetett), és az elvágás (`stop_reason: max_tokens`) hangosan naplóz.
5. **A generálás nem fizet a Google-nek:** az „auto” politika soha nem kér Places-t (tárolt választ használ,
   ha van); fizetni csak a kurátor kifejezett gombja tud (`places: "curator"`, `SCRAPE_PAID_APIS` kapuval);
   nincs Place Details reviews újralekérés (a 30 napnál régebbi tárolt értékelés kimarad, ahogy eddig a bukott
   újralekérésnél); nincs Street View Static nyitókép-pótlás (fotó nélküli leadnél a vision-alapozás kép nélkül fut).

### Következmények

- A portál-fotó nélküli lead mockja Places-fotó nélkül készül (a kollégák hozzák a képet, vagy a kurátor gombja).
- A Google-vendéghang csak friss, tárolt értékelésből jön; a kollégák behozhatják a kontakttal.
- A plafon elérése után az aznapi új mockok nyitóképe pontozatlan → a kép-kapu / kurátor-sor dönt.
- Őr: `scripts/hero-score-cap-check.mts` (pre-commit) + a `places-cache-check` „auto nem fizet” esetei.
- Élesítés: a 0118 migráció a deploy része; `HERO_SCORE_DAILY_CAP_USD` beállítás nélkül $5.
