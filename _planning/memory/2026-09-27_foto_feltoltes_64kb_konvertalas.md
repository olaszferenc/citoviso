# 2026-09-27 — Fotó-feltöltés: a 64 KB-os body-határ + feltöltéskori konvertálás

## Mi történt
- Tulaj (telefon, dev publikus szerver): „Nem tölti fel a képeket” — egy sor 100%-on állt, a többi 0%-on.
- Gyökérok: `readRawBody` 64 KB-os közös határ; a throw a folyam közben elvágta a kérést.
  Mérve: régi kódon 8 MB → 400.
- Javítás 1 (`49fe1afe`): útvonalankénti határ (fotó: 8,5 MB), ürítés a határ felett, XHR-timeout,
  szoba-szerkesztő fájlonként.
- Javítás 2 (`ed651fdc`, tulaj kérése): konvertálás böngészőben + szerveren (ADR-0248).
  Tesztképen (9 MB, zaj — legrosszabb eset): szerver → 1,4 MB, böngésző → 2,05 MB, 1920×2560, GPS nélkül.

## Módosított fájlok
- `src/server/public.ts`, `src/server/adminViews.ts`, `src/server/moduleConfigViews.ts`
- `src/tenant/photoUpload.ts` (új)
- `scripts/photo-upload-body-check.mts`, `scripts/photo-normalize-check.mts` (új), `hooks/pre-commit`

## Tanulság
- A worktree-port hook a parancs SZÖVEGÉT nézi (fájlnév, port-szám egy heredocban is blokkol) —
  szöveges fájlt Write eszközzel, commit-üzenetet `-F fájl`-ból.

## Nyitott
- Telefonon, valódi fotókkal a tulaj még nem igazolta (élő szervert worktree-ből a hook tilt; a
  könyvtárba írást nem futtattam).
- A „max. 6 MB képenként” súgósor elriaszthat — tulaj: most maradjon, később döntünk.
- Nincs élesítve (a nagy deployjal megy).
