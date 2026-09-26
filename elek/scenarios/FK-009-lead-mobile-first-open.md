# FK-009 — A lead szemével, TELEFONON: a kiküldött honlap-terv ELSŐ megnyitása (19 stílus × 2 lead)

cél: A hideg levél / SMS / MMS linkjéről egy telefonon megnyíló honlap-terv az első három másodpercben elmondja, mi ez és kié, a szállás neve a hajtás fölött van, a lap a végéig hibátlanul görgethető, a vásárlói út egy hüvelykujjal elindítható, a leiratkozás és a jogi lábléc elérhető és olvasható — mind a 19 stílusban, két valódi szállás adatával.
felület: konzol
kontraktus: assets/design-refs/prospect-page/framing/README.md · kb/entries/console-outreach-draft/entry.hu.md

# ⚠️ Ez a kör NEM az ELEK-parkon mér: a 38 követett linket a `scripts/seed-elek-lead-mobile-links.mts`
# állítja elő (két dev-lead, mind a 19 stílus, KÜLDÉS NÉLKÜL), és a `run-all.mts` az így
# kapott `links.json`-ból tölti be a `${ELEK_P_<LEAD>_<STÍLUS>}` változókat. A gépi
# `várd:` 1280 px-en fut; a telefonos ítélet a runner 390 px-es képein ÉS a
# `scripts/lead-mobile-check.mts` friss-betöltéses (390 / 360 / fekvő 844×390) mérésén áll
# — az utóbbi méri a túlfolyást, a takarást, az érintési célt és a betöltési súlyt.
# ⛔ A „Leiratkozás"-ra NEM kattintunk: a GET is leiratkoztat, és a lánc többi köre a
# követett linken áll.

## Előkészítés

- [ ] A követett link névtelenül megnyílik, a lap kimondja, hogy ez egy terv, és ki készítette
  user: anon
  út: ${ELEK_P_TIHANY_ARTDECO}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Ez egy honlap-terv az Ön szállásáról."
  várd: látható "Miért kaptam?"
  adat: mérési session (megnyitás, FK-009)

## ① Az első képernyő — mind a 19 stílus, Ifjúsági Szállás Tihany

- [ ] artdeco — a szállás neve és a demó-keret az első képernyőn
  út: ${ELEK_P_TIHANY_ARTDECO}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen a felső sáv NEM nyomja a szállás nevét/fotóját a hajtás alá; a sáv + a süti-sáv együtt nem viszi el a képernyő felét; a pirula nem takar címet vagy gombot

- [ ] aurora
  út: ${ELEK_P_TIHANY_AURORA}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] brutalism
  út: ${ELEK_P_TIHANY_BRUTALISM}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] cinematic
  út: ${ELEK_P_TIHANY_CINEMATIC}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] claymorphism
  út: ${ELEK_P_TIHANY_CLAYMORPHISM}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] dopamine
  út: ${ELEK_P_TIHANY_DOPAMINE}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] editorial
  út: ${ELEK_P_TIHANY_EDITORIAL}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] arch-frames — nyitó-animáció NÉLKÜL kell nyílnia
  út: ${ELEK_P_TIHANY_ARCH_FRAMES}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen nincs teljes képernyős nyitó-overlay a sáv előtt

- [ ] fullbleed
  út: ${ELEK_P_TIHANY_FULLBLEED}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] tilted-gallery
  út: ${ELEK_P_TIHANY_TILTED_GALLERY}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] wordmark-grow — nyitó-animáció NÉLKÜL kell nyílnia
  út: ${ELEK_P_TIHANY_WORDMARK_GROW}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen nincs teljes képernyős nyitó-overlay a sáv előtt

- [ ] horizontal
  út: ${ELEK_P_TIHANY_HORIZONTAL}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] dark-luxury
  út: ${ELEK_P_TIHANY_DARK_LUXURY}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép) — a sötét keret-sáv elválik-e a sötét skintől

- [ ] organic
  út: ${ELEK_P_TIHANY_ORGANIC}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] parallax
  út: ${ELEK_P_TIHANY_PARALLAX}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] scrapbook
  út: ${ELEK_P_TIHANY_SCRAPBOOK}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] card-sidebar
  út: ${ELEK_P_TIHANY_CARD_SIDEBAR}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] transit
  út: ${ELEK_P_TIHANY_TRANSIT}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] watercolor
  út: ${ELEK_P_TIHANY_WATERCOLOR}
  várd: látható "Ifjúsági Szállás Tihany"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

## ① Az első képernyő — mind a 19 stílus, Laguna Panzió

- [ ] artdeco
  út: ${ELEK_P_LAGUNA_ARTDECO}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen a felső sáv NEM nyomja a szállás nevét/fotóját a hajtás alá; a sáv + a süti-sáv együtt nem viszi el a képernyő felét; a pirula nem takar címet vagy gombot

- [ ] aurora
  út: ${ELEK_P_LAGUNA_AURORA}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] brutalism
  út: ${ELEK_P_LAGUNA_BRUTALISM}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] cinematic
  út: ${ELEK_P_LAGUNA_CINEMATIC}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] claymorphism
  út: ${ELEK_P_LAGUNA_CLAYMORPHISM}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] dopamine
  út: ${ELEK_P_LAGUNA_DOPAMINE}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] editorial
  út: ${ELEK_P_LAGUNA_EDITORIAL}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] arch-frames — nyitó-animáció NÉLKÜL kell nyílnia
  út: ${ELEK_P_LAGUNA_ARCH_FRAMES}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen nincs teljes képernyős nyitó-overlay a sáv előtt

