## ADR-0382 — A pirula-pár a hős-cím szavaira sehol nem ül: álló telefonon süti-sáv nélkül és asztalon is a cím fölé lép, de fejlécre és gombra nem

**Dátum:** 2026-10-13 · **Kontextus:** az ADR-0377 nyitott pontja; a tulaj a koordinátoron át: „csináld úgy, hogy jó legyen” (mindkét javaslat elfogadva: fekvőn egymás alatt marad, a szabály kiterjed). **Kiterjeszti:** ADR-0377 ③ (eddig: fekvőn mindig, állón csak süti-sávval). **Megtartja:** ADR-0242 ④ (gomb-kitérés, R8), ADR-0377 ①② (fekvő: jobb sarok, egymás alatt), ADR-0373 (kérdés-sáv).

### Kiváltó (mérve, ADR-0377 után, 21 sablon)
Álló telefonon süti-sáv nélkül 5 sablonon (fullbleed, dark-luxury, parallax, horizontal, card-sidebar), asztalon 3-on (fullbleed, horizontal, artdeco) a pár a hős-gombsor fölé lépve a bevezető mondatra vagy a címre ült (a ④ régi felfelé-lépése).

### Döntés
1. **A cím-akadály mindenhol él** (`heroTitleRects` feltétel nélkül): a `h1` és a testvér-`p`-k szöveg-sorai, sorköz nélkül; rés a betűktől állón/asztalon 6, fekvőn 3 px.
2. **Két menet** (`findSpot`): előbb gombok + cím; ha ez a keresés a fejlécbe vinné vagy alatta még akadály maradna, a pár a csak-gomb szabály helyén marad (ADR-0242 ④ — „ha nem fér, a sarokba”).
3. **A fejléc-határ** (`pillCeiling`): a keretező sáv alja, és a képernyő felső 30 %-ában álló, TÉNYLEG látszó (elementFromPoint) vezérlők alja − 2 px; szöveges linknél a szöveg kiterjedése, nem a doboza. Mérve: a claymorphism márkanév-linkje 730 px széles doboz 185 px névvel; a keretező sáv összecsukott „Miért kaptam?” teste a fejléc alatt rétegben áll, de nem látszik. A menü-gomb kör: a doboz utolsó 2 px-e a pár szélén festetlen.
4. **Határra állás:** ha a cím fölé lépéshez néhány pixel hiányzik, a pár a határra áll, ha így a cím résébe legfeljebb 6 px-t ér bele és gombot nem takar (fekvő claymorphism süti-sávval).

### Eredmény (mérve, 21 sablon × 390 / 844×390 / 1280×800 × nyugalom / süti-sáv = 126 állapot)
A cím betűin 0 állapotban ül (ADR-0377 után: álló sáv nélkül 5, asztalon 3 sablonon ült), a keretező sávra 0, hős-gombra 0. Megfigyelés (nem változott, nem ennek a része): a cinematic hős-képváltó három kis jelzőcsíkjára a pár a mainen is ráér.

### Őr
`scripts/mock-trial-overlay-check.mts` ⑪ bővítve: álló és asztali nyugalom + süti-sáv; minden állapotban: nem ül a cím betűin, a keretező sáv alatt marad, hős-gombot nem temet be (PILL_PROBE, a fotó-csempe tartalom). `--self-test`: a `cit-cfg-trialfx-pill*` blokkok kivágásával a ⑪ piros.

### Visszafordíthatóság
🔄 könnyű — kliens-oldali elrendezés (`cit-configurator.js`); adat, séma, pénzút nem változott. Élesre a következő deployjal megy.
