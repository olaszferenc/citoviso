# 2026-09-14 — Ha nincs megnevezett terület, a régió-fordulat elmarad (ADR-0163)

**Kiváltó:** az ADR-0143 ③ nyitott tétele, tulajdonosi döntéssel lezárva („hagyja el a
régió-fordulatot"). Az ADR-0143 a KONZOLON tiltotta ki a nyers gyűjtési kulcsot; ez a
GENERÁTORRA viszi végig ugyanazt.

## A lyuk

A `resolveRegion()` utolsó sora `label: REGIONS[id]?.label ?? id` volt: ismeretlen
azonosítónál **a scrape-kulcs lett a megjelenítendő név**, és onnantól semmi nem tudta
megkülönböztetni valódi helynévtől. Próbával: `bs` → „bs", `_test` → „_test",
`Balaton` → „Balaton" (ez a legmegtévesztőbb — hibátlan helynévnek látszik).

**Hova ment az ÉLŐ úton** (a konzol a `generateEngineMock`-ot hívja):

1. a **copywriter promptjába** a szállás régiójaként (`brief.ts`);
2. a **tény-kapu forrás-listájára** (`factCheck.ts` `FactSource.region`) — és az a lista
   **LICENC, nem leírás**: amit felsorol, azt a lap ÁLLÍTHATJA. Vagyis egy „_test szívében"
   mondat a kapu **áldásával** ment volna át;
3. a tárolt `inputs.region`-be, amiből a `rerender-mock.mts` ÚJRA renderel — a kulcs a
   következő újrarendereléskor feltámadt volna (az ADR-0143 ① pont ezt a hurkot zárta).

## A szabály

**`known:false` → a fordulat ELMARAD, nem helyettesítődik.** A két kézenfekvő pótlás
egyformán hamis mondatot szül: a kulcs visszhangja („…*_test* szívében") és a konzol
állapot-szava („…*nincs besorolás* szívében"). Egy tényt, amink nincs, elhagyunk.

**De a hiányt KIMONDJUK a modellnek** — a néma kihagyás nem elég, a copywriter a fotókból
találná ki a helyet. Egy forrásból (`brief.regionLines()`), mert a szabály két hívási helyen
él és két példányban elcsúszna. Ugyanez a tény-kapunál (`factCheck.regionSourceLine()`):
a hiányban kimondja, hogy a régió-utalás MEGALAPOZATLAN → FLAG, nem licenc.

## ⛔⛔ Amit ebben a szálban MÁSODSZOR rontottam el

Az ADR-0143 ③-ba azt írtam, hogy a kulcs a `render.ts:81/154/161/170/211` sorokon megy a
vevő lapjára. **Mérve: azok a `generateMock()`-hoz tartoznak, amit ma SENKI nem hív**
(hívási hely: 0; a `run.ts` is az engine-t indítja). A hibát a helyes irányba jelentettem,
de a BIZONYÍTÉKOM halott ágra mutatott. Ez ugyanaz a hiba-osztály, mint az aznapi első:
a `data.ts` kommentjébe írt „3 szivárog / 592 rendben", amit a KÉP cáfolt.

**A tanulság mindkettőből ugyanaz:** egy grep megtalálja a MINTÁT, de nem mondja meg, hogy
az az út ÉL-e. Mielőtt egy fájl:sor hivatkozást bizonyítékként leírok, meg kell mérni, hogy
a hívási lánc a valódi belépési pontról odaér-e. Helyesbítve az ADR-ben és a jegyzetben is
— [[feedback_my_own_summary_line_can_be_the_false_premise]].

## Őr

`scripts/region-phrase-drop-check.mts` (pre-commit, ön-triggerrel) — 20 zöld, AI/hálózat/DB
nélkül, négy rétegben:

1. a `known` zászló a VALÓDI kulcsokon (a minta kötelezően tartalmaz bejegyzett ÉS nem
   bejegyzett esetet is — különben fél halmazt mérne);
2. a prompt ismert névvel tartalmazza a nevet, ismeretlennel **egyetlen nyers kulcsot sem**,
   nem ír `undefined`-ot, kimondja a hiányt, és **nem tolja oda a konzol állapot-szavát**;
3. ugyanez a tény-horgonyra;
4. **szerkezeti iker**: egyetlen ÉLŐ hívó sem adhat át feltétel nélküli
   `region: region.label`-t — plusz ellen-állítás, hogy a fájl TÉNYLEG a `region.known`-ra
   őrzi (különben egy régiót nem is említő fájl ÜRESEN lenne zöld).

**Önteszt: 10 piros**, mind a négy rétegen, a kiszállított viselkedést visszaírva.

## Nyitva (kimondva)

A `getRegionContext()` ismeretlen területnél üres `tagline`-t ad, és AI-szöveg hiányában az
a hero-alcím fallbackja; egy sablon (`wordmarkGrow`) őrizetlen `<p>`-be teszi. Ez a változás
ELŐTT is így volt, és csak a copy-hívás bukásakor látszik — külön kör, üres-sáv doktrína.
