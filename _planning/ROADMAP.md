# Citoviso — Fejlesztési ROADMAP (jóváhagyott)

Utolsó frissítés: 2026-07-04
Státusz: **Fázis 1 ✅ KÉSZ (1a–1d). Következő: Fázis 2.**

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

- **2. Az absztrakció próbája 1-2 konkrét iparággal — ⏳ KÖVETKEZŐ.**
  Szállás + vendéglátás végigmodellezése a Fázis 1 kereten (Iparág-definíció 4 rétege), a KÖZÖS kivonatolása —
  validálva, hogy a mag tényleg iparág-független. (Ez a korábban „iparági folyamat-modellnek" hívott lépés — NEM a nulladik.)

- **3. Architektúra & technológiai alapdöntések (enterprise-réteg).** ⏳
  Multi-tenancy, adatmodell, **tenant-izoláció** (saját store/honlap), temporal/audit, i18n,
  hosting több százezer oldalhoz, AI-agent-orchestráció, security, stack-döntések.

- **4. Vertikális MVP — első működő end-to-end szelet.** ⏳ Egy iparág, egy piac, a teljes tölcsér kicsiben, a valódi magra.

- **5. Éles pilot — első valós ügyfelek.** ⏳ Valós lead → megkeresés → fizetés → élő oldal. A humán-pontok éles feltérképezése.

- **6. Skálázás & bővítés.** ⏳ Több iparág/piac, i18n, enterprise-réteg kiteljesítés, humán-pontok automatizálása,
  a pénzügyi/értékesítési konstrukció véglegesítése (éles adatokkal).

## Jelenlegi belépőpont a folytatáshoz
**Fázis 2 indítása:** szállás + vendéglátás iparág-definíció (4 réteg: ügyfélút, ügyvitel, adat-séma, modulkészlet)
végigmodellezése a Fázis 1 fogalmi kereten, majd a KÖZÖS mag kivonatolása. Részletes Fázis 1 kimenet:
`_planning/memory/2026-07-04_phase1_system_anatomy.md`.
