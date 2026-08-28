# Kontraktus — Mock-törlés + több-típusú generálás (operátor-konzol)

**Jóváhagyva:** 2026-08-28 (a tulaj a képek alapján, §2b/ADR-0066/0077). Ez a befagyasztott terv a
megvalósítás KONTRAKTUSA — a kész felületet EHHEZ mérjük. `index.html` = a valós renderelt lead-oldal
„Mock és generálás" fülének pillanatképe a jóváhagyáskor.

## Mit KÖT a terv (elvárt VISELKEDÉS, nem stílus-javaslat)

### A) Mock törlése
- A **„Mock törlése"** gomb (piros, a `bad` design-token) a mock-artefaktum panelen jelenik meg,
  a konvertálás-vezérlő mellett, **kizárólag akkor**, ha a mock:
  1. státusza `approved`, ÉS
  2. **nincs** hozzá kiküldött megkeresés (`prospect.sent_at IS NULL`), ÉS
  3. **nem** forrása élő site-nak (`site.source_artifact_id`).
- Mellette a súgó: „csak ki nem küldött mock törölhető".
- Kattintás → `confirm` megerősítés → `POST /artifact/:id/delete`.
- A törlés HARD: `mock_artifact` sor + `curator_decision` (FK-cascade) + a ki nem küldött
  `prospect`-váz + a legenerált HTML-fájl. A feltételt a **szerver is** ellenőrzi
  (`isArtifactDeletable`) — kiküldött/konvertált mock a gomb kikerülésével sem törölhető.

### B) Több kinézet-típus egyszerre
- A kinézet-típus-választó **checkbox** (multi-select), legalább egy jelölve (alap: `fullbleed`).
- Egy kártya bejelölése/kivétele csak a saját `.on` kiemelését váltja; az előnézet az utoljára
  bekapcsolt típust mutatja.
- Generáláskor **minden bejelölt típusra külön mock** készül: külön `generateEngineMock` hívás
  (`Promise.allSettled` — egy hiba nem viszi el a többit), típusonként külön fájl
  (`mock-<slug>-<template>.html`) és külön `mock_artifact` sor.

## Megvalósító fájlok
`src/console/data.ts` (`isArtifactDeletable`, `deleteArtifact`), `src/console/server.ts`
(`POST /artifact/:id/delete` + több-típusú generate handler), `src/console/views.ts`
(törlés-gomb + checkbox-picker + `citTplPick`).
