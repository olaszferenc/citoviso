# 2026-10-04 — Hat mock-sablon passziválva (Dopamin, Scrapbook, Agyag, Akvarell, Szerkesztői, Brutalizmus)

Session: `citb829e5a3`. Commit: `cebd57a0` (land: IGAZOLTAN FENT). Élesre: csak a nagy deployjal.

## Kérés
Tulaj: „ezek nem jók… passziváljuk” — `dopamine`, `scrapbook`, `claymorphism` (Agyag), `watercolor` (Akvarell),
`editorial` (Szerkesztői), `brutalism`.

## Megoldás
- `ArtTemplate.retired?: true` (`src/engine/templateKit.ts`), a hat sablon-modulon beállítva.
- `isPickableTemplate(id)` (`src/engine/templates.ts`).
- Konzol választó (`src/console/views.ts` `templateCards`) kiszűri; a generáló route (konzol szerver) csak választhatót fogad.
- A `TEMPLATES` registryben MARADNAK: a meglévő mockok, élő oldalak, a CLI-szkriptek és a render-kapuk továbbra is futnak velük.
  (Nem törlés — egy törölt sablon a ráépült mockokat/oldalakat törné el.)
- Őr: `scripts/template-pick-check.mts` — aktív sablonnak van kártyája, passzivált nem kerül a választóba.

## Megjegyzés
A §2b felület-kapu megállította (renderelt felület a diffben); kinézeti döntés nem volt, a kivétel a tulaj kimondott
utasítására hivatkozva rögzítve (`surface-gate.mjs exception`).

## Nyitott
- Ha a passzivált sablonokra épült mockot/oldalt is ki kell vezetni (pl. újragenerálás aktív sablonnal), az külön kérés.

## Módosított fájlok
`src/engine/templateKit.ts`, `src/engine/templates.ts`, `src/engine/templates/{dopamine,scrapbook,claymorphism,watercolor,editorial,brutalism}.ts`,
`src/console/views.ts`, `src/console/server.ts`, `scripts/template-pick-check.mts`.
