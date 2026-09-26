# 2026-09-26 — Mobil · vendég-nézet 2: a FK-009 átadott tételei a mock-motorban (fejléc, Foglalás-sáv, Google-fotó méret, marquee) + egy lead 19 stílusa

**Brief:** `~/rc-briefs/mobil-vendeg-nezet-2-brief.md` (szülő: `cite8fb512d`). Előzmény: FK-010 (vendég-szál, ADR-0235) és
FK-009 (lead-szál) ma zárultak; ez a szál a lead-szál által a motornak átadott 4 tételt viszi, majd egy tetszőleges lead mind
a 19 stílusát generálja. Tulajdonosi mandátum: *„saját belátásuk szerint … utólag ellenőrzök”*; vezérelv: a 390 px-es KÉP.
ADR: `ADR-0237` (a telefonos fejléc, a Foglalás-sáv és a Google-fotó mérete a mock-motorban).

## Mérés ELŐBB (a 38 élő mock, 390 px, saját próba: `scratchpad/probe390.mts`)

- Masthead (`.cit-mast`, 14 sablon): **129–200 px**, a név alja 67–137, a link-sáv alja 148–222; a főcím teteje 200–474.
  A 5 masthead nélküli sablon (arch-frames, card-sidebar, editorial, tilted-gallery, wordmark-grow) saját fejléce marad.
- Foglalás-sáv szövege: 2 sor 11 sablonban (64–75 px-es sáv), **3 sor a transiton (99 px)**; a dopamine 1 sor.
- A főcím a mock-fájlban 0/38-ban van rögzített réteg mögött (a FK-009 első köre a 160 px-es süti-sáv + 107–127 px-es
  keret-sáv mellett mérte — azóta a testvér-szál B első képernyője a sütit halasztja, a keretet 77 px-re szorítja).
- Brutalism: a mock-fájl **390/390** (360/360) animációval és anélkül; elszigetelt próba: a marquee `overflow:hidden`
  nélkül 1 560 px-re szélesít, vele 390 → a sablon tartja; a FK-009 515/780 px-e a 12-fotós galéria volt (FK-010 javította).
- Fotó: minden hero `lh3…=s4800-w1200` (1200×1200, 553 KB); egy Laguna-fotó **780×800-as JPEG 2 034 KB** (Google nem
  nagyít, de a JPEG minősége irreális). Google tiszteli a méret-utótagot (`=w480` 121 KB) és a `-rw` WebP-t (320 / 86 KB).
  Portál-fotók (hovamenjek `/main/`·`/galleryMiddle/`·`/gallery/`, lake-balaton.com `OriginalPhoto`, apartman.hu) —
  nincs dokumentált méret-paraméter.

## §2b vázlat → C (a valódi motorból, `assets/design-refs/_drafts/masthead-phone/build.mts`)

