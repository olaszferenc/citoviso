# 2026-08-28 — Ki nem küldött mock törlése + több-típusú generálás

> ⏸️ **STÁTUSZ: a felület a §2b terv-jóváhagyási kapura vár.** A kód kész és zölden tesztelt, de
> KÓD-ELŐBB készült (doktrína-sértés — a tulaj fogta meg). Nem landolt; a most bekötött felület-kapu
> (`2026-08-28_surface_plan_gate_hook.md`) helyesen blokkolja is a commitját, amíg nincs jóváhagyás.
> A kód a munkafában marad (uncommitted/stash), a rendes terv→ui-shot→átadás(desktop+mobil)→jóváhagyás
> kör után mehet tovább.

## Feladat
Két operátor-konzol funkció a lead-oldal „Mock és generálás" fülén:
- **(A)** Egy jóváhagyott, de MÉG KI NEM KÜLDÖTT mock legyen törölhető.
- **(B)** Egyszerre több kinézet-típus (template) legyen választható, és mindegyikre külön mock generálódjon.

## Megoldás

### (A) Törlés — őr-kapuzott, nem csak UI
`isArtifactDeletable(id)`: törölhető ⇔ `status='approved'` **ÉS** nincs kiküldött megkeresés
(`prospect.sent_at IS NULL` minden hozzá tartozó sorra) **ÉS** nem forrása élő site-nak
(`site.source_artifact_id`). A `deleteArtifact(id)` a SZERVEREN újra ellenőrzi ezt — a gomb csak
kényelmi, nem a kapu. Ez a §I (no bait-and-switch) egyenes következménye: amit a lead már látott,
vagy ami élő oldalt hordoz, nem tűnhet el.

Hard delete: DB-sor + `curator_decision` (FK cascade) + a ki nem küldött prospekt-váz
(különben `ON DELETE SET NULL` árva tokent hagy) + a legenerált HTML-fájl (best-effort `unlink`).
Route: `POST /artifact/:id/delete` → vissza a `#mock-artifacts` horgonyra. `confirm` dialog.

### (B) Több-típusú generálás
A template-picker rádió → **checkbox** (multi-select, alap: `fullbleed`, legalább egy). A generate
handler `form.getAll("template")`-ből szedi a bejelölteket, és `Promise.allSettled`-del minden
típusra külön `generateEngineMock`-ot hív → külön mock-fájl (`mock-<slug>-<template>.html`, a
fájlnév már típus-specifikus, nincs ütközés) + külön `mock_artifact` sor. Egy hiba nem viszi el a
többit. `citTplPick` JS: checkbox-onként toggle-öl (nem törli a többit), az előnézet az utoljára
bekapcsoltat követi.

## Módosított fájlok
- `src/console/data.ts` — `isArtifactDeletable` + `deleteArtifact` (+ `unlink` import)
- `src/console/server.ts` — `POST /artifact/:id/delete` route + több-típusú generate handler + `deleteArtifact` import
- `src/console/views.ts` — törlés-gomb (`deletable` feltétel), checkbox-picker, `citTplPick` toggle, label
- `src/i18n/catalog.json` — új T() stringek

## Ellenőrzés
- `tsc` ✅, i18n-lint ✅, design-token-lint ✅, kb-check --coverage ✅.
- **Funkcionális teszt (dev DB):** ki nem küldött + valós fájl + ki nem küldött prospekt → törölve
  (sor + prospekt + döntés + fájl mind eltűnt); kiküldött prospekttel → `deleteArtifact` false, érintetlen.
- **Vizuális (ui-shot 390+desktop):** 16 checkbox-kártya renderel; a törlés-gomb + „csak ki nem
  küldött mock törölhető" súgó megjelenik egy nem-konvertált jóváhagyott mocknál. A két meglévő
  jóváhagyott mock már élő site forrása → az őr helyesen tiltotta a törlésüket (ez adta a bizonyítékot,
  hogy a konvertált-védelem működik).

## Tanulság
A dev DB mindkét jóváhagyott mockja már konvertált volt, ezért a törlés-gomb ELSŐRE sehol nem jelent
meg — ez nem hiba volt, hanem az őr helyes működése. A gomb megjelenését csak ideiglenes,
nem-konvertált teszt-artifacttal lehetett igazolni (utána takarítva). Screenshot-alapú „nem látszik"
≠ „nincs bekötve": a kettőt szét kell választani, mielőtt hibát keresnénk.

## Nyitott
Élesítés NEM történt (külön, scope-olt engedély kell, §0.3).
