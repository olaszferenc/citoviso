## ADR-0087 — Név-masthead kontraktus: a szállásnév uralja minden mock első képernyőjét

**Dátum:** 2026-08-30 · **Státusz:** ELFOGADVA (tulajdonosi jóváhagyás: „az A irány… hogy minden
mock file-nál ez a hiba ne jelenjen meg", zárás: „ez hibátlan így") ·
**Kapcsolódó:** ADR-0027 (art-templates), ADR-0063 (nyelvváltó), §2b felület-kapu.

**A kiváltó panasz (tulaj):** a mock-okban a szállásnév „nagyon pici… mindenhol" — pedig az első
megnyitáskor a saját név + saját kép együtt adja a horog kapósságát. Az első három javaslatom a
betűméretet csavarta három állásba → tulaj-dörgedelem: „MÉRNÖKI MEGKÖZELÍTÉS, NEM DIZÁJN…
ERRE NEM LEHET EGY ŐRT BERAKNI." A tanulság külön memóriában
(feedback_size_inflation_is_not_design): a láthatóság dizájn-válasza lockup/kompozíció a
referencia-mockok formanyelvéből, nem pontméret; az ízlés-kört nem gépi őr, hanem a terv-kör hozza.

**A döntés:**
1. **Masthead-lockup** (a jóváhagyott A-terv): név display-betűvel → település-alsor vékony
   léniák közt → link-sáv, középre zárva a lap tetején. Jelenlét = pozíció + levegő + léniák,
   ⛔ NEM betűméret.
2. **Motor-szinten, EGY közös primitívből** (`src/engine/templateKit.ts`:
   `mastheadHtml`/`mastheadCss`, `--mast-*` hangolók) — nem sablononkénti másolat. 14 sablon
   állt át (editorial + card-sidebar már névvel vezetett).
3. **Sablon-dialektus kötelező:** a szerkezet közös, a hang a sablopné (brutalism nyers
   uppercase + tömör vonalak, artdeco réz + rombusz, scrapbook kézírásos place-sor, stb.).
4. **A név EGYSZER él az első képernyőn:** a régi sarok-brand sáv csak görgetett állapotban
   úszik be, vagy törölve (a masthead maga a fejléc).
5. **Overlay/flow mód:** fotós hero-tető = fehér tinta + erősített felső scrim, a hero-szöveg
   lejjebb (a fotó teteje a névé); szolid tető = lap-tinta, folyamban.
6. A **nyelvváltó-chip elsődlegesen a masthead link-sávjába** szövődik (multilangCore) — az első
   `<nav>` most a rejtett görgetett sáv lenne, oda szőve a chip takarásba kerül (a
   láthatóság-őr fogta el, 32/32 eset zöld lett).

**Kontraktus-fájl:** `assets/design-refs/engine/name-masthead/` (jóváhagyott HTML + README).
**Sweep-hám:** `scripts/masthead-sweep.mts` — egy lead persistált inputja MINDEN sablonon át,
vizuális ítélethez. Mind a 14×2 első képernyő képen ellenőrizve.

**Ugyanennek a napnak a hibajavítása (üres MMS-kép):** a portál-fotóhost a szó szerinti
`HeadlessChrome` UA-tokent 429-eli → a hero-shot fotó nélkül renderelt, és az ellenőrizetlen
üres kép MMS-ben kiment. Javítás (`src/outreach/heroShot.ts`): (a) first-screen
kép-verifikáció — törött képpel NINCS shot (retry után null, a pár-küldés hangosan megáll);
(b) becsületes `citoviso-bot` UA a shot-renderben és a `ui-shot.mts`-ben (politeness-elv: nem
játszunk böngészőt — és épp ez kap 200-at); (c) hostonként sorosított képkérés; (d) cache-bump
v3→v4 (a mérgezett üres shotok kiszolgálhatatlanok). Piros/zöld önteszttel igazolva.