Három változat, 5 sablon (2 overlay + 3 flow), iframe-cellák (a sablon `@media`-i a cella szélességére sülnek el), méret-váltó.
A/B/C masthead 390-en: fullbleed 148/125/**69**, dark-luxury 148/126/**70**, transit 171/148/**96**, brutalism 155/136/**84**,
artdeco 155/140/140. Asztalon azonos (artdeco 0 eltérő px). **C** választva — indok a kontraktusban:
`assets/design-refs/engine/name-masthead/phone/README.md` (+ `shots/`, a regenerálható `build.mts`).

## Motor (landolt)

1. `templateKit.ts`: `mastheadHtml({ phoneBar })` → `data-cit-mast-bar`; `mastheadCss` telefonos blokk C
   (`@media (max-width:720px),(max-height:500px)` — a tartás nem szélesség): pirula-csík (`--mast-chip`), sávos sablonon
   nincs link-sáv, overlay léniák ki, szűkebb levegő. `mobCtaStat()` + `MOBCTA_CSS` (érték nagyban + felirat egy sorban).
2. 14 sablon: `phoneBar: true` + közös sáv-felirat (12 sablon saját másolata helyett; dopamine marad). **artdeco és
   claymorphism ÚJ telefonos sávot kapott** (`.ad-mobcta`, `.cl-mobcta`) — a pirulás fejlécük 169/180 px maradt volna a
   2-soros névvel; a sáv gombja `min-width:124px` (a pirula-elhelyező 100 px alatt nem kerüli — 97 px-en ráült, mérve).
3. transit főcím telefonon 32 px / .01em (7 → 5 sor).
4. `render.ts` `responsiveGooglePhotos()` a `finish` lépésben (mindkét render-út): lh3 `<img>` → `srcset` 480/800/1200 `-rw`
   + `sizes` (hero `100vw`, más `auto, (max-width:560px) 100vw, 50vw`); inline háttér-hero → `data-cit-bg` +
   `--cit-bg-{s,m,l}` + `<style data-cit-bgset>` (≤480: image-set 1x/2x/3x). A `src` az eredeti URL. Park-sweep:
   34 fotó × 3 méret = 102/102 `200 image/webp`. Chromium 390@2x: hero `=w800-rw` (volt 1200), 1280@1x `=w1200-rw`.
5. Brutalism marquee: NEM változott (mérve rendben).

## Mérés UTÁNA (38 újrarenderelt mock + a kiküldött /p/ lap)

- Masthead 390: **62–128 px** (volt 129–200); főcím teteje: transit 256→181, brutalism 276→205, watercolor 305→220,
  dopamine 253→177, aurora 200→133; overlay sablonokon a fotó kap +79 px. Fekvő (844×390): masthead 62–128.
- Sáv: 64–75 px (volt 64–99), a felirat 1+1 sor mindenhol. Transit főcím 7→5 sor (Tihany), 5→4 (Laguna).
- Asztal 1280 (képek blokkolva, motion reduce): 6 sablon geometriája azonos (mast/h1/doc), png 5/6 azonos (fullbleed: Ken Burns).
- Kiküldött /p/ lap (saját konzol a munkafából, 38 link × 390 + fekvő = 76 nézet): **a főcím 0/38-ban rögzített réteg
  mögött 390-en**; a hero-gomb 1/38-ban a lap saját sávja alatt (Laguna brutalism, egy görgetéssel szabad); fekvőn a
  dark-luxury főcím első sora a masthead alatt (min-height 640 hero) és a tilted-gallery sávja a főcím utolsó során — a
  FK-010 fekvő mérésében is így volt, NEM ennek a körnek a tétele (nyitva).
- Kapuk: `guest-mobile-check` kapu-mód 30 sablon+archetípus 390: **0 HIBA**; `--selftest` 7 ültetett hiba piros (2 új);
  fájl-mód a 38 újrarenderelt mockon 390/360/fekvő (114 lap-nézet): **0 HIBA**, 293 ergonómiai lelet (a széles
  körben ismert osztályok: szövegközi linkek, a 2. lépés távolsága fekvőn) — az egyetlen HIBA-jelölt (Tihany brutalism
  @360: a hero-gomb a lap SAJÁT sávjának `<b>`-je alatt) az őr „saját sáv” felismerőjének hiánya volt: a fixed ős
  foglalás-linkjét is nézi mostantól → ERGONÓMIA, ahogy a szabály szánta; `mobile-sticky-check` 30/30; `lead-mobile-check --gate --selftest` zöld;
  `photo-srcset-check` 16/16 + negatív kontroll; design-token-lint, i18n-lint tiszta.

## Őrök

- `guest-mobile-check`: ②fejléc-blokk (masthead > 150 px = HIBA) és ⑤sáv-felirat (a sáv `b`/`small` > 1 sor = HIBA);
  önteszt fullbleed-en (az editorialnak nincs masthead-je, sem sávja). ⚠️ A 120 px-es ültetett padding **149 px-et** mért
  — EGY px-re a küszöbtől → 200 px (memória: barely passing value). A fixture értékelés-felirata mostantól a termék valódi
  alakja („Google-értékelés · 1 892 vélemény”).
- ÚJ `scripts/photo-srcset-check.mts` (tiszta, hálózat nélkül; ①–⑦; a visszabontott lap piros), pre-commit:
  `render.ts` / sablon / saját fájl érintésére.

## Csapdák (a következő szálnak)

- A `page.evaluate(() => …)` tsx alatt `__name is not defined`-dal hal meg, ha az arrow belsejében nevesített
  segédfüggvény van — a próbák STRING-ként mennek be (ahogy a guest-mobile-check is teszi).
- A pirula-elhelyező (`cit-configurator.js` `blockingRects`) a < 100 px széles gombot nem tekinti elsődlegesnek: egy 97 px-es
  „Foglalás” fölé nem emelkedik. Egy sáv-gomb legyen ≥ 100 px (min-width), különben a pirula ráül.
- A `-rw` (WebP) és a `=wN` utótag a Google URL-paraméterezése — a `photo-srcset-check` NEM méri a hálózatot; a 102/102
  egyszeri, dátumozott sweep (2026-09-26).
- Az `=s4800-wN` alakú Google-URL-eknél `N` NEM a valódi szélesség (a 780×800-as feltöltést Google nem nagyítja) — a
  `=w1200` kérés 780-at ad vissza, 2 MB-ban; a súlyt a WebP viszi le, nem a méret.

## ② Egy tetszőleges lead mind a 19 stílusa — **Alig-vár Tanya** (Salföld, Káli-medence)

**Miért ez:** `no_site`, mock nélkül, 10 Places-fotó, elfogadott e-mail, 2 listing (kali.hu, szallas.hu); TANYA-típus
(a három 19-es lead: ifjúsági szállás, panzió, villa) és nem tóparti (Tihany/Szántód/Zamárdi után). Nem Elek-teszt lead, nem
vevő. ⛔ Semmi nem ment ki (e-mail/SMS/MMS), prospect nem készült.
**Hogyan:** a fő fából (`~/citoviso`, main = `8082672a`), a konzol saját útján — `generateEngineMock(loaded, undefined,
{ template })` sorban mind a 19 `TEMPLATES`-kulcsra + `ensureHeroShot` (scratch-szkript, nem a repóban). 19/19 ✓,
`recipeSource=template`, 6 fotó, dizájn PASS, kép OK; **AI-költség $5,72** (19 × $0,30 átlag; 42–87 s/mock). A tényhűség-őr
18/19-en FLAG → kurátor-sor (forrástalan „Ingyenes Wi-Fi”, „Érkezés 14:00” stb. — a szokásos mock-generálási állapot, a
kurátor dönt), a marketing-őr több sablonon egyszer újrageneráltatott (építőanyag/berendezés a főcímben).
**Elérés:** `mock_artifact.path` = `mock-alig-var-tanya-<stílus>-<id>.html`, mind a 19 fájl a fő fában (0 hiányzik); a
:4600 `/lead/46f8b0ae-c5a6-4e52-8594-b59690660703` lead-lapja és a `/mock/<id>` előnézet bejelentkezés után (303 → /login
belépés nélkül, ezért a fájl-lét ellenőrizve a kiszolgált útvonalon).
**Mérés a 19 friss mockon (a javított motor + friss AI-tervezés):** masthead 390-en 62–128 px (14 sablon), sáv 64–75 px,
`srcset` 19/19, a lap 390 px széles 19/19; brutalism főcím 6 sor (nagybetűs, hosszú AI-főcím).
Tabló: `wow-alig-var-tanya-19-stilus-390.png` (elküldve) + a legjobb 3 (fullbleed, horizontal, cinematic) és a leggyengébb 3
(brutalism, wordmark-grow, aurora) külön.
**Wow-ítélet (390, első képernyő):** ★★★ fullbleed, dark-luxury, horizontal, cinematic, parallax (a lombkorona-fotó + név +
főcím + gomb egy képernyőn); ★★ editorial (újság, fotó + idézet), card-sidebar (app-szerű, de két „Foglalás” gomb), transit
(fotó a lap alján), organic/watercolor/claymorphism (fotó csak a hajtás alján), artdeco, scrapbook, dopamine, tilted-gallery,
arch-frames; ★ brutalism (nincs fotó a hajtás fölött, 6 soros verzál), wordmark-grow (a név apró a lap alján, fölül sötét lomb),
aurora (a fotó félig lóg be, a sávban csak „★ 4,4”).
**`guest-mobile-check` fájl-mód a 19 friss mockon, 390/360/fekvő (57 lap-nézet): 0 HIBA**, 147 ergonómiai lelet (a
szokásos osztályok: szövegközi linkek, a 2. lépés távolsága fekvőn, a hero-gomb a lap saját sávja alatt egy görgetésre).
**Elek FK-010 a 19 fájlon** (`run-guest-mobile.mts`, 2 párhuzamos runner, telefon-kontextus): **19/19 pass, 0 fail, 0 blocked**
(323 manuális/vizuális lépés) — mátrix `elek/runs/FK-010-matrix-2026-09-26T15-51-17/` (nem commitolt bizonyíték).

**Fekvő regresszió (a saját javításom mellékterméke, a 19-es 3 nézetes mérés fogta meg):** a masthead-sáv elrejtését a
`max-height:500px` ágra is kötöttem, de a sablonok rögzített sávja csak `≤700 px` szélességen él → fekvőn 12 sablonban NEM
volt CTA az első képernyőn (②CTA-hajtás 12×@land). Javítva: az elrejtés csak `≤700 px`-en; fekvőn a pirula marad, a név
22 px; a telefonos szabály `.cit-mast.cit-mast` (a sablon-dialektus `padding-top`-ja erősebb volt: claymorphism 180,
scrapbook 159, dopamine 151 fekvőn), a claymorphism pöttye fekvőn eltűnik, a scrapbook kézírásos sora 16 px → fekvő masthead
108–144 px (57 mock), 390-en változatlan 62–128.

## Őr-javítás a szülő session kérésére (2026-09-26 este, a 19-es kör után)

A szülő a landolt ADR-0237 motoron saját fából ellenőrzött: guest-mobile önteszt 7/7 + kapu 0 HIBA, mobile-sticky 30/30, DE a
`lead-mobile-check --gate` egy lapon piros (organic@390 R6: „console: Failed to load resource: net::ERR_FAILED”) — az én
generálásom közben, terhelés alatt; egyedül újrafuttatva ZÖLD (6/6 visszarontás piros). **Mechanizmus:** a
`page.on("console")` ágban a harmadik-fél szűrő `m.text()`-en futott, de a Chromium erőforrás-hiba szövegében NINCS URL (az
`m.location().url`-ben van) → egy külső fotó/font/térkép hálózati bukása JS-hibaként buktatta a kaput, ami a sablon-trigger
miatt minden sablon-commitot törékennyé tett. **Javítás:** a szűrő az `m.location()?.url`-re is köt; a „Failed to load
resource”/`net::ERR_` a `weight.failed` listába megy (GYANÚ), kivéve a saját origin erőforrásait (azok JS-hibák maradnak);
két új negatív kontroll a `--gate --selftest`-ben: ültetett SAJÁT `throw` → R6 piros; ültetett KÜLSŐ kép 404 (az
interceptor válaszol 404-gyel, hálózat nélkül) → R6 zöld, a bukás a sikertelen kérések közt. 8/8 visszarontás piros.

## Session lezárva (2026-09-26 este, fa: `~/wt/cita94801d0`)

- Landolt: `9884986e` + `8082672a` (ADR-0237 kiosztás) → a motor (①); `34ccb5c9` (fekvő javítás + lead-mobile-check őr) + `8fb2d8fd`
  (MEMORY.md) — `origin/main` igazoltan tartalmazza (IGAZOLTAN FENT). Semmi nem ment élesre (csak a nagy deployjal, tulaj 2026-09-25).
- Az 57 élő mock (Alig-vár Tanya, Tihany, Laguna) a fő fában `rerender-mock`-kal a végleges motorra frissítve (42 fájl viseli a
  `data-cit-mast-bar`-t = 14 masthead-es sablon × 3 lead; 19 Alig-vár fájl srcset-tel).
- Nem commitolt bizonyíték: `elek/runs/FK-010-matrix-2026-09-26T15-51-17/` (19/19 pass), a tabló és a 390-es képek a session
  scratchpadjában (elküldve a tulajnak).
- **Nyitva:** a tulaj utólagos ítélete (tabló); fekvőn dark-luxury főcím a masthead alatt + tilted-gallery sáv a főcím utolsó
  során (nem ennek a körnek a tétele); brutalism / wordmark-grow / aurora első képernyője a leggyengébb; a Google-térkép
  bootstrap-hibájának szűrése terhelés alatt mért, egyedül nem reprodukált (nem bizonyított javítás); a `-rw`/`=wN` Google
  paraméter egyszeri sweep-pel igazolt.

