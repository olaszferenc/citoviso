# 2026-09-14 — A szoba-kártya képe kilógott és eltakarta a szöveget (FK-004b H-2 / FK-005a H-3)

## A bejelentés

Két külön Elek-kör ugyanarról, 2026-09-13:

- **FK-004b H-2** (a lead szemével): „A »Szobák, apartmanok« kártyákon a képek kilógnak a
  kártyából és RÁTAKARJÁK a szöveget" — a középső kártyán a mondatból csak az „M" és a „k."
  látszott.
- **FK-005a H-3** (a vásárló szemével, a MEGVÁSÁROLT lapon): ugyanaz. Tehát nem mock-jelenség:
  a fizető ügyfél élő oldalán is.

## A mérés: EGY tünet, KÉT független ok

A bejelentés egy hibát írt le. A renderelt lapon mérve **kettő** volt, és a második a
működő fotós esetben is fennállt — azaz a „halott kép" magyarázat önmagában hamis lett volna.

### ① A törött-kép kitöltő az IMG SZÜLŐJÉT foglalta el

`src/engine/render.ts` `IMG_FALLBACK_JS`: a halott `<img>`-t egy
`position:absolute;inset:0;min-height:150px` `<div>`-re cserélte, és a divet **az img
szülőjébe** tette. Az a szülő csak ott kép-keret, ahol a sablon épp csinált egyet. A
megosztott szoba-kártyán (`li.cit-modsec__item`) és a transit táblacellájában a szülő **maga a
kártya** → a panel ráült a szoba nevére és a leírására, a 150px-es padló pedig kilógatta a
110px-es kártyából. A portál-fotó URL-ek rendszeresen elrohadnak, tehát ez nem szélső eset.

**A javítás elve: a helyettesítő ÖRÖKÖLJE ANNAK az elrendezési szerződését, amit helyettesít.**
Az `<img>` **marad** — vele minden szabály, amit a sablon ráírt (width, aspect-ratio,
object-fit, border-radius, rács-pozíció, forgatás) —, és csak a **pixelei** cserélődnek egy
token-színű, beágyazott SVG-re. Ami pontosan a fotó dobozát foglalja el, az nem tud kilógni és
nem tud mondatot eltakarni — ez nem sablononként újraellenőrizendő szabály, hanem szerkezeti
lehetetlenség.

### ② A MINTAKÉP-jelölés maga takart — működő fotónál is

Két hiba egy elemben:

- `.cit-wmwrap{height:100%}`: oszlop-flex kártyában az `li` magassága DEFINIT (a sora
  nyújtja), ezért a 100% **a teljes kártyára** oldódott fel, nem a képre. Ez pontosan az a
  hiba, amit a szoros burok 2026-08-24-én már egyszer megoldott — egy méretezési rövidítés
  hozta vissza. Most a burok alapból **simul** a képhez, és a runtime **megméri** (a wrap
  ELŐTT), hogy a kép tényleg kitöltötte-e a kerete magasságát; csak akkor kap `height:100%`-ot
  (`data-cit-wmfill`).
- A szalag **el van forgatva** (−14°), ezért a doboza nagyobb a képnél: egy 300×200-as
  helynél ~33px-rel nyúlik túl fölé és alá — épp rá az alatta lévő szoba-névre. Megoldás egy
  **levágó réteg** (`.cit-wmclip{overflow:hidden}`), ami a SZALAGOT burkolja, a képet soha —
  így a saját fotóját forgató sablon (tilted-gallery, scrapbook) képe érintetlen marad.

- **A burok a KÉPET a sablon saját címkéi fölé emelte.** A `.cit-wmwrap` `position:relative`,
  és a DOM-ban KÉSŐBB áll, mint a sablon fotóra írt feliratai — a puszta beburkolás tehát a
  fotót a festési sorrendben föléjük tolta. Mérve a `horizontal`-on: a képre írt „1. fejezet"
  eltűnt a fotó alatt. Ez **ma is élő hiba**, és a jelölés-cseréig el is bújt a fátyol mögött.
  A runtime most a fotóval átfedő sablon-elemeket **visszaemeli** a jelölés rétege fölé.

