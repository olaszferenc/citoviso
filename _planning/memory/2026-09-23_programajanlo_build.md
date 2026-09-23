# 2026-09-23 — Automata heti programajánló: MEGÉPÍTVE (gyűjtés, választó, honlap-blokk, tulaj-levél)

**ADR-XXXX.** Brief: `~/rc-briefs/programajanlo-gyujtes-brief.md` (a 2026-09-22-i mérés folytatása).
Saját fa: `~/wt/cit35b0e705`, egyedül (ellenőrizve).

## Tulajdonosi döntések ebben a körben
- **Település-kulcsos gyűjtés** (nem tenantonkénti): mérve 3 tenant köre 96 helyett **42** település.
- **Honlap-blokk: A (napirend-lista)** — „Az A változat nagyon jó!", két módosítással: mobilon 5 +
  „Még N program" gomb; a „Nyilvános forrásokból gyűjtjük…" lábszöveg KI. Kontraktus:
  `assets/design-refs/public-site/programajanlo/`.
- **Heti levél CSAK a tulajnak** + figyelmeztetés: „Önnek kell kiválasztania…".
- **Távolság „N km"**, „légvonalban" nélkül („marad a cca 11 km… szarok rá").
- **Üres választásnál automatikus kitöltés** a legközelebbiekkel.
- **Új parkolt ötlet (BACKLOG):** vendég-értesítések FIZETŐS modulként (pakolás −7 nap; időjárás +
  programok + teendők −2 nap; kicsekkolás előtti nap, köszönet).
- **Vásárláskor azonnal** („különben dühös lesz a tenant"): `citoviso-events-pending.timer`
  ötpercenként gyűjti a még sosem begyűjtött tenant-köröket (bármelyik aktiválási út), advisory
  lockkal a napi futás mellett. Mérve: élő próba Agrosz (Kisapáti) → begyűjtve + újrarenderelve;
  második futás „nincs függő tenant"; zár alatt „egy másik gyűjtés fut — kimarad".
- **Lead-mock programajánlóval** (tulaj kérdése): NEM külön szál — ugyanazt a renderelőt érinti;
  ebben a szálban, a landolás UTÁN.

## Mérések
- Rozé Fogadó köre: 120 település a 30 km-ben, 41 lekérdezve, 99 lap, **40 egyedi program**,
  **$0,43/hét**. ⚠️ Magányos tenantnál ~650 Ft/hó költség a 490 Ft/hó árral szemben — jelezve, az ár a tulajé.
- 6 települési dry-run: 28 program, $0,098. Kapu-bukások a teljes körben: `unknown_place` 58,
  `expired` 23, `date_not_in_text` 2, `duplicate` 2 — a dátum-a-szövegben kapu ÉLŐ, nem dísz.

## Saját hibák, amiket őr/kép fogott meg
- **Template-literál csapda:** a kliens-szkriptben a `\s` sima `s` lett → az átírt címből minden
  „s" eltűnt volna. A `programs-editor-check` fogta meg (3 piros), a képen nem látszott volna.
- **Két duplapár átcsúszott** az első dedupon (összetett szó: „Gasztrofesztivál" ⊃ „fesztivál";
  Jaccard 0,5 határ) — az éles futás listájából derült ki, nem a mért párokból.
- **Túl rövid település-tő** („balat") a „Balatoni Borhét"-et is Balatonfüred nevének nézte volna.
- **Hét őr-fixture** hordozta még a régi `poi: ["Strand 2 km"]` alakot — a `scripts/` nincs
  típus-ellenőrizve, ezért csak futásidőben (a pre-commitban) derült ki.
- **A saját kontraktusom** összerakott feliratot idézett („Forrás: <domain>") — a contract-drift
  kapu fogta meg; csak a szó szerinti `T()`-argumentum idézhető.
- **Az ADR-szám a munka közben foglalttá vált** (a main ADR-enkénti fájlszerkezetre állt át,
  ADR-0210) → ADR-XXXX, saját fájlban.

## Park-lelet (a landolás közben)
A `configurator-placement-check` a tiszta `origin/main`-en is piros volt: a közös dev-DB-ben
`module_sales_disabled = ["email","gallery"]` állt. Író: a `module-sales-check` (VICTIM = gallery),
amelynek két egymásba lapolódó futása közül az egyik a másik IDEIGLENES állapotát mentette
„eredetiként" és azt állította vissza → tartós maradék, ami minden session land-jét blokkolja.
Visszaállítva a döntés szerinti `["email"]`-re (2026-09-06 seed). A két őr javításra szorul
(zár a kapcsolón, vagy saját fixture) — nem ebben a szálban.

## Fájlok
Új: `src/events/{gates,settlements,gather,pool,picks,ownerMail}.ts`, `src/email/programsEmail.ts`,
`migrations/0071_local_events.sql`, `scripts/{gather-events,events-gates-check,programs-editor-check}.mts`,
`deploy/systemd/citoviso-events{,-pending}.{service,timer}`, `kb/entries/admin-modules-programs/`,
`assets/design-refs/public-site/programajanlo/`, `_planning/decisions/0211-…md`.
Módosult: `src/moduleConfig.ts` (poi v2), `src/server/{moduleConfigViews,public}.ts`,
`src/engine/{moduleSections,recipe}.ts`, `src/tenant/{editor,multilangCore,messageTopics}.ts`,
`src/db/schema.ts`, `src/ai/usage.ts`, `src/scraper/sources/osm.ts`, 7 őr-fixture, `scripts/kb-shot.mts`,
`scripts/i18n-sources.mjs`, `deploy/systemd/README.md`, `_planning/BACKLOG.md`.

## Nyitott
- **Lead-mock programajánlóval** (következő lépés ebben a szálban).
- A két `citoviso-events*` timer a dev gépen NINCS telepítve (pénzt költ) — tulaj-döntés; ÉLESÍTÉSKOR telepítendő, különben semmi nem gyűlik.
- Költség vs. ár (fent). Lehetséges csökkentés: LLM-kötegek településeken ÁTÍVELŐ feltöltése.
- A lakosság-küszöb (≥1000) nem mért feltevés — az `event_gather_run` hozamából korrigálandó.
