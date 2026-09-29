## ADR-XXXX — A csillagsor MÉRETÉT és LÁTHATÓSÁGÁT böngészős őr méri mind a 19 sablonon (`star-size-check`) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29, a koordinátoron át):** a kérdésre („Csillagméret-őr: … Épüljön rá egy
  böngészős őr mind a 19 sablonra?”): *„Igen”*. Brief: `~/rc-briefs/csillagmeret-or.md`.
- **Miért:** a csillagsor rossz méretét kétszer is csak KÉP fogta meg, őr nem — a trió 0×0 px-es
  viewBox-SVG-je (114e161d) és a claymorphism vélemény-fejlécének méretezetlen SVG-je (~115 px-es
  csillagok egymás alatt, fa5e6897). A darabszámot a `rating-scale-check` méri; a méretet, a
  láthatóságot és a sor-alakot semmi.

**Döntés**

1. **Új kapu: `scripts/star-size-check.mts`**, a pre-commitba kötve (sablonok, `templateKit`, `render`,
   `moduleSections`, `primitives`, `icons`, `motion`, `runtime.ts`, `cit-runtime.js`/`cit-modules.css`
   és önmaga változásakor; előbb `--self-test`, aztán a kapu). 19 sablon × {élő, mock} ×
   {390 px telefon: isMobile, touch, DPR 3 · 1280 px asztali}; csillagsor = ≥ 2 közvetlen
   csillag-SVG gyermek (a közös `STAR_PATH`) — a lap MINDEN ilyen sora.
2. **A szabály csillagonként:** nem 0×0; nincs `display:none`/`visibility:hidden` őse; effektív
   opacity ≥ 0,5; teljesen a viewporton belül; a közepén a hit-test a csillagot adja; a nagyobbik
   oldala a SOR saját szövegméretének **0,5–2,2 em**-je (a sablon betűméretéhez kötve, nem fix px —
   mérve ma 0,62–1,31 em; a régi claymorphism-hiba 16 em); a sor minden csillaga egy vonalban.
3. **Mérési feltételek (mind a vendég végállapotát méri, nem egy pillanatot):** a sort
   `behavior:"instant"` görgetéssel a képernyő közepére hozza (a `scroll-behavior:smooth` különben a
   mérés után érkezne); a `position:fixed` sort a hős UTÁNI pozícióból méri; kivárja a legnagyobb
   `data-cit-motion-delay`-t és az animációkat a végállapotukba teszi; az ADR-0115 nyitó-függönyt
   (`.cit-fintro`/`.cit-intro`) a runtime saját `data-cit-no-intro` kapcsolójával kihagyja;
   hálózat nélkül (képek/fontok megszakítva). A hit-test idejére CSAK a csillagok kapnak
   `pointer-events:auto`-t — a lapra kényszerítve a brutalism kattintás-áteresztő dekor-rétege hamis
   „takarót” adott. Következmény, kimondva: egy `pointer-events:none` takaró réteget ez a próba nem lát.
4. **Kivétel csak a `HIDDEN_BY_DESIGN` listán, indokkal**, és csak amíg a kivett sor konténere
   TÉNYLEG nincs kirajzolva; ha látszik, rendesen mérve lesz. A fel nem használt kivétel bukás.
   Ma egy: a card-sidebar telefonos foglalósávja (`.mob-book`) 1280 px-en.
5. **Hangos bukás (ADR-0171/0227):** eredmény nélküli (sablon, fázis, nézet) = bukás; csillagsor
   nélküli sablon = „a mérés vak” bukás; munkás-kivétel = bukás; `innerWidth ≠ eszköz` és JS-hiba
   is bukás. A kimenet a hook szokott `>"$GATE_LOG" || gate_failed` alakján megy (csak bukáskor kiírva).
6. **Gyors:** egy böngésző-indítás, nézetenként 3 párhuzamos lap (`CIT_SSC_JOBS`, alapból 6; `=1`
   soros). **`self-overlap-safe` jelölés (ADR-0261):** memóriában renderel (`setContent`), nem ír
   fájlt, sort, közös útvonalat — az önteszt és a kapu egymás mellett futhat.

**Negatív kontroll**

- `--self-test`: a két régi hiba a renderelt lapba visszaültetve (① a trió méret-szabálya törölve →
  0×0 · ② a claymorphism régi, csak-kártyás szabálya), + ③ `visibility:hidden` kártya-sor, ④ takaró
  réteg a fejléc-soron. Mind a 4 piros, a többi lap zöld (idegen bukás = önteszt-bukás).
- A VALÓDI régi forráson (a 3 trió-fájl `114e161d~1`, a claymorphism `fa5e6897~1` állapotában):
  24 lelet, PONTOSAN a 4 érintett sablon (trió: 4/4 csillag 0×0, mindkét nézet, mindkét fázis;
  claymorphism: 215 px = 16 em, 4 külön sorban, részben a viewporton kívül), semmi más.

**Eredmény:** a mai mainen zöld — 152 csillagsor, mind látható, sávon belül, egy sorban; ~15–20 s
(3× egymás után, az öntesztével párhuzamosan, load1 ~15 mellett is zöld). Valódi hibát ma nem talált.
