# KONTRAKTUS — Névből növő (wordmark-grow): Képek-sáv, Foglalás-kártya, nagyobb és lassabb nyitány

**Jóváhagyta:** a tulaj, 2026-10-04 (§2b; a koordináló session szó szerint hozta: „Névből növő B”) ·
**Változat:** **B** — Képek: fekvő 4:3 húzható kártyák; Foglalás: a sáv kártyaként a Képek után ·
**Terv:** `plan.html` (önhordó, a valódi Mandula vendégház 20 fotós renderje; a B változat) ·
**Képek:** `B-kepek-{asztali,mobil}.png`, `B-foglalas-naptar-asztali.png`, `ma-foglalas-asztali.png` (a hiba),
`intro-{elotte,utana}-{asztali,mobil}.png` ·
**Hatókör:** `src/engine/templates/wordmarkGrow.ts` · `src/engine/motion.ts` ·
`scripts/gallery-reach-check.mts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.
⚠️ A `../gallery-cap/` kontraktus wordmark-grow pontját (**A — Kártyapakli**) ez FELÜLÍRJA; a másik három sablon ottani pontjai változatlanok.

## Miért

A tulaj (2026-10-03): „névből növő mocknál mind telefonon mind pedig asztali nézeten nagyon kicsi a kép
amiből kinő és a transition a fix képpé túl gyors. a Képek résznél asztali nézeten látszódjon 3 kép
egyszerre. Mobilon lehessen a képeket oldal irányba pöckölni. a szabad időpontok elrendezése nagyon gáz”

Mérve: a kinövő keret 14×18 px (390 px telefon) és 70×86 px (1440 asztali) volt; a kinövés 1,9 mp alatt a
TELJES ablakra nőtt, majd egy képkocka alatt a menü alatti, kisebb hős-dobozba ugrott. A közös foglalás-sáv
(`bookingSlot`, „cta” változat) ebben a sablonban formázatlanul a bal szélhez tapadt, közvetlenül a teljes
„Foglalás” naptár-szakasz fölött: két „Foglalás” cím egymás alatt, köztük ~300 px üres sáv.

## KÖT — Képek (B)

1. **Egy sornyi, vízszintesen húzható sáv**, MINDEN fotóval (a közös nagyító mindet lapozza), a még nem látott
   képekkel kezdve (`galleryOrder`) — a gallery-cap 1–3. és 5. pontja változatlanul áll.
2. **Fekvő 4:3 kártyák.** Asztalin **egyszerre 3** teljes kép látszik; 860 px alatt 1 kép (a szélesség 86%-a)
   + a következő kilóg, ujjal húzható (scroll-snap).
3. Alatta a közös lapozó: ‹ · „1 / N” · ›; az elején a ‹, a sáv végén a › tiltott (runtime `data-cit-gstrip`).
4. A szakasz feje (csillag-jel, cím, egy mondat) a sáv FÖLÖTT, balra zárva.
5. A sáv nem szélesíti ki a telefon layout-viewportját; a kártyák árnyéka nem vágódik le.
6. Fotó nélkül egy tervezett kitöltő kártya (a modul-horog sosem tűnik el).

## KÖT — Foglalás (B)

1. Ha van foglalási felület (élő foglalás-modul, vagy mock-demó), a vékony sáv — „Foglalás” felirat +
   „Szabad időpontok megtekintése” gomb — **közvetlenül a Képek után** áll, nem a teljes naptár fölött.
2. A sáv **megformázott kártya**: a tartalom szélességében, lekerekítve, felület-háttérrel; asztalin a felirat
   balra, a gomb jobbra; mobilon egymás alatt, a gomb teljes szélességű.
3. A teljes naptár a lap végén, a saját „Foglalás” szakaszában marad.
4. Foglalási felület nélkül (érdeklődés-sáv) a sáv a régi helyén és a közös elrendezésben marad — ezt a
   kontraktus nem érinti.

## KÖT — nyitány (intro; csak ez a sablon viszi, ADR-0115 ②)

1. A keret, amiből a kép kinő, a KÉPERNYŐHÖZ méretez: asztalin `min(34vh, 24vw)` magas, 4:5 arányú
   (1440×900-on ~245×306 px); a név betűmérete ehhez igazodva csökken, egy sorban marad.
2. Álló képernyőn (képarány ≤ 4:5) a név két fele a keret fölé és alá kerül; a keret `min(56vw, 40vh)` magas
   (390×844-en ~175×218 px).
3. A kinövés 0,6×-os lejátszáson **3,0 mp** (azelőtt 1,9), és a hős SAJÁT dobozába nő (nem a teljes ablakra);
   utána a takaró réteg ~0,75 mp alatt áttűnik — a kép nem ugrik. A teljes nyitány így ~8,7 mp (azelőtt ~7,0).
4. A meglévő fail-safe-ek (csak a session első nézetén, reduced-motion és JS nélkül nincs) változatlanok.

## Mérés

`npx tsx scripts/gallery-reach-check.mts` — a wordmark-grow a sáv-sablonok közt (lapoz, a ‹ az elején tiltott),
és asztalon pontosan 3 teljes kép látszik.
