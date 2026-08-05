# 2026-08-05 — A MINŐSÉGI PLAFON ÁTTÖRVE: az 5 referencia-mock ART DIRECTION archetípusként

## A kiváltó ok (tulaj-verdikt)

Három friss motor-mock (Rózsakő ház, Óbester Panzió, Wild Boar Cottage) után a tulaj:

> „rettentőek most is... ez így nem fog menni"
> „mind ugyanaz. semmi valós design érzet, csak egymás után dobálva a modulok,
>  ez nagy bukta lesz így..."
> „eddig amiatt az egész projekt halálra van ítélve"

**A diagnózis igazolta a kritikát** (nem ízlés-kérdés volt):

1. **Nem regresszió — plafon.** A mai Rózsakő-mock STRUKTURÁLISAN azonos volt a
   2026-07-26-i mintával (`sample-balaton-rozsako-haz.html`), amire a tulaj akkor azt
   mondta: „sokkal jobb". Az ADR-0019 copywriter+mozgás fix a SZAVAKAT és az
   ANIMÁCIÓT javította — a DIZÁJNT nem. A plafon maradt.
2. **A vád szó szerint igaz volt technikailag is.** Az archetípus-réteg addig csak
   sorrend/rács-séma volt ugyanabból a vékony blokk-készletből; a skin fix
   token-preset. Bizonyíték: a dizájn-őr kimérte, hogy az Óbester és a Wild Boar
   (mindkettő `stone-masonry`) **byte-ra azonos palettát** kapott.
3. **A repo saját mércéje ezt 2026-07-23 óta leírta**
   (`assets/design-refs/reference-quality/README.md`): *„a sokszínűséget optimalizáltuk,
   nem az alap kraftot"* — a „hátralévő terv" (gazdag szekció-készlet) félig maradt.

## A döntés

A tulaj 5 jóváhagyott referencia-mockja **TELJES art directionként** beportolva a
motorba. Nem új stratégia és nem új motor (ADR-0016/0019 érintetlen: kompozíciós
motor, `mock=live`, §I) — a meglévő terv végigvitele: nem új dizájnt találunk ki,
hanem a bizonyítottan „wow" oldalakat emeljük át a mock=live motorba.

