## ADR-XXXX — Mock 3. kör: a szobablokk nem marad el, a cím doboza a leghosszabb szóhoz igazodik, semleges galériacím kevés saját képnél, feliratos nyitókép helyett a következő jelölt

- **Dátum:** 2026-11-27 (este)
- **Státusz:** elfogadva (a koordinátor `cit96bd8170` 18–22. pontja, a tulaj elve: „a mock terv, tölts, ne hagyj el; ez nem tényállítás”)
- **Érinti:** `src/engine/templateKit.ts`, `src/engine/stock.ts`, `src/engine/moduleSections.ts`, `src/engine/render.ts`, `src/engine/templates/{parallax,wordmarkGrow}.ts`, `src/media/photoText.ts`, `src/media/photoKind.ts`, `src/generator/photoCurate.ts`, `src/outreach/mockRenderGate.ts`, `src/outreach/mockPhotoGate.ts`, `scripts/chain-supply-check.mts`, `scripts/qa-review-check.mts`
- **Előzmény:** ADR-0503 (feltöltés elhagyás helyett).

### Döntés
18. **A minta-szobablokk nem marad el.** A 11-26-os szabályt („minta-kártya szobakép nélkül, 5+ saját fotó → nincs szobablokk”) mindkét helyen (`templateKit.roomsFor`, `moduleSections`) kivettem. A kép nélküli kártya MINTA-jelölt stock hálószobát kap (`withStockCards`; a mock stock-kártyái 5+ fotónál is nyitva vannak). A kis stílus-tárat az általános egészíti ki, így minden kártyára jut kép. A kapu a jelölt mintaképet a szobahelyen eddig is engedte.
19. **(Kivéve ebből a körből — tulaj 2026-11-27, „2, ok”.)** A fotó nélküli, mondatos, textúrás sáv nem kell. Az eddigi viselkedés marad: sávra alkalmas fotó nélkül a sáv elmarad. Csak valódi mondattal (nem cím vagy utca) és a lap akcentszínén jöhet vissza egy következő körben.
20. **A cím doboza sosem keskenyebb a leghosszabb szónál.** Mért ok („Balatonszárszón,” 18 px-en is tört): a betűméret-igazító lekicsinyítette a címet, de a doboz `max-width: 16ch` volt, ami vele együtt zsugorodott. Most a szóhossz szerinti szélesség-padló (`--cit-hero-wmeasure`, em-ben) a `max-width` alja. A Parallax mobilos fix 30 px-e is a plafonhoz igazodik. A Névből növő címe (`heroWordFit`, vegyes betűs szorzó .62em) ugyanígy.
21. **Semleges „Galéria” cím kevés saját képnél.** A `withNeutralGalleryHeading` csak 0 saját képnél lépett be. A Marijannak (d1d0ecd9) egy saját képe van, azt a nyitás viszi, a galéria Baška Vodával és MINTA szobákkal indul a szövegíró „Fotografije apartmana i obale” címe alatt. 3 saját kép alatt most a lefordított „Galéria” kulcs áll. A döntés a képszámon múlik, nem a (lefordított) szövegen.
22. **Feliratos nyitókép → következő jelölt** (Reljic feb441b0: forgatott „A2(2+2)”, „A5(2+1)” címkék a homlokzaton). A vízszintes OCR semmit nem olvas, ezért a nyitókép-jelölt 0°-on és ±28°-on is OCR-t kap 2000 px-en, egység/ágy-konfiguráció címkemintára (`szám+szám`, `A2(`), legalább 60-as bizonyossággal (`readOverlayLabels`). URL-enként lemezre gyorsítótárazva. A `photoCurate` legfeljebb 3 jelöltet néz, a címkés kép a galériában marad. A kapu is jelez (URL-lel). Mérve: a Reljic +28°-on megvan, 60 éles nyitóképen 0 téves találat. Ára kb. 11 s/kép az első alkalommal.
- Bélyeg `2026-11-27-supply3`, render-kapu v19.
- §2b felület-kivétel: tulaj „2, ok” (2026-11-27, a koordinátoron át; a ⑲ nélkül).

### Mérve (vak, 12 új éles mock: 6 HU saját, 3 HU település, 3 HR; sorosan, egy böngészővel)
Az új kapuval az éles fájlok 2/12, a mai generátorral újrarenderelve 8/12 (HU saját 5/6, HU település 2/3, HR 1/3). Kontraszt 4 → 0, kettétört szó 1 → 0, üres térkép 1 → 0, ismétlés 1 → 0. A maradék: csak beltéri saját kép, ISS-űrfelvétel településképként (a tár hibája, a következő körben kitiltandó: „satellite photo”), HR erkély-nyitókép, kép nélküli HR tipográfiai nyitókép. (A ⑲-es sávszámok ebben a mérésben még benne voltak.)

### Visszafordíthatóság
🔄 — egy-egy feltétel vagy függvény. Migráció nincs.
