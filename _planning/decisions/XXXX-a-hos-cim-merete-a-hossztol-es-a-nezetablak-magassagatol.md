## ADR-XXXX — A hős-cím mérete a SZÖVEG HOSSZÁTÓL és a nézetablak MAGASSÁGÁTÓL is függ, egy közös szabállyal (2026-09-30)

**Kontextus — mérve.** A tulaj a 19 skint legenerálta egy leadre élesen („[TESZT] Muschel Panzió”), és
laptopon nézve: „nagyon gáz! sok mocknál a szöveg kinyírja az oldalt. Extrém nagy a szöveg.” A hős-`<h1>`
a lead EGYEDI mondata (50–78 karakter, 8–11 szó), a 19 sablon mindegyike viszont saját, CSAK szélesség-
függő `clamp()`-pal méretezte (pl. dark-luxury `clamp(42px,7vw,86px)`), amit egy 3 szavas névre hangoltak.
A tulaj képe egy 150%-ra skálázott laptop: ~1320×570 CSS px — a szélesség-tag a plafonon áll, a magasság
kicsi. Ezen a méreten mérve (Playwright, a 19 élő mock HTML-je): dark-luxury a cím 137 px-szel a lap
teteje fölé lógott és a nav-ra futott, horizontal 8 sorral 342 px-szel, cinematic/parallax a fejlécet
fedte, transit/brutalism/artdeco/dopamine a teljes első képernyőt kitöltötte (előtte 23 hibás
skin×méret a 76-ból, utána 1 — az is nem-betűméret: watercolor, lásd lent). 1920×960-on és mobilon a
legtöbb skin rendben volt — a hiba a RÖVID nézetablak. Az élesen maradt TÖBBI 28 mock (10 lead, ≤ 09-24)
címe rövid (20–41 karakter), azokon a mai éles állapotban 0 hiba; a mai motorral újrarenderelve viszont
a dark-luxury egy 30 karakteres címmel is a nav-ra futott (lásd 4.) — utána 0.

**Döntés.**
1. A hős-cím szerepe NEM változik (a mondat marad a `h1`-ben, a név a fejlécben) — ez tisztán méret-hiba.
2. EGY szabály, egy helyen (`templateKit.ts` `heroFit()` + `HERO_FIT_CSS`): a cím látható hossza sávot ad
   (`s` ≤ 28 · `m` ≤ 48 · `l` ≤ 72 · `xl` > 72 karakter → `data-cit-hero-fit`), a sáv a nézetablak
   MAGASSÁGÁHOZ kötött plafont (`--cit-hero-cap`, pl. `l`: `max(28px,7.5vh)`), a hosszú sávok egy csak
   telefonon harapó szélesség-tagot is (`l`: `max(30px,9vw)`). A sablon SAJÁT clamp-je marad, csak
   `min(<clamp>, var(--cit-hero-cap,999px))`-be burkolva — magas asztalon a skin mérete változatlan.
3. A címet néhány `ch`-ra szűkítő sablon (dark-luxury 14ch, parallax/cinematic 16ch) hosszú mondatnál
   szélesebb sort kap (`--cit-hero-measure`: 22ch/24ch): a keskenyítés sort szült, nem kicsinyített.
4. Ráúszó fejléc + alulra igazított hős (dark-luxury, horizontal, cinematic): alacsony asztalon
   (`min-width:701px`, `501–760px` magasság) a fejléc beáll a folyásba és a hős a tartalommal nő — ugyanaz
   a geometria, ami fekvő telefonra már élt, a betűméret-rész nélkül. Enélkül egy KÖZEPES (30 karakteres)
   cím is a nav-ra futott (élő „Panzió” dark-luxury, újrarenderelve). Parallax: a hős `padding-top:140px`-e
   kisebb volt, mint a fejléc (163 px); alacsony asztalon (`min-width:901px and max-height:760px`) 190 px.
5. Őr: `scripts/hero-fit-check.mts` (pre-commit, sablon/kit/skin/render változásra) — mind a 19 sablon
   egy 93 és egy 30 karakteres címmel, 1320×570 · 1366×650 · 1920×960 · 390×844: a cím sorai nem metszik a
   fejléc szövegét, nem lógnak a lap fölé/jobbra, ≤ 60% képernyő, ≤ 7 sor (mobilon 8). Beépített negatív
   kontroll: attribútum nélkül (a régi méretezés) BUKNIA kell, különben az őr vak.

**Nem oldja meg.** watercolor 1320×570-en: a folyásban álló fejléc + cím-chip 380 px-et visz, a (már 3
soros, 43 px-es) cím utolsó sora a hajtás alá esik — elrendezés-kérdés, nem betűméret; nem nyúltam hozzá.
A már legenerált mockok statikus pillanatképek: az élőkre a javítás csak újrarendereléssel ér ki
(`scripts/rerender-mock.mts`), a deploy után.