### ③ A tulaj döntése: §2b terv-kör, „C" változat

A felület-kapu megállt, és a tulaj — kérdésre — a **teljes terv-kört** kérte (nem a
hibajavítás-kivételt). Három önhordó, működő HTML változat ment ki (méret-váltóval, valódi
404-gombbal), mobil ÉS asztali képpel: **A** átlós fátyol · **B** alsó magyarázó sáv ·
**C** sarok-jelvény. **Választás: C.** Az indok: a kép az, ami elad — a jelölés legyen
félreérthetetlen anélkül, hogy tompítaná a fotót.
Kontraktus: `assets/design-refs/engine/roomcard-sample-mark/` (README + a jóváhagyott HTML
+ a KÉT kép, amin a döntés született).

Amit a C megvalósítása KÖVETELT a tervből:

- **A sarok MÉRT, nem beégetett.** A pirula átlátszatlan (a fátyol nem volt az), a sablonok
  pedig a saját címkéiket is a fotóra írják. A runtime végigpróbálja a négy sarkot, és az
  elsőt veszi, ami semmit nem temet be. ⚠️ Ezt **geometriával** dönti el, nem
  `elementFromPoint`-tal: a szoba-szekció a hajtás alatt van, ott a hit-teszt `null`-t ad —
  vagyis MINDEN sarkot „szabadnak" mondana. (Pontosan ez a vakfolt tette zölddé az őröm
  első változatát a bejelentett hibán.)
- **Kis képen kisebb pirula** (`.cit-wm--sm`): a transit 50×36-os bélyegén a párnázott
  jelvény csonkolódna, a csonk pedig nem jelölés, hanem hiba.
- **Az őr KIVÉTELE megszűnt.** Amíg a jelölés áttetsző fátyol volt, egy kimondott, 60 esetet
  számláló kivétel engedte át a fátyol alatti, képre írt feliratokat. Átlátszatlan pirulánál
  ez nem áll: ami alatta van, eltűnik. A kapu ma **kivétel nélkül** zöld.
- ⛔ Közben a saját mérésem is termelt egy hamis leletet: a globális `pointer-events:auto`
  kalapácstól a teljesen ÁTLÁTSZÓ levágó réteg lett a „legfelső találat". A szabály most nem
  az elem NEVÉHEZ kötődik, hanem ahhoz, hogy mérhetően átlátszó-e (nincs saját háttere,
  háttérképe, kerete, saját szövege) — azok visszakapcsolódnak átlátszóra.

## Az őr

`scripts/room-card-overflow-check.mts` — **19 sablon × 3 forgatókönyv × 2 szélesség = 114
mérés, 342 kártya.** A RENDERELT lapon mér, `elementFromPoint`-tal, nem a CSS-forrásból
következtetve; a kiszállított lapot méri (`injectRuntime`), mert a jelölést a runtime rajzolja.

- ① **takarás**: a kártya minden szöveg-SORÁT (Range client-rect, nem elem-doboz) pontonként
  hit-teszteli;
- ② **kilógás**: a kártya doboza KÖRÜL mintavételez (így a levágást tiszteletben tartja: azt
  méri, ami LÁTSZIK);
- ③ **üres szöveg**: nulla sor-doboz is bukás.

**Negatív önteszt (`--selftest`):** mindkét javítást KÜLÖN rontja vissza, és mindegyiktől saját
kontrollt vár. Kitöltő visszarontva: **14/38 + 12/38 piros**, az **élő-fotós** kör **0** (a
kitöltő ott nem fut). Jelölés visszarontva (fix sarok + kártyára feszülő burok + a képet a
címkék fölé emelő z-index): **2/38 + 2/38 piros**, az **élő-lapos** kör **0** (ott nincs
minta-fotó, tehát jelölés sincs). A kontroll nélkül a piros semmit nem bizonyítana.

