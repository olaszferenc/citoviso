# A csillagszám egyetlen, skála-tudatos szabályból (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/csillagszam-egy-szabaly.md` ·
a lelet forrása: `2026-09-29_trio_minta_szobakep_es_csillagsor.md` („Megfigyelés”).
Tulaj (a koordinátoron át): „oszd ki”. Kinézet nem változik → §2b-kivétel (hibajavítás), ui-shot megvolt.

## Mi volt

A kitöltött csillagok száma 10 sablonban (aurora, artdeco, cinematic, claymorphism, fullbleed,
horizontal, organic, scrapbook, transit, watercolor) saját sorból jött:
`Math.max(1, Math.min(5, Math.round(data.rating.value)))` — a forrás skálája nélkül. Egy 8,7 / 10
forrásra 5 csillag (helyes: 4), 6,2 / 10-re 5 (helyes: 3). Mérve a régi kódon: **mind a 10** bukik
(nem 7 — az organic, watercolor, claymorphism a vélemény-kártyákon is rajzol sort, a trió-jegyzet
fixture-jén a fejléc-sor nem jelent meg). Egy 11. másolat a konzolban: a Vélemények modul
Google-kártyája (`moduleConfigViews.ts`, „{n} csillag az oldalon”) — a kommentje szerint „ugyanaz a
kerekítés”, de külön példány volt.

A többi keresett hely rendben: JSON-LD (`seo.ts`) a nyers értéket + `bestRating`-et adja; a
`primitives.ts` / `moduleSections.ts` / sablonok „★ 4,4” egyes ikonja nem darabszám; a
`reviews.ts` `STARS` a vendég SAJÁT (1–5) csillagát írja a tulaj-levélbe, nem a forrás-átlagot.

## Javítás — egy szabály, egy hely

- `honestStars(d)` → `src/engine/rating.ts` (a skála-szabály mellett); a `templateKit.honestStarCount`
  ezt hívja. Mind a 19 sablon a `honestStarCount`-ot használja; a konzol-kártya a `honestStars`-t.
- **Claymorphism mellékleletként:** a vélemény-fejléc csillagsora (`.cl-revscore .cl-st`) méretezetlen
  viewBox-SVG volt (csak a `.cl-rv .cl-st` kapott 16 px-et) → minden Google-értékeléses claymorphism
  lapon 4 db ~115 px-es csillag egymás alatt. A méret most mindkét sorra szól. Régi hiba, nem a
  darabszám-javítás terméke.

## Őr — a RENDERELT sort méri

`scripts/rating-scale-check.mts` bővítve (már be van kötve a pre-commitba, a trigger lefedi a
sablonokat és a `rating.ts`-t): 19 sablon × 4 alany (4,4/5 → 4 · 3,2/5 → 3 · 8,7/10 → 4 ·
6,2/10 → 3), a lapon a ≥2 egymás utáni csillag-SVG-t számolja; minden sablonnak legalább egy sort
kell mutatnia (különben „a mérés vak”). Zöld: 104 renderelt sor.
- A fixture kapott egy `stats` „star” tételt (a generátor így adja, `generateEngine.ts`) — nélküle
  7 sablon egyáltalán nem rajzol sort, és az őr vakon zöld lett volna.
- Negatív kontroll ①: a régi 10 sablon-fájl visszarakva → 26 lelet, mind a 10 sablon mindkét tízes
  alanyon bukik, az ötös alanyokon egy sem (ott a két szabály egyezik).
- Negatív kontroll ②: `--self-test` a régi sor KIMENETÉT teszi vissza a 10 sablon lapjára; akkor
  zöld, ha pontosan ezek buknak (20/20), és semmi más.

## Mérés (böngésző, 390 és 1280 px, 8,7 / 10 alany)

Mind a 19 sablonon minden sor 4 csillag, látható méretben; JS-hiba 0. (A card-sidebar asztali 4.
sora 0 px — az a mobil foglalósáv, asztalon szándékosan rejtett.)

## Döntési anyag (gitignore-olt, a fában marad)

`elek/runs/csillagszam-2026-09-29/` — `<sablon>-{mobil,asztali}.png` (a csillagsor környéke, a 10
érintett sablon) + `<sablon>.html` (a renderelt lap).

## Nyitott

- A csillagsor MÉRETÉT (0×0 trió, ~115 px claymorphism) két külön alkalommal csak kép fogta meg;
  böngészős méret-őr mind a 19 sablonra (a `live-sample-room-check` trió-mérésének kiterjesztése)
  megérné — nem építettem meg, a koordinátor döntse el.
