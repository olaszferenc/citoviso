## ADR-0478 — Élesítés gyorsítása: a mock-kapu üresjárata ki, képítélet-tár, a `--go` átveszi a próbafuttatást, a deploy mindig a main szkriptjével fut, a fordítás nem állít meg

**Státusz:** ELFOGADVA (tulaj 2026-11-25: „Mehet” a mérés+terv után; a fordítás-pont a tulaj külön döntése ugyanaznap:
„fordítás SKIPP … MAJD UTÓLAG”) · session `citd231e4fd` · terv és mérés: `_planning/elesites-gyorsitas-terv-20261125.md`.
**Épít:** ADR-0053 (verzió megy élesre), ADR-0207 (GATE 5), ADR-0412 (API-fordítás tilos), ADR-0220 (GATE 1c/kép),
ADR-0432 (pass-cache, böngészős kapuk a landen).

### Kontextus
A d2e87422 javítás útja a fő ágtól élesig 2026-11-25-én ~110 perc volt. Ebből ~100 perc a
`mock-render-fixtures-check` (18 minta-mock lerenderelve és megítélve) öt futása volt ugyanarra a tartalomra:
két commit, a hotfix cherry-pick, a deploy próbafuttatása és a `--go`. Egy futás ~20 perc. Mockonként kimérve
(fázisonként): az `auditMockFile` a görgetés után `waitForLoadState("networkidle")`-re várt, ami sosem teljesült,
ezért minden mocknál kifutott a 60 mp-es időkorlát (2/2 mérésben, egyetlen függő kérés nélkül). A képfelismerés
(CLIP + Tesseract) képenként minden futásban újra lefutott (~30 mp/mock). Ugyanez a függvény az éles kiküldés
minőségkapuja is, tehát ott is +60 mp jutott minden leadre.
Továbbá: a 2e167ca4 élesítése (21:08) a konzol-kanárin bukott, pedig a konzol 33 mp alatt feljött. A hotfix-ág a
saját, 11-16 előtti `deploy-prod.sh`-ját futtatta (30 mp-es várakozás), a mainen már 120 mp volt. Ugyanaznap egy
hiányzó en/sl konzol-string megállította a d2e87422 élesítését a GATE 5-ön (a servicek nem indultak újra).

### Döntés
① **Saját hálózati-csend számláló** az `auditMockFile`-ban: a lap minden kérése befejeződött vagy elbukott, és
500 ms óta nincs új (a Playwright `networkidle` definíciója, de a saját eseményeinkből). Felső korlát változatlan, 60 mp.
② **Képítélet-tár bájtok szerint** (`classifyPhotoBuffer`): a kulcs a kép bájtjai + a szabályfájlok forrása
(`photoKind.ts`, `photoText.ts` — hash, így szabályváltozásnál VERSION-emelés nélkül is újra mér) + a címke-beágyazások +
a modellfájl + a tessdata + az onnxruntime/sharp/tesseract.js verziója. Ha bármelyik nem olvasható, nincs tár.
③ **A `--go` átveszi a próbafuttatás GATE 1c/kép és 1d zöldjét** ugyanarra a SHA-ra és ugyanarra a
deploy-szkriptre, 6 órán belül (`<git-common-dir>/cit-deploy-dryrun/<sha>`). Kihagyási kéréssel futott próba nem
ír igazolást. `CIT_DEPLOY_FULL=1` mindent újrafuttat.
④ **A tudásbázis-verdikt (GATE 1c) a lassú renderelések ELŐTT** kerül ellenőrzésre.
⑤ **A deploy mindig az `origin/main` `deploy-prod.sh`-jával fut**: ha a hívó fa példánya eltér, a main példánya
indul ugyanazokkal az argumentumokkal (`CIT_DEPLOY_LOCAL_SCRIPT=1` = a helyi, hangosan).
⑥ **GATE 5 / 5b nem állítja meg az élesítést**: hiánynál jegy Bábelnek (`~/babel/beerkezo/`), hangos
figyelmeztetés, a DEPLOYED-sorba `i18n-gap` jelölés; a hiányzó szöveg magyarul látszik, amíg Bábel le nem fordítja.

### Elvetett alternatíva
**Tartalom-nyomkövetéses „már zöld” tár minden kapura** (a terv 3. pontja): a kapu által ténylegesen olvasott
fájlok hash-éhez kötött zöld. Mérve: a Node worker-szálaiban (tesseract.js) az előtöltés nem fut, a natív modulok
(onnxruntime) és a Chromium közvetlenül olvasnak fájlt — ezek olvasásai nem láthatók, tehát a tár biztonságot
lazítana, épp a legdrágább kapunál. Az ①–② után a kapu-kör amúgy is perceken belül lefut.

### Visszafordíthatóság
🔄 mind olcsón visszavonható (egy-egy blokk a szkriptekben).
