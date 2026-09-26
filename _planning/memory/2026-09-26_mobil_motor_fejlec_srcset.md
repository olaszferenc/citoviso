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

## ② Egy tetszőleges lead mind a 19 stílusa

→ ezen a jegyzeten belül folytatva a landolás UTÁN (lásd lent).
