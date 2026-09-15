# 2026-09-15 — Nincs alcím → nincs elem; és a mérőeszközöm először a rossz mennyiséget nézte (ADR-0181)

**Kiváltó:** az ADR-0163 kimondott nyitott tétele, tulajdonosi utasításra lezárva
(„vidd az üres tagline-t is").

## A mérés kitágította a saját leletemet

Az ADR-0163-ba azt írtam, hogy ez „csak a copy-hívás bukásakor látszik", és a
besorolatlan területekhez kötöttem. **Mérve a hatókör 89%:**

- A hero-alcím AI-szöveg hiányában a régió taglinejére esik vissza (`siteData.ts`).
- A generátor `REGIONS` táblájában **EGYETLEN bejegyzés van (`badacsony`)**, miközben a
  `resolveRegion()` a scraper `GEO_REGIONS`-ából is „ismertnek" mond területeket →
  `balaton-north` és `godollo` **known=true, de tagline ÜRES**.
- A dev-korpusz 595 leadjéből **532 (89%)** ilyen területhez tartozik (529 `balaton-north`
  + 3 besorolatlan). Az „őszinte tartalék hero-alcím" gyakorlatilag soha nem működik.
- A kár: **7 üres, mégis helyet foglaló elem 3 sablonon** (arch-frames 2, tilted-gallery 2,
  wordmark-grow 3), 17–32 px kósza térközzel. A másik 16 sablon már helyesen őrzött.

## ⛔⛔ A legfontosabb tanulság: a saját mérőeszközöm hamis zöldet adott

Az első predikátumom `height >= 1`-et kért → **0 hézag, mind a 19 sablon zöld**. Egy üres
`<p>` DOBOZA viszont 0 magas; ami helyet foglal, az a **MARGÓJA**. A mérés a rossz
mennyiséget nézte, és pont azt a hibát nem látta, amit keresni küldtem. Margóval számolva
azonnal előjött a 7 hézag.

⚠️ Két további műtermék, amit ki kellett zárni, mielőtt bármit állítottam:
- a wordmark-**intro overlay** (`data-cit-no-intro` nélkül a fél lapot eltakarja — az első
  „bizonyíték-képem" valójában az intro-animációt mutatta);
- a **mozgás-réteg** (ADR-0115): programozott görgetésnél az elemek `opacity:0`-n maradnak,
  ezért a chipek „hiányzónak" látszottak → `reducedMotion: "reduce"` kell a felvételhez.

⛔ És egy harmadik: a forrás-**grep** 12 „őrizetlen" találatot adott, amiből több valójában
őrzött ternáriusban ült. A renderelt kimenet mérése hozta a helyes 7-et —
[[feedback_grep_finds_the_pattern_not_the_live_path]] testvére.

## A szabály és az őr

**Nincs szöveg → nincs elem.** A hét helyen ugyanaz az őrzés, amit a többi 16 sablon már
használ; ahol a szöveg a szekció EGYETLEN tartalma volt (`w-say`, `t-say`), a teljes blokk
marad el. Alcímet NEM pótolunk kitalált szöveggel — egy tényt, amink nincs, elhagyunk
(ugyanaz az elv, mint az ADR-0163 régió-fordulatánál).

`scripts/empty-tagline-check.mts` — **ATTRIBÚCIÓS**: minden sablon KÉTSZER renderelődik
(egyedi JELSZÓVAL / ÜRESEN), így a lelet megnevezi, MELYIK elem élt a taglineból és maradt
üresen — nem csak annyit mond, hogy „valahol üres". Ellen-állítás: ha a tagline egyáltalán
nem jelenik meg (52 fogyasztó elem), a kapu üresen lenne zöld.
**Önteszt: 19 piros**, és a VALÓDI visszarontásra is piros (egy őrzést visszavéve az őr
NÉVVEL megnevezte a `tilted-gallery`-t, rc=1).

## Kapu-eljárás (§2b)

A három sablon felület-fájl, a token ZÁRVA volt. A kivételt **nem magamnak adtam**: mérési
számokkal (7 hézag, elemenkénti méret) és a javítás pontos alakjával kérdeztem, a tulaj
megadta — indoka szó szerint naplózva a tokenben, feltétellel: „ui-shot 390 + 1280, és a
képeket Read-del MEG IS NÉZED". Hat felvételt néztem meg (3 sablon × 2 méret).

## Nyitva (tulajdonosi döntés, 2026-09-15: „csak jegyezzük fel")

A 89% GYÖKÉROKA a `REGIONS` egyetlen bejegyzése. Régió-szöveget írni TARTALMI döntés (mit
állítunk egy tájegységről — §B.17 köti), nem hibajavítás. Három út: ① megírjuk a hiányzó
bejegyzéseket; ② kivezetjük a `regionTagline` tartalék-ágat, ha sosem tud őszinte lenni;
③ marad így, és a sablon-őrzés a védelem. Ez a kör ③-at szállította.
