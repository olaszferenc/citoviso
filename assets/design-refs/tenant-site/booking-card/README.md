# KONTRAKTUS — Foglalás-sáv kártyaként, EGY közös szabállyal (arch-frames · tilted-gallery · wordmark-grow)

**Jóváhagyta:** a tulaj, 2026-10-04 (§2b; a koordináló session szó szerint hozta: „A”) ·
**Változat:** **A — közös kártya** (a B — sablononkénti kézjegy — elvetve) ·
**Terv:** `plan.html` (önhordó; a valódi Mandula vendégház 20 fotós mock-renderje, sablon-, változat- és méretváltóval) ·
**Képek:** `terv-{arch-frames,tilted-gallery}-{asztali,mobil}.png` (Ma / A / B), `megvalositva.png` (a kód utáni render,
mindhárom sablon, mindkét méret), `meres-21-sablon-{asztali,mobil}.png` (a mai sáv mind a 21 sablonban) ·
**Hatókör:** `src/engine/templateKit.ts` · `src/engine/templates/archFrames.ts` · `src/engine/templates/tiltedGallery.ts` ·
`src/engine/templates/wordmarkGrow.ts` · `scripts/booking-card-check.mts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.

## Miért

A tulaj (2026-10-04): „Kell-e külön kör az arch-frames és a tilted-gallery formázatlan »Szabad időpontok« sávjára?” —
„1. Igen kell”. Utána, a terv alapján: „A”.

Mérve (render, mind a 21 sablon, 390 és 1440 px): a közös `bookingSlot()` vékony sávjának stílusa (`ENQUIRY_BAR_CSS`)
csak a régi sablonokba jut be. Az arch-frames és a tilted-gallery a sávot csupaszon tette le: a „Foglalás” felirat és a
gomb formázatlanul x=0-n tapadt, a sáv közvetlenül a teljes „Foglalás” naptár fölött állt (két „Foglalás” egymás alatt,
a gomb a közvetlenül alatta lévő szakaszra ugrott). A másik 19 sablonban a sáv a sablon saját konténerében ül.

## KÖT

1. **Egy szabály:** a kártya CSS-e EGY helyen él, `templateKit.ts` → `bookingCardCss(tpl, sectionPad)`, a hívó sablon
   body-osztályára szűkítve; színt, betűt, felületet CSAK a `--cit-*` tokenekből vesz, így minden sablon a saját bőrében
   rajzolja. Sablononkénti másolat tilos — a sablon csak a sáv saját térközét (`sectionPad`) adja meg.
2. **Betűre a Névből növő B kártyája** (`../wordmark-grow-b/`): a tartalom szélességében (`min(1140px, 88vw)`, középen),
   20 px lekerekítés, felület-háttér, vékony keret, lágy árnyék; asztalon a felirat balra, a gomb jobbra, egy sorban;
   640 px alatt egymás alatt, középre zárva, a gomb a kártya teljes tartalom-szélességében.
3. **A Névből növő is a közös szabályon áll**, látványváltozás nélkül (mérve: a sáv számított stílusa és doboza 390 és
   1440 px-en az átállás előtt és után bájtra azonos).
4. **Hely:** foglalási felülettel (élő foglalás-modul vagy mock-demó) a sáv **közvetlenül a Képek (gallery-modul) után**
   áll; a teljes naptár a lap végén, a saját „Foglalás” szakaszában marad. A gomb a naptárhoz (`#cit-booking`) visz.
5. **Foglalási felület nélkül** (érdeklődés-sáv, `data-cit-variant="bar"`) a sáv a régi helyén és a közös elrendezésben
   marad — ezt a kontraktus nem érinti.
6. A menü „Foglalás” linkje (`#cit-enquiry`) a kártyára visz, ahogy a jóváhagyott Névből növő B-ben (a tulaj erről
   külön nem döntött; változatlanul hagyva).

## Eltérés a tervtől (szándékos)

A `plan.html` A változatában a kártya címe `line-height: 1.15`-öt visel; a kód a tulaj szava szerint „betűre a Névből
növő B” szabályát viszi, abban nincs ilyen sor — a cím így 390 px-en ~14 px-szel, asztalon ~20 px-szel magasabb sort kap.
Minden más doboz (kártya, felirat, gomb) pixelre egyezik a tervvel.

## Nem a kontraktus része (mellék-leletek, a tulaj nem döntött róluk)

- **walk-through:** a formázott sáv közvetlenül a nagy „Foglalás” cím fölött áll (a cím kétszer).
- **artdeco:** a konténer címe és a sáv címe is „Foglalás”.
- ✅ **Javítva 2026-10-04** (tulaj: „javítsuk”): walk-through — a naptár előtti sáv belseje rejtve (a gate-opening
  szabálya); artdeco és (a 21-es mérésből) brutalism — a konténer címe marad, a sáv címe rejtve. Őr:
  `scripts/booking-title-stutter-check.mts` (mind a 21 sablon; két egymást követő „Foglalás” cím = piros).
  Képek a javítás után: `dupla-cim-javitva-{walk-through,artdeco,brutalism}-{asztali,mobil}.png`.
- **gate-opening** szándékosan rejti a sávot a naptár előtt (`:has(#cit-booking)`) — helyes.

## Mérés

`npx tsx scripts/booking-card-check.mts` (piros önteszt: `--self-test`) — arch-frames, tilted-gallery, wordmark-grow;
1280 és 390 px: a sáv a Képek után, kártya-forma, egy sor / egymás alatt, a gomb a naptárhoz visz, a lap nem szélesedik
ki, JS-hiba 0; foglalás nélkül az érdeklődés-sáv a régi helyén.
