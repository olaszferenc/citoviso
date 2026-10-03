# 2026-10-03 — A Google-értékelés kétszer: a sablon saját linkes kártyája + a közös jelvény (walk-through, gate-opening)

**Szál:** SUB a CIT koordinátor alatt; brief `~/rc-briefs/fix-google-jelveny-dupla.md`. Döntés: ADR-XXXX.

## Elvégezve
- Mérés böngészőben: 21 sablon × mock / élő+modul / élő+modul+vélemény × 390 px / 1366 px, a dev-DB valós mock-adatának
  alakjával (mind a 165 rating-es mock: stat + rating(url), vélemény nélkül).
- Lelet: a „minden sablonon” állítás túlzás. A közös jelvény csak a `walk-through` és `gate-opening` sablonon duplázott
  (saját „Megnézem a Google-on” kártya + alatta a `reviews-pending` / `google-rating` jelvény, ugyanaz a link).
  A régi 19-en a hős-stat + vélemény-rész jelvény az ADR-0057 ② által jóváhagyott pár.
- Javítás: `src/engine/render.ts` méri, hogy a sablon kimenete már linkeli-e a vélemény-oldalt (`ratingAlreadyLinked`);
  `src/engine/moduleSections.ts` ilyenkor a `googleRatingBlock` és a `reviewsPendingBlock` jelvényét kihagyja.
- Őr: `scripts/rating-once-check.mts` (+ `hooks/pre-commit`): a vélemény-oldal linkje pontosan 1 (0 is piros);
  régi kódon 6 piros, önteszt a visszarakott jelvénnyel.

## Módosított fájlok
- `src/engine/render.ts`, `src/engine/moduleSections.ts`, `scripts/rating-once-check.mts`, `hooks/pre-commit`,
  `_planning/decisions/XXXX-a-google-ertekeles-egyszer-a-forras-linkkel.md`, `MEMORY.md`, ez a jegyzet.

## Nyitott (a koordinátornak)
- Sablon-saját ismétlések (brutalism hős: címke + nagy szám; editorial fejléc + oldalsáv; card-sidebar felső sor +
  oldalsáv; dopamine hős-matrica) — tervezői döntés, nem a közös jelvényé.
- Élő lap `google-rating` modullal ÉS first-party véleménnyel: a 16 régi sablon vélemény-fejléce link nélkül írja ki a
  számot, alatta a modul-jelvény linkkel → melyik marad: kinézeti döntés (2 mock-változat, ha kéri). Ma nincs ilyen tenant.
- walk-through / gate-opening: „Vendégek értékelése” kártya alatt „Vendégek véleménye” helytöltő-cím.