- [ ] fullbleed
  út: ${ELEK_P_LAGUNA_FULLBLEED}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] tilted-gallery
  út: ${ELEK_P_LAGUNA_TILTED_GALLERY}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] wordmark-grow — nyitó-animáció NÉLKÜL kell nyílnia
  út: ${ELEK_P_LAGUNA_WORDMARK_GROW}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: a 390 px-es képen nincs teljes képernyős nyitó-overlay a sáv előtt

- [ ] horizontal
  út: ${ELEK_P_LAGUNA_HORIZONTAL}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] dark-luxury
  út: ${ELEK_P_LAGUNA_DARK_LUXURY}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép) — a sötét keret-sáv elválik-e a sötét skintől

- [ ] organic
  út: ${ELEK_P_LAGUNA_ORGANIC}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] parallax
  út: ${ELEK_P_LAGUNA_PARALLAX}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] scrapbook
  út: ${ELEK_P_LAGUNA_SCRAPBOOK}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] card-sidebar
  út: ${ELEK_P_LAGUNA_CARD_SIDEBAR}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] transit
  út: ${ELEK_P_LAGUNA_TRANSIT}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

- [ ] watercolor
  út: ${ELEK_P_LAGUNA_WATERCOLOR}
  várd: látható "Laguna Panzió"
  várd: látható "Miért kaptam?"
  kézi: mint fent (390 px-es kép)

## ② Végiggörgetés a lap aljáig

- [ ] A lap a végéig hibátlan: nincs vízszintes túlfolyás, egymásra csúszó elem, levágott szöveg, láthatatlan gomb, takaró ragadó sáv
  út: ${ELEK_P_TIHANY_FULLBLEED}
  várd: látható "Ifjúsági Szállás Tihany"
  kézi: a teljes-lapos 390 px-es kép VÉGIG átnézendő; a ragadó/rögzített elemek takarását a runner képe NEM mutatja (a felvételhez kikapcsolja őket) — azt a `lead-mobile-check` viewport-képei bizonyítják (04-bottom)

- [ ] Ugyanez egy sötét és egy kéthasábos stíluson
  út: ${ELEK_P_LAGUNA_DARK_LUXURY}
  várd: látható "Laguna Panzió"
  kézi: a teljes-lapos 390 px-es kép végig átnézendő (levágott szöveg, egymásra csúszó blokk, üres sáv)

- [ ] …és a kártya-oldalsávos elrendezésen, ami asztalon kéthasábos
  út: ${ELEK_P_TIHANY_CARD_SIDEBAR}
  várd: látható "Ifjúsági Szállás Tihany"
  kézi: a 390 px-es képen az oldalsáv a tartalom ALÁ kerül-e, és nem tolja-e ki a lapot oldalra

## ③ A vásárlói út belépése

- [ ] A hívó pirula megtalálható és a konfigurátor első lapja megnyílik
  út: ${ELEK_P_TIHANY_ARTDECO}
  tedd: várj "Ez lehet az Öné" 6
  tedd: kattints ".cit-cfg-launch"
  várd: látható "Ez az Ön leendő weboldala"
  várd: látható "Tovább a megrendeléshez"
  kézi: a 390 px-es képen az alsó lap a képernyőn belül van-e, a fő gomb hüvelykujjal elérhető-e (alul, nem a süti-sáv alatt), és az első lap egy görgetéssel átlátható-e

- [ ] Ugyanez egy világos, képes stíluson
  út: ${ELEK_P_LAGUNA_WATERCOLOR}
  tedd: várj "Ez lehet az Öné" 6
  tedd: kattints ".cit-cfg-launch"
  várd: látható "Ez az Ön leendő weboldala"
  kézi: mint fent (390 px-es kép)

## ④ Leiratkozás + jogi lábléc

- [ ] A „Miért kaptam?" kinyílik, és a magyarázatban ott a két link
  út: ${ELEK_P_LAGUNA_ARTDECO}
  tedd: kattints "Miért kaptam?"
  várd: látható "jogos érdekű megkeresés"
  várd: látható "Adatkezelési tájékoztató"
  várd: látható "Leiratkozás"
  kézi: a kinyitott magyarázat 390 px-en elfér-e, olvasható-e (betűméret, kontraszt), a két link ujjal eltalálható-e

- [ ] Az adatkezelési tájékoztató a linkről megnyílik, telefonon olvasható
  út: /privacy
  várd: látható "Adatkezelési tájékoztató"
  kézi: 390 px-en nincs vízszintes túlfolyás, a szöveg olvasható méretű

- [ ] A lábléc a lap alján: a linkek ott vannak — de elérhetők-e ujjal?
  út: ${ELEK_P_TIHANY_ORGANIC}
  várd: látható "Leiratkozás"
  várd: látható "Adatkezelési tájékoztató"
  kézi: ⛔ a runner teljes-lapos képe itt NEM bizonyíték (a rögzített sávokat kikapcsolja) — a `lead-mobile-check` 04-bottom képén: a süti-sáv és a pirula szabadon hagyja-e a lábléc linkjeit; ha nem, HIBA

## ⑤ Betöltés mobil-neten

- [ ] A lap és a képek össz-mérete, a képek száma, lazy-load
  út: ${ELEK_P_LAGUNA_AURORA}
  várd: látható "Laguna Panzió"
  kézi: a `lead-mobile-check` REPORT.md súly-táblája: össz KB laponként (cél < 3 MB), legnagyobb kép, hány kép tölt lazy-load nélkül — a wow mobil-neten múlik

## Összkép

- [ ] Wow-e az első három másodperc 390 px-en, és hibátlan-e a lap végéig?
  kézi: a 38 lap 390 px-es képei alapján: melyik stílus adja a legjobb és a legrosszabb első képernyőt, mi közös (a keret rétege — sáv, süti-sáv, pirula, lábléc — minden stílusban ugyanaz), és mi stílus-specifikus
