## ADR-0163 — Ha nincs megnevezett terület, a régió-fordulat ELMARAD (2026-09-14)

**Kiváltó.** Az ADR-0143 ③ utószálának nyitott tétele, tulajdonosi döntéssel lezárva
(„hagyja el a régió-fordulatot"). Az ADR-0143 a KONZOL felületén tiltotta ki a nyers
gyűjtési kulcsot; ez a döntés a GENERÁTORRA viszi végig ugyanazt.

**Mérés (nem becslés).**

- A `resolveRegion()` (`src/generator/generate.ts`) utolsó sora `label: REGIONS[id]?.label ?? id`
  volt: ismeretlen terület-azonosítónál **a SCRAPE KULCS lett a megjelenítendő név**, és
  onnantól semmi nem tudta megkülönböztetni egy valódi helynévtől. Közvetlen próbával:
  `bs` → `"bs"`, `_test` → `"_test"`, `Balaton` → `"Balaton"` (ez utóbbi a legmegtévesztőbb:
  hibátlan helynévnek látszik). A `balaton-north` és a `badacsony` helyesen ad nevet.
- **Hova ment ez a string az ÉLŐ úton** (a konzol a `generateEngineMock`-ot hívja):
  ① a **copywriter promptjába** a szállás régiójaként (`brief.ts` „Régió: …"), ahonnan a
  vendégnek szóló prózába kerülhet; ② a **tény-kapu forrás-listájára** (`factCheck.ts`
  `FactSource.region`) — az a lista pedig **LICENC, nem leírás**: amit felsorol, azt a lap
  ÁLLÍTHATJA. Vagyis egy „_test szívében" mondat a kapu ÁLDÁSÁVAL ment volna át;
  ③ a tárolt `mock_artifact.inputs.region`-be, amiből a `rerender-mock.mts` ÚJRA renderel —
  tehát a kulcs a következő újrarendereléskor feltámadt volna (az ADR-0143 ① pont ezt a
  hurkot zárta).
- ⛔⛔ **A saját ADR-0143 ③ bekezdésem ROSSZ ÚTVONALAT nevezett meg** (`render.ts:81/154/…`):
  azok a sorok a `generateMock()`-hoz tartoznak, amit **ma senki nem hív** (hívási hely: 0).
  A hibát a helyes irányba jelentettem, a bizonyítékom viszont halott ágra mutatott —
  helyesbítve ott is. **Kirenderelt lapon egyik úton sem figyeltem meg**: a korpuszban nincs
  besorolatlan területű leadhez legyártott mock. A mechanizmus igazolt, a megvalósult eset nem.

**Döntés.**

1. **A forrás megkülönbözteti a NEVET a KULCSTÓL.** A `resolveRegion()` mostantól
   `{ id, label, known }`-t ad: `known:false` = „nincs NEVÜNK erre a területre". A mező
   additív, tehát egyik meglévő fogyasztó sem törik el.
2. **`known:false` → a régió-fordulat ELMARAD, nem helyettesítődik.** ⛔ A két kézenfekvő
   pótlás EGYFORMÁN hamis mondatot szül: a kulcs visszhangja („…*_test* szívében") és a
   konzol állapot-szava („…*nincs besorolás* szívében"). **Egy tényt, amink nincs, elhagyunk.**
   (Ez a §B.17 egyenes következménye: a felület ne állítson többet, mint amit tud.)
3. **De a hiányt KIMONDJUK a modellnek.** A néma kihagyás nem elég: a copywriter a fotókból
   találná ki a helyet. A prompt ezért expliciten közli, hogy nincs megnevezett terület, és
   megtiltja a régió/tájegység/partoldal/környék említését — **egy forrásból**
   (`brief.regionLines()`), mert a szabály két hívási helyen él és két példányban elcsúszna.
4. **A tény-kapu is a hiányt kapja, nem a csendet.** A `FactSource.region` opcionális lett,
   és hiányában a forrás-sor kimondja, hogy bármilyen régió-utalás **MEGALAPOZATLAN** — így
   a kapu FLAG-el, ahelyett hogy licencet adna. (`factCheck.regionSourceLine()`.)
5. **A tárolt pillanatkép sem kapja meg.** `known:false` esetén az `inputs`-ból kimarad a
   `region` NÉV-mező; a `regionId` (gépi azonosság) marad, mert abból dolgozik a `persist.ts`
   és a `rerender-mock.mts`.
6. **Az újraírás (`recopy.ts`) ugyanezt a szabályt követi** — különben a legközelebbi
   „szöveg újraírása" visszahozná a kulcsot.

**Őr (`scripts/region-phrase-drop-check.mts`, pre-commit).** 20 zöld állítás, AI/hálózat/DB
nélkül, négy rétegben: ① a `known` zászló a VALÓDI kulcsokon (bejegyzett ÉS nem bejegyzett
eset is kötelezően a mintában); ② a prompt ismert névvel tartalmazza, ismeretlennel
**egyetlen nyers kulcsot sem**, nem ír `undefined`-ot, kimondja a hiányt, és **nem tolja
oda a konzol állapot-szavát**; ③ a tény-horgony ugyanez; ④ **SZERKEZETI IKER**: egyetlen
ÉLŐ hívó sem adhat át feltétel nélküli `region: region.label`-t — plusz egy ellen-állítás,
hogy a fájl TÉNYLEG a `region.known`-ra őrzi (különben egy régiót nem is említő fájl üresen
lenne zöld). **Önteszt: 10 piros**, mind a négy rétegen, a kiszállított viselkedést
visszaírva.

**Amit ez NEM old meg (kimondva).** A `getRegionContext()` ismeretlen területnél üres
`tagline`-t ad, és AI-szöveg hiányában az a hero-alcím fallbackja (`siteData.ts`) — egy
sablon (`wordmarkGrow`) őrizetlen `<p>`-be teszi. Ez a változás előtt is így volt, és csak
a copy-hívás bukásakor látszik; külön kör, az üres-sáv doktrína alá tartozik.

**Visszafordíthatóság:** 🔄 additív mező + feltételes átadás; nulla migráció, nulla
adat-mozdulat. Élesítés NINCS (§0.3).