**A régi 6 archetípus sorsa (tulaj-kérdés: „minden archetípust újra kell gondolni?"):**
a régi 5 rács-séma NYUGDÍJAZVA (`retired: true`) — a tervező nem választhatja, de a
registryben MARAD, mert a perzisztált receptek örökre újra-renderelhetők kell
maradjanak (mock=live). A `stacked` semleges technikai tartalék. Precedens: a
2026-07-16-i korpusz-karantén (`retired` a manifestben).

## Az 5 art direction (mind referencia-portból)

| id | forrás-referencia | karakter | szignatúra |
|---|---|---|---|
| `fullbleed-glass` | 01 (Azúr Part) | boutique prémium | ÜVEG foglaló-sáv a hero alján, mozaik-galéria |
| `dark-luxury` | 03 (Silva) | csendes, cinematic | tömör foglaló-panel, vízszintes suite-scroll, egy nagy idézet |
| `card-sidebar` | 04 (Diófa) | ismerős hirdetés-oldal | mozaik-fejléc, RAGADÓS foglaló-kártya |
| `editorial-press` | 05 (Kékfestő) | nyomtatott újság | masthead, dropcap-vezércikk, szelvény-foglaló, polaroid-galéria |
| `immersive-parallax` | 06 (Nordwand) | sportos, panorámás | parallax panelek, ragadós sötét dokk, pont-nav |

## Új motor-mechanizmusok (mind determinisztikus → mock=live sértetlen)

- **`Archetype.preferredVariants`** — az art direction MAGÁVAL hozza a hozzá tartozó
  szekció-változatokat (nem az AI szeszélyén múlik). Explicit érvényes AI-választás
  mindig nyer.
- **`Archetype.navLinks`** — az arrange() `cit-sec-<kind>` horgonyokat rak, a chrome
  nav ezekre rendereli a szekció-linkeket.
- **`Archetype.skinAffinity`** — melyik tonalitásra tervezték (sötét kompozíció ne
  kapjon világos skint). Tanácsadó, nem felülíró; kurátor-eszközök használják.
- **`Archetype.retired`** — nem választható, de renderelhető.
- **`planner.withArchetype(recipe, arch, data)`** — meglévő recept átirányítása másik
  art directionre (a régi variánsok lecsupaszítva, hogy az új párok érvényesüljenek).
- **14 új primitív-variáns** + ÚJ `location` szekció-fajta (térkép-facade + kapcsolat-
  kártya) + ÚJ `alpine-bold` skin.
- CLI: `engine-generate.ts --archetype= --skin=` (kurátor/demo felülbírálás).

## ÚJ ESZKÖZ: `scripts/engine-matrix.ts` (art-direction kontakt-lap)

`npx tsx scripts/engine-matrix.ts <lead> [<lead> …]` → 1 lead × N art direction.

**A trükk, amiért fontos:** az AI-lépések (brief + planner + copywriter) leadenként
**EGYSZER** futnak; a többi lap ugyanannak a perzisztált receptnek a determinisztikus
újrarenderelése. Ezért:
- a lap egyben a **mock=live bizonyítéka** (soronként AZONOS szöveg/tény/fotó, csak a
  kompozíció változik),
- és ~5× olcsóbb, mint archetípusonként újragenerálni.

## Elkapott VALÓS hibák (a verifikációs körökből)

1. **Dupla kártya (minden archetípus):** a runtime kártya-stílusú widgetet hidratált az
   archetípus konténerén BELÜLRE → a `bar` variánsban a widget saját kerete leszedve.
2. **Olvashatatlan márkanév:** a parallax fix navjának fehér szövege eltűnt a világos
   dokk fölött → gradiens-scrim + a dokk hidratálás után is sötét marad.
3. **Kontraszt:** akcent-hátterű vélemény-sávon az akcent-színű kiemelt szó láthatatlan.
4. **Cirill homoglyph** az AI-copyban („saroktеraszon", U+0435) → `fixHomoglyphs()` a
   brief-szövegre. (A tényhűség-őr fogta el.)
5. **Halott fő-CTA:** „Kapcsolat hamarosan" a legexponáltabb helyen → mailto→tel→disabled
   CTA-létra (telefonos leadnek is működő akció).
6. **⚠️ TOOL-HIBA, nem mock-hiba:** `engine-shot.ts` nem görget capture előtt → a
   scroll-reveal tartalom ÜRESNEK látszott a full-page képeken. A mockok jók voltak,
   a tool torzított. (Ugyanígy: a `background-attachment: fixed` parallax-panelek nem
   rajzolódnak full-page capture-ben — viewport-felvétellel verifikálva.)

## Verifikáció

- **4 kvalifikált lead × 5 art direction = 20 oldal** (Balaton-ko hostel 3,8★/10 ·
  Óbester Panzió 4,9★/218 · Tomaj Camping 4,6★/1364 · Wild Boar Cottage 5★/37).
- Mind a 20-on: dizájn-kapu PASS · round-trip AZONOS · 11 `--cit-*` token · 0 emoji ·
  minta-modulok jelölve · AI-copy címekben NINCS nem-forrásolt szám (az egyetlen szám
  a vélemény-sáv fejcíme = valós Google-rating, forrás-ellenőrizve).
- `tsc` tiszta. Kimenet: `sites/_engine-proof/matrix/` (gitignorált).

**Tulaj-verdikt a 2. körre:** „Oké, ez most meggyőzőbb."

## ⚠️ NYITOTT — kiküldés előtt KÖTELEZŐ

- **Az őrök ítélet-igényű köre a 20 mockra NEM futott le** (session-limit). A
  determinisztikus rész igen. A `tenyhuseg-or` + `dizajn-doktrina-or` hívása
  outreach-kiküldés előtt kötelező — épp az „Óbester vályogfal"-típusú fabrikációt
  fogja el, amit a gépi szűrő nem lát.
- **Demo-framing lábléc** (§A.12): az outreach-mock láblécében ma „© <név> — Minden jog
  fenntartva" áll; a jog-őr korábban jelezte.
- **Mobil burger-menü**: 900px alatt nincs szekció-navigáció (a tulaj telefonról néz).
- **Fotó-derivált per-szállás paletta (§B.6)**: az utolsó strukturális „mind ugyanaz"
  rés — két azonos archetípusú szállás ma azonos színvilágot kap. **Ez a javasolt
  következő szelet.**

## Módosított/létrehozott fájlok

- `src/engine/{archetypes,primitives,skins,planner,chrome,icons,recipe,render,copywriter}.ts`
- `src/generator/generateEngine.ts`
- `scripts/engine-matrix.ts` (ÚJ) · `scripts/{engine-generate,engine-archetypes}.ts`
- `.gitignore` (assets/Temp/ = a tulaj bedobó-mappája, nem commitolandó)
- Commit: `e0614dd`