**A kapunak ma NINCS kivétele** (114/114 zöld). A fátyol idején egy kimondott, 60 esetet
számláló kivétel engedte át a fátyol alatti, képre írt feliratokat; az átlátszatlan pirulánál
ez megszűnt.

## ⛔ Amit magamról tanultam ebben a körben

**Az első őröm ZÖLDEN védte a bejelentett hibát — háromszor, három különböző okból.**

1. **A takaró kép a SZOMSZÉD kártyáé volt.** A szabályt „a saját kártyája képe"-re szűkítettem;
   a kilógó panel viszont a szomszéd kártya szövegére ült rá, tehát a takaró elem nem annak a
   kártyának a gyereke volt, amelyiknek a szövegét elvette.
2. **A `scroll-behavior:smooth` (13 sablon állítja) miatt a `scrollIntoView` ANIMÁLT**, így a
   mérés a képernyőn KÍVÜL mért — és a képernyőn kívüli pontokat **némán kihagytam**, a
   kihagyást pedig zöldnek olvastam. Most a nem mérhető pont **bukás**.
3. **Az `innerText` a MEGJELENÍTETT szöveget adja**, és a transit nagybetűsíti a szoba-nevet —
   a nyers illesztés ezért NULLA kártyát talált ott, vagyis a sablon mérés nélkül maradt volna.

Mind a három csak azért derült ki, mert a zöld sorok mellé **megnéztem a képet is**, és az nem
azt mutatta, amit a kapu állított.

## Módosított / létrehozott fájlok

- `src/engine/render.ts` — a törött-kép kitöltő a kép PIXELEIT cseréli, nem a dobozát
  (+ `data-cit-imgfallback` horgony, hogy az önteszt pontosan azt az egy blokkot ronthassa vissza)
- `assets/runtime/cit-runtime.js` — `markSamplePhotos`: mért `data-cit-wmfill`, levágó réteg,
  MÉRT sarok-választás, a sablon képre írt címkéinek visszaemelése, kis képen kisebb pirula
- `assets/runtime/cit-modules.css` — `.cit-wmwrap` simul, `.cit-wmclip`, a „C" terv pirulája
  (`.cit-wm`, `--right`, `--bottom`, `--sm`)
- `scripts/room-card-overflow-check.mts` — ÚJ őr + negatív önteszt (két visszarontás)
- `assets/design-refs/engine/roomcard-sample-mark/` — a JÓVÁHAGYOTT terv kontraktusa
  (README + HTML + a két kép, amin a döntés született)
- `_planning/memory/2026-09-14_room_card_photo_overflow.md` — ez a jegyzet

## ⚠️ Amit a munkafáról jelenteni kell

A session a `~/wt/cit2167c7de` fában indult, ami **egy MÁSIK sessionnel közös volt**: a
session elején 5, a végén ~45 módosított fájl, köztük stage-eltek, és a **HEAD is elmozdult
alattam** (a párhuzamos szál rebase-elt). Két konkrét kár keletkezett és lett helyreállítva:

1. A párhuzamos szál **felülírta a `cit-modules.css`-t**, elvéve az én változásaimat —
   visszatettem sebészileg (nem fájl-felülírással).
2. Az én HEAD-alapú `INDEX.md`-rekonstrukcióm **elvette az ő két sorát** — visszatettem.

Tanulság: **közös fában a fájl-swap technika tilos** (a HEAD kicserélődhet két parancs
között), és a landolás tiszta fából megy. A befejezés ezért a `~/wt/roomcardfix` (ág:
`wt/roomcardfix`) friss `main`-ről nyitott worktree-ben történt.

## Nyitott

- Élesítés NINCS; a javítás lokálban áll.
