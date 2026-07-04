# Citoviso — Fejlesztési ROADMAP (jóváhagyott)

Utolsó frissítés: 2026-07-04
Státusz: **Fázis 1 folyamatban** (1a kész, 1b vázlat)

> A teljes fejlesztési folyamat fő fázisai. A tulaj jóváhagyta a sorrendet (2026-07-04).
> Elv: a magot NEM a semmiből absztraháljuk, de nem is egy iparágból — a Fázis 1 iparág-független
> vázat rak le, a Fázis 2 azonnal ütközteti 1-2 iparággal (absztrakt-először + konkrétból-desztillált ötvözet).

## Fázisok

- **0. Üzleti alapmodell — ✅ KÉSZ.** Jóváhagyva, mentve: `_planning/memory/2026-07-04_business_model_understanding.md`.

- **1. Rendszer-anatómia — a „mag" fogalmi terve (iparág-FÜGGETLEN) — 🔄 FOLYAMATBAN.**
  Cél: megérteni, *mi a rendszer*, mielőtt bármit építünk. Nem kód, nem iparág.
  Al-blokkok:
  - **1a. Aktorok & szerepek — ✅ KÉSZ** (lásd `2026-07-04_phase1_system_anatomy.md`).
  - **1b. A tölcsér mint rendszer-gerinc — 🔄 vázlat kész, 2 nyitott kérdés** (kuráció-lefedettség, pénzügyi kontroll skálázása).
  - **1c. A fő fogalmak definíciója** — mock, site, modul, iparág-definíció, lead, tenant, előfizetés (iparág-agnosztikusan). ⏳
  - **1d. A moduláris kompozíció elve** — mi a modul, hogyan épül minimumtól szofisztikáltig. ⏳

- **2. Az absztrakció próbája 1-2 konkrét iparággal.** ⏳
  A magot 1-2 valós iparág (szállás, vendéglátás) végigmodellezésével validáljuk, a KÖZÖSET kivonatoljuk.
  (Ez a korábban „iparági folyamat-modellnek" hívott lépés — NEM a nulladik.)

- **3. Architektúra & technológiai alapdöntések (enterprise-réteg).** ⏳
  Multi-tenancy, adatmodell, **tenant-izoláció** (saját store/honlap), temporal/audit, i18n,
  hosting több százezer oldalhoz, AI-agent-orchestráció, security, stack-döntések.

- **4. Vertikális MVP — első működő end-to-end szelet.** ⏳ Egy iparág, egy piac, a teljes tölcsér kicsiben, a valódi magra.

- **5. Éles pilot — első valós ügyfelek.** ⏳ Valós lead → megkeresés → fizetés → élő oldal. A humán-pontok éles feltérképezése.

- **6. Skálázás & bővítés.** ⏳ Több iparág/piac, i18n, enterprise-réteg kiteljesítés, humán-pontok automatizálása,
  a pénzügyi/értékesítési konstrukció véglegesítése (éles adatokkal).

## Jelenlegi belépőpont a folytatáshoz
**Fázis 1b nyitott kérdései:**
- (a) A mock-kuráció (#3) MINDEN mockra kell, vagy mintavételes / kockázati jel alapján? (tömeg-költség)
- (b) A pénzügyi kontroll (#6) MINDEN tranzakcióra emberi, vagy csak küszöb/anomália fölött? (skálázás)

Utána: 1c (fogalmak) → 1d (modul-elv) → Fázis 2.
