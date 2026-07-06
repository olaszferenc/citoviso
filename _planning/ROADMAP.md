# Citoviso — Fejlesztési ROADMAP (jóváhagyott)

Utolsó frissítés: 2026-07-06
Státusz: **Fázis 1–4 ✅ KÉSZ. Következő: Fázis 5 (éles pilot).**

---

## ⭐ KERESZT-METSZŐ ALAPELVEK (minden fázisra, minden fejlesztésnél kötelező)

**A1 — Automatizálás-elsőbbség.** Az automatizáció az egyik fő ÉRTÉKAJÁNLATUNK; a tömeghatás miatt
értéket csak automatizált folyamaton át adhatunk. Minden folyamatot be KELL sorolni:
*Automatizált (agent/rendszer — cél) / Manuális→tenant (a tulaj feladata) / Manuális→ház (Operátor/Kurátor).*
Minden manuális pontnál KÖTELEZŐ kérdés + feljegyzés: **hogyan tehető később automatizálttá?**

**A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban.** Az ember sosem a fősodorban áll (az automata),
csak a bizonytalan/kockázatos kivételeknél; a fősodor betanulásával az emberi lefedettség csökken.
(Kuráció, pénzügyi felügyelet, support — lásd Fázis 1b.)

**A3 — Nyelv ≠ korlát; AI-vezérelt, kontextus-alapú lokalizáció.** A tartalmi szöveget AI fordítja kontextus-alapon
(nem hardcoded string-tábla, hanem nyelv-független forrás + AI-generált cache-elt variáns; felületek: Site/admin/outreach).
⚠️ Határ: **jog + formátum + pénznem = determinisztikus, ország-szabály** (NEM fordító-AI-ra bízva).

---

> A teljes fejlesztési folyamat fő fázisai. A tulaj jóváhagyta a sorrendet (2026-07-04).
> Elv: a magot NEM a semmiből absztraháljuk, de nem is egy iparágból — a Fázis 1 iparág-független
> vázat rak le, a Fázis 2 azonnal ütközteti 1-2 iparággal (absztrakt-először + konkrétból-desztillált ötvözet).

## Fázisok

- **0. Üzleti alapmodell — ✅ KÉSZ.** Jóváhagyva, mentve: `_planning/memory/2026-07-04_business_model_understanding.md`.

- **1. Rendszer-anatómia — a „mag" fogalmi terve (iparág-FÜGGETLEN) — ✅ KÉSZ.**
  Kimenet: `2026-07-04_phase1_system_anatomy.md`. Fő eredmények:
  - **1a. Aktorok** ✅ — 7 szereplő; kötelező tenant-izoláció; vendég = nem üzleti aktorunk; cégnyilvántartás mint forrás.
  - **1b. Tölcsér-gerinc** ✅ — 8 állomás; ⭐ INVARIÁNS: *kivétel-alapú, önmagát visszavonó ember a hurokban*.
  - **1c. Fogalmak** ✅ — szótár; ⭐ **Iparág × Ország kétdimenziós motor**; ⭐ meta-domain mindig marad → aggregátor/portál vektor.
  - **1d. Moduláris kompozíció** ✅ — taxonómia (univerzális / iparág-spec. / ország-függő / tenant-belső) + minimum→szofisztikált lépcső; à la carte.

- **2. Az absztrakció próbája 1-2 konkrét iparággal — ✅ KÉSZ.**
  Kimenet: `2026-07-05_phase2_industry_validation.md`. ⭐⭐ KONKLÚZIÓ: mind a 4 réteg (ügyfélút, ügyvitel,
  adat-séma, modulkészlet) közös magot mutat + specializáció **3 becsatlakozási ponton: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ**.
  Egy Iparág-definíció = e 3 interfész implementálása. Tézis (iparág-független mag) IGAZOLVA két valós iparágon.

- **3. Architektúra & technológiai alapdöntések (enterprise-réteg) — ✅ KÉSZ.**
  Kimenet: `2026-07-05_phase3_architecture.md`. Fő eredmények: ⭐ **Control plane vs. Data plane** (entitlement-
  vezérelt provisioning); tiered tenant-izoláció (RLS+PII-titkosítás); hibrid adatmodell (fix mag + JSONB);
  hibrid render (statikus váz + dinamikus szigetek) + CDN; mock-gyártó agent-pipeline + kivétel-gate;
  réteges időtárolás; ⭐ **két moduláris platform** (külső Site-modulok + belső back-office) külön RBAC-cal.

- **4. Vertikális MVP — első működő end-to-end szelet — ✅ KÉSZ.**
  Kimenet: `2026-07-05_phase4_mvp_walking_skeleton.md`. Iparág=**szállás**, piac=**Balaton (teszt)**.
  ⭐ **KÉT automata mag:** scraper/lead-discovery (volumen-motor) + generátor (termék). ⭐ a **scraper is Iparág × Ország**
  paraméterezett (platform-regiszter + lábnyom-profil). Stack: Node/TS, Postgres (RLS+JSONB), Playwright, Claude API;
  **build-vs-buy** (mag épül, commodity vétel); hosting = **managed felhő** (saját infra → Fázis 6).

- **5. Éles pilot — első valós ügyfelek — ⏳ KÖVETKEZŐ.** Valós lead → megkeresés → fizetés → élő oldal a Balatonon.
  A humán-pontok éles feltérképezése, valós konverziós arányok, a kézi perem tanulságai (majd automatizálás — A1).

- **6. Skálázás & bővítés.** ⏳ Több iparág/piac, i18n, enterprise-réteg kiteljesítés, humán-pontok automatizálása,
  a pénzügyi/értékesítési konstrukció véglegesítése (éles adatokkal).

## Jelenlegi belépőpont a folytatáshoz
**Fázis 5 (éles pilot) — VAGY a Fázis 4-terv alapján a tényleges ÉPÍTÉS megkezdése** (a tervezés 1–4 kész, a mag
építhető). Fázis 5: valós balatoni lead → megkeresés → fizetés → élő oldal; humán-pontok + konverziós arányok mérése.
Kimenetek: `2026-07-04_phase1_*`, `2026-07-05_phase2_*`, `_phase3_architecture`, `_phase4_mvp_walking_skeleton`.
Parkolt ötletek: `_planning/BACKLOG.md`.
