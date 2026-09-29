# Böngészős méret-őr a csillagsorra, mind a 19 sablonon (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/csillagmeret-or.md` · tulaj: „Igen”.
Előzmények: `2026-09-29_trio_minta_szobakep_es_csillagsor.md`, `2026-09-29_csillagszam_egy_szabaly.md`
(„Nyitott”: a méret-őr). Döntés: ADR-XXXX (a land osztja ki a számot).

## Mi készült

`scripts/star-size-check.mts` — 19 sablon × {élő, mock} × {390 px telefon (isMobile, touch, DPR 3),
1280 px}; a lap MINDEN csillagsora (≥ 2 közvetlen csillag-SVG gyermek): nem 0×0, nem rejtett,
opacity ≥ 0,5, viewporton belül, nem takart (hit-test), 0,5–2,2 em a sor szövegméretéhez, egy sorban.
Egy böngésző, 6 párhuzamos lap, ~15–20 s. Bekötve a `hooks/pre-commit`-be (`--self-test` + kapu),
`self-overlap-safe` jelöléssel (ADR-0261). Kivétel: card-sidebar `.mob-book` 1280 px-en (indokolt,
és csak amíg tényleg nincs kirajzolva; fel nem használt kivétel = bukás).

## Mérés

- Ma a mainen: **zöld, 152 sor**. Valódi hibát nem talált → a koordinátornak nincs döntendő lelet.
- Méret-sáv a mai adatból: 0,62 em (dopamine, a `h2`-be tett 32 px-es sor) – 1,31 em (card-sidebar
  vélemény-fejléc). A régi claymorphism-hiba 16 em volt.
- Negatív kontroll ①: `--self-test` 4 visszaültetett hiba (trió 0×0 · claymorphism régi szabály ·
  rejtett kártya-sor · takaró réteg) → mind piros, a többi zöld.
- Negatív kontroll ②: a VALÓDI régi sablon-fájlok (trió `114e161d~1`, claymorphism `fa5e6897~1`)
  → 24 lelet, pontosan a 4 érintett sablon.
- 3× kapu + önteszt egymás mellett, load1 ~15: 3/3 zöld.

## Útközben — a mérőm három saját hamis pirosa (nem sablon-hiba)

1. **Sticky ≠ fixed:** a card-sidebar sticky oldalsáv-kártyáját „fix” sorként a hős utáni pozícióból
   mértem → −447 px. Most csak a `position:fixed` sor mérődik így; a sticky-t is a helyére görgetem.
2. **Globális `pointer-events:auto`** a hit-testhez: a brutalism `body` dekor-álelem-rétege
   (kattintás-áteresztő) lett a „takaró” mind a 3 kártyán. Most csak a csillagok kapják.
   Ára: egy `pointer-events:none` takaró réteget a próba nem lát (ADR-ben kimondva).
3. **Beúszás a mérés UTÁN:** a trió mock-lapján 390 px-en `opacity 0` — az IntersectionObserver →
   setTimeout → osztály → átmenet a „settle” után érkezett. Most kivárja a legnagyobb
   `data-cit-motion-delay`-t, és az animációkat végállapotba teszi.
   + az ADR-0115 nyitó-függöny (arch-frames/wordmark-grow) az első ~2–3 s-ban mindent takar:
   a runtime `data-cit-no-intro` kapcsolójával mér mögötte.

## Módosított fájlok

`scripts/star-size-check.mts` (új) · `hooks/pre-commit` ·
`_planning/decisions/XXXX-a-csillagsor-meretet-es-lathatosagat-bongeszos-or.md` (új) · ez a jegyzet.
