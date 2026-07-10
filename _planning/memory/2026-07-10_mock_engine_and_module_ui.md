# 2026-07-10 — Mock-motor (két-agent), modul-UI kontraktus, Gödöllő-pilot, konzol-átkötés

## Mit csináltunk
Megépült és éles-validálódott a teljes MOCK-MOTOR, plusz a modul-UI architektúra és egy új-régiós pilot.

### 1. Korpusz-modell átalakítás — ADR-0009 (archetípus-elsődleges)
- A korábbi 36-metszet (9 környezet × 4 minőség) partíciót ELDOBTUK. Empíria hajtotta: az első pilot-demó
  (27 korpusz-dizájn + 4 grounded mock badacsonyi leadeken) megmutatta, hogy a KÖRNYEZET gyenge hard-tengely
  (fuzzy klasszifikáció; a paletta a groundingnál születik a valós fotókból; a diverzitás az archetípusból jön).
- Új modell: **ARCHETÍPUS = elsődleges** (szerkezet, nyílt halmaz), **TIER = partíció** (4, strukturálisan valós),
  **KÖRNYEZET = grounding-hint** (nem korpusz-mappa). Korpusz: `assets/design-refs/corpus/{tier}/{n}.html` + `manifest.json`.
- A 27 meglévő dizájnt migráltuk (env elhagyva, tier-particionálva). 21 egyedi archetípus.

### 2. Két agent
- `src/generator/corpus.ts` (agent-1) + `scripts/build-corpus.ts` (`--tier=`, `--all`, `--count`, `--force`, `--shots`; safety: üresen nem tüzel).
- `src/generator/mockFromCorpus.ts` (agent-2): `classifyLead` (tier + env-hint) → `selectCorpusDesign` (tier-szűrés, archetípus anti-collision, usage-rotáció, tier-fallback) → `generateFromCorpus` (grounded, blueprint = korpusz-dizájn).

### 3. Modul-architektúra — ADR-0010 + ADR-0011
- **ADR-0010:** a modul a FUNKCIÓ-tengely és ADAT, nem korpusz-tengely (nincs archetípus×modul robbanás).
  Az archetípus modul-BEFOGADÓ. Vékony definíció most (Szint 0–1), csak szállás. Katalógus: `_planning/DOMAIN/05-MODULES.md`.
- **ADR-0011:** a modul-UI nem 100×N kézi meló. Két kontraktus: (A) téma-tokenek (`--cit-*` a `:root`-ban),
  (B) modul-horgok (`data-cit-module`). Egy hidratáló runtime + token-témázott widgetek. Rendszer-költség
  **O(archetípus)+O(modul)**. Élő kód: `assets/runtime/cit-modules.css` + `cit-runtime.js` + `src/generator/runtime.ts`
  (inline-injektor, mert a mock standalone HTML). Első interaktív widget: booking/érdeklődés (bar/card variáns).
  Spec: `_planning/DOMAIN/06-UI-CONTRACT.md`. Fixture-bizonyíték: `assets/runtime/fixtures/` (3 téma, egy widget).
- Tényhűség: a mock-booking érdeklődés/foglalási IGÉNYT állít össze, nem hazudik élő elérhetőséget/árat (élő = Szint 4).

### 4. Konzol átkötve az új pipeline-ra
- `src/generator/generate.ts`: a `generateMock` mostantól a korpusz-pipeline-t hívja (nem a régi `generateAiMock`-ot),
  a régiót a lead KOORDINÁTÁIBÓL oldja fel (`resolveRegion`, `regions.ts` bbox), és injektálja a runtime-ot.
- `src/console/server.ts`: `POST /generate` **fire-and-forget** (0.003s a 115s helyett), in-memory „generating" halmaz.
- `src/console/views.ts`: „generálás folyamatban" állapot + auto-frissülés + azonnali gomb-visszajelzés.
- Konzol: http://100.97.188.105:4600/ (port `4600`, `CONSOLE_PORT`).

### 5. Gödöllő-pilot (új régió, a pipeline igazolása)
- `src/scraper/regions.ts`: `godollo` bbox. `src/scraper/run.ts`: `--cap N` (isLead-elsőbbség). `scripts/poc-corpus-mock.ts`:
  régió-paraméter (bbox-szűrő + label).
- Eredmény: 24 hely (cap 40 alatt), 13 lead, **10 grounded mock — mind más archetípus**, a bor/tó-íz groundinggal
  semlegesítve. Bizonyítja: a Balatonra épült tier-korpusz gond nélkül kiszolgál egy pest-megyei várost (env-agnosztikus).

## Nyitott / következő
- Korpusz-bővítés (luxus csak 1 db; tierenként több archetípus) — kredit-igényes.
- Visszatérő QA: „üres-sáv" a mockok alján (kihagyott szekció vagy nem renderelt lazy kép) — kivizsgálandó.
- További interaktív modulok a runtime-registryhez (gallery-lightbox, reviews, map) — ugyanaz a minta.
- Konzolhoz esetleg régió-szűrő a lead-listára.

## Módosított/új fájlok
`_planning/DECISIONS.md` (ADR-0009/10/11), `_planning/DOMAIN/{04-INDEX,05-MODULES,06-UI-CONTRACT}.md`,
`src/generator/{corpus,mockFromCorpus,runtime,generate}.ts`, `src/console/{server,views}.ts`,
`src/scraper/{regions,run}.ts`, `scripts/{build-corpus,poc-corpus-mock}.ts`, `assets/runtime/*`,
`assets/design-refs/corpus/*`, `package.json` (`corpus:build`).
