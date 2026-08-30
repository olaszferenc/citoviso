# Név-masthead — jóváhagyott kontraktus (2026-08-30)

**Tulajdonosi döntés:** „az A irány" — és nem egy leadre, hanem MINDEN generált mockra:
a hiba (a szállásnév apró sarok-brandként) egyetlen sablonban sem jelenhet meg többé.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A név uralja az első képernyőt** — középre zárt szerkesztőségi masthead-lockupként:
   név (display betű) → település-alsor vékony léniák közt → link-sáv. A jelenlétet a
   pozíció, a levegő és a léniák adják, **NEM a betűméret** (a méret-felfújást a tulaj
   kifejezetten elvetette: „mérnöki megközelítés, nem dizájn").
2. **A név EGYSZER él az első képernyőn** — a masthead mellett nincs sarok-brand.
   A sablon régi karcsú sávja vagy (a) csak görgetett állapotban úszik be, vagy (b) törlődik,
   és a masthead maga a fejléc.
3. **Sablon-dialektus kötelező** — a masthead a sablon saját hangján szól (`--mast-*`
   property-felülírások: brutalism nyers uppercase + tömör vonalak, artdeco réz + rombusz,
   scrapbook kézírásos place-sor, stb.), de a szerkezet (név → hely → link-sáv) közös.
4. **Fotós hero-tető = overlay mód** (fehér tinta, erősített felső scrim); **szolid tető =
   flow mód** (lap-tinta). Overlay esetén a hero-szöveg lejjebb költözik, hogy a fotó teteje
   a névé legyen.
5. **Mobilon (≤720px)** a link-sávból csak a foglalás-CTA marad; a név olvasható marad,
   nem folyik rá a hero-szövegre.

## Hol él

- Primitív: `src/engine/templateKit.ts` → `mastheadHtml()`, `mastheadCss()`.
- Minta-implementáció: `src/engine/templates/fullbleed.ts` (ehhez mérünk).
- Sweep-hám: `scripts/masthead-sweep.mts` (egy lead inputja minden sablonon át).
- A jóváhagyott vizuális referencia: `approved-masthead.html` (Levendula-adattal).
