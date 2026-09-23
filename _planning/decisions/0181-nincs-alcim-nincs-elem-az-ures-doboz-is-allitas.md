## ADR-0181 — Nincs alcím → nincs elem: az üres doboz is állítás (2026-09-15)

**Kiváltó.** Az ADR-0163 kimondott nyitott tétele, tulajdonosi utasításra lezárva
(„vidd az üres tagline-t is"). Ott azt írtam, hogy a hiba „csak a copy-hívás bukásakor
látszik" — a mérés ezt lényegesen KITÁGÍTOTTA (lásd lent).

**Mérés (nem becslés).**

- **A hatókör 89%, nem szűk sarok.** A hero-alcím (`SiteData.tagline`) AI-szöveg hiányában a
  régió taglinejére esik vissza (`siteData.ts`: `copy ? copy.tagline : opts.regionTagline`).
  A generátor régió-szöveg táblájában (`generate.ts` `REGIONS`) viszont **EGYETLEN bejegyzés
  van: `badacsony`** — miközben a `resolveRegion()` a scraper `GEO_REGIONS`-ából is
  „ismertnek" mond területeket. Mérve: `badacsony` → van tagline; **`balaton-north` és
  `godollo` → ÜRES**, a besorolatlan kulcsok (`bs`, `_test`, `Balaton`) szintén. A dev-korpusz
  595 leadjéből **532 (89%)** olyan területhez tartozik, aminek NINCS régió-taglineja.
  Vagyis az „őszinte tartalék hero-alcím" gyakorlatilag soha nem működik.
- **A kár: 7 üres, mégis helyet foglaló elem 3 sablonon** (`arch-frames` 2, `tilted-gallery` 2,
  `wordmark-grow` 3), 17–32 px kósza térközzel. A másik 16 sablon már helyesen őrzött.

**Döntés.** **Nincs szöveg → nincs elem.** A hét helyen ugyanaz az őrzés került be, amit a
többi sablon már használ (`${x ? \`<p>…</p>\` : ""}`); ahol a szöveg a szekció EGYETLEN
tartalma volt (`w-say`, `t-say`), ott a teljes blokk marad el. Elrendezés, betű, szín
változatlan — nulla kinézeti döntés. ⛔ Alcímet NEM pótolunk kitalált szöveggel: egy tényt,
amink nincs, elhagyunk (ugyanaz az elv, mint az ADR-0163 régió-fordulatánál).

**Őr (`scripts/empty-tagline-check.mts`, pre-commit, ön-triggerrel, ~14 mp).** ATTRIBÚCIÓS:
minden sablon KÉTSZER renderelődik — egyszer egyedi JELSZÓVAL a taglineben (így derül ki,
mely elemek élnek belőle), egyszer ÜRESEN (így derül ki, marad-e közülük üres, de helyet
foglaló). A lelet ezért megnevezi az elemet, nem csak annyit mond, hogy „valahol üres".
Plusz egy ellen-állítás: ha a tagline egyáltalán nem jelenik meg (52 fogyasztó elem), a kapu
üresen lenne zöld. **Önteszt: 19 piros** (beszúrt üres bekezdés minden sablonon), és a
VALÓDI visszarontásra is piros (kontrollált próba: egy őrzést visszavéve az őr NÉVVEL
megnevezte a `tilted-gallery`-t, rc=1).

**⛔⛔ Amit ELŐSZÖR ELRONTOTTAM a saját mérőeszközömben.** Az első predikátumom
`height >= 1`-et kért, és **0 hézagot jelentett — mind a 19 sablon zöld volt**. Egy üres `<p>`
DOBOZA viszont 0 magas; ami helyet foglal, az a MARGÓJA. Vagyis a mérés a rossz mennyiséget
nézte, és pont azt a hibát nem látta, amit keresni küldtem. Margóval számolva azonnal
előjött a 7 hézag. ⚠️ Két további mérési műtermék, amit ki kellett zárni: a wordmark-intro
overlay (`data-cit-no-intro` nélkül a fél lapot eltakarja) és a mozgás-réteg (programozott
görgetésnél az elemek `opacity:0`-n maradnak → `reducedMotion: "reduce"` kell).

**⚠️ FELSOROLVA, NEM JAVÍTVA (tulajdonosi döntés, 2026-09-15: „csak jegyezzük fel").**
A fenti 89% GYÖKÉROKA az, hogy a `REGIONS` táblában egyetlen bejegyzés van. Régió-szöveget
írni TARTALMI döntés (mit állítunk egy tájegységről — §B.17 köti), nem hibajavítás, ezért a
tulaj szavával jár. Három út áll nyitva: ① megírjuk a hiányzó bejegyzéseket; ② kivezetjük a
`regionTagline` tartalék-ágat, ha sosem tud őszinte lenni; ③ marad így, és a sablon-őrzés a
védelem. Ez a blokk ③-at szállítja, ①/② nyitva.

**Visszafordíthatóság:** 🔄 hét feltételes blokk; nulla migráció, nulla adat-mozdulat.
Élesítés NINCS (§0.3).
