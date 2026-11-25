# Élesítés gyorsítása — mérés és terv (2026-11-25)

## Mi van ma (mérve, d2e87422 útja élesre)

| lépés | idő | ebből a 18 minta-mock kapu |
|---|---|---|
| commit a fő ágon (140 kapu) | 22 perc | ~20 perc |
| ugyanez még egyszer (egy másik kapu bukott) | 22 perc | ~20 perc |
| cherry-pick a hotfix ágra (139 kapu) | 23 perc | ~20 perc |
| `deploy-prod.sh` próbafuttatás | 21 perc | ~20 perc |
| `deploy-prod.sh --go` (a próba kapuit újra) | 21 perc | ~20 perc |
| **összesen** | **~110 perc** | **~100 perc** |

- A commitnál futó 70 kapu összideje 1611 mp, ebből **1200 mp egyetlen kapu**: `mock-render-fixtures-check`
  (18 minta-mock lerenderelve és megítélve). A többi 69 kapu párhuzamosan ~2 perc alatt lefut.
- A kapu-futtatónak MÁR van „zöld volt ugyanezen a fán” tára, de a kulcsa a fa + a diff hash-e, ezért
  commit → land → hotfix → deploy között SOHA nem talál (minden naplóban: „0 már zöld volt”).
- A deploy a 18 mockot két külön futásban (próba és `--go`) újra lerendereli ugyanarra a commitra.

## Miért lassú a 18 mock (egy mock kimérve, fázisonként)

| fázis | idő |
|---|---|
| fotóválogatás + renderelés | 1 mp |
| oldal betöltése + végiggörgetés | 6 mp |
| **várakozás a „hálózati csendre”** | **60 mp — minden mocknál kifut az időkorlát** |
| asztali nézet mérése | 2 mp |
| képfelismerés (CLIP) képenként, tár nélkül | ~30 mp |

A görgetés után a kód `networkidle`-re vár; ez a Playwrightban sosem teljesül (mérve: 2/2 mocknál
60 000 ms után időtúllépés, közben egyetlen kép-kérés sincs függőben). Tehát mockonként 60 mp üresjárat,
18 mockon 18 perc. Ugyanez a függvény (`auditMockFile`) fut az ÉLES kiküldés előtti minőségkapuban is,
vagyis ott is minden lead +60 mp.

## Javaslat (biztonság nem lazul: minden kapu ugyanúgy blokkol, ugyanazt méri)

1. **A 60 mp-es üresjárat kivezetése.** A „hálózati csend” helyett arra várunk, amire a kapunak
   valójában szüksége van: minden kép-kérés (ezek mind a kapu saját útvonal-kezelőjén mennek át) befejeződött,
   és 500 ms óta nincs új. Ez szigorúbb és pontos feltétel. Igazolás: a teljes 18-as kör előtte/utána
   ugyanazt az ítéletet adja mockonként. Várható: 20 perc → ~10 perc.
2. **Képfelismerés tára.** A CLIP-ítélet a kép bájtjainak hash-éhez + a modellfájl hash-éhez kötve lemezre
   kerül; ugyanaz a kép ugyanazzal a modellel nem fut újra. Várható: ~10 perc → ~2–3 perc (és az éles
   kiküldésnél is gyorsul).
3. **❌ ELVETVE a megvalósításkor (mérés alapján, lásd az ADR-t):** a Node worker-szálaiban (tesseract) az előtöltés nem fut, a natív modulok és a Chromium közvetlenül olvasnak fájlt, így a nyomkövetés nem látna mindent, és épp a legdrágább kapunál lazítana. Az eredeti javaslat: **Tartalomhoz kötött „már zöld” tár a kapu-futtatóban.** Zöld futáskor feljegyezzük, mely repó-fájlokat
   olvasta TÉNYLEGESEN a kapu (fájl-olvasás és könyvtár-listázás nyomkövetéssel) és azok hash-ét.
   Legközelebb (bármelyik fában: commit, hotfix cherry-pick, land, deploy) ha ezek a fájlok bájtra azonosak,
   és az argv/környezet/`package-lock`/node-verzió is, a kapu nem fut újra. Ki van zárva a tárból
   (mindig fut): ami a diffet/módot olvassa (ma is így van), ami a böngészőn és a tesseracton kívül más
   programot indít (pl. `git`, al-`node` — azok olvasásait nem látjuk), és a bukott futás.
   A DB-t ma sem nézi a tár (2 órás érvényesség) — ez nem változik.
   Következmény: egy bukott kapu javítása után csak az fut újra, aminek a bemenete változott.
4. **A `--go` átveszi a próbafuttatás zöldjét** ugyanarra a SHA-ra (igazolás-fájl, 6 óráig érvényes;
   GATE 1c/kép és 1d). A `--go` minden mást (scrape, migráció, időzítők, restart, visszamérés) ugyanúgy futtat.
5. **A tudásbázis-verdikt hiánya a próbafuttatás ELEJÉN derül ki**, nem 20 perc után.
6. **GATE 5 (fordítás) nem állítja meg az élesítést** (tulaj döntése, 2026-11-25): hiánynál magyar
   fallbackkel megy ki, jegy Bábelnek (`~/babel/beerkezo/`), hangos figyelmeztetés a kimenetben.

7. **A deploy mindig a fő ág (origin/main) deploy-szkriptjével fut**, akkor is, ha hotfix-ágról
   indítják. Mérve 2026-11-25 21:08 (2e167ca4): a konzol-kanári 30 mp után bukottnak jelölte az
   élesítést, pedig a konzol 33 mp alatt feljött; a public-restart, a DEPLOYED-sor és a prod-tag kézzel
   készült el. A hiba a mainen MÁR javítva van (11-16 óta 120 mp a várakozás), de a hotfix-ág a régi,
   30 mp-es szkriptet hordozta, és az futott. Ugyanezért kapná meg a hotfix-élesítés a fenti
   gyorsításokat is. Mellé: ha a kanári mégis kifut, a szkript egyértelműen kiírja, hol állt meg és mi
   a folytatás egyetlen parancsa (a „public ne induljon újra, ha a konzol nem jött fel” védelem marad).

## Várható eredmény ugyanarra az útra

| lépés | ma | utána (becslés) |
|---|---|---|
| commit a fő ágon | 22 perc | ~3–4 perc |
| ismétlés bukás után | 22 perc | ~1 perc (csak a javított kapu) |
| hotfix cherry-pick | 23 perc | ~1–4 perc (csak a ténylegesen eltérő bemenetű kapuk) |
| próbafuttatás | 21 perc | ~1 perc |
| `--go` kapui | 21 perc | másodpercek |
| **összesen** | **~110 perc** | **~10 perc** |

A megvalósítás után ugyanezt az utat lemérem előtte/utána, percekben.

## Mért eredmény (2026-11-25, megvalósítás után)

| mérés | régi kód | új kód |
|---|---|---|
| `mock-render-fixtures-check`, 18 mock | 1419 mp | 447 mp (üres képítélet-tárral) · **191 mp** (tárral) |
| ítélet mockonként | 18/18 zöld | 18/18 zöld, azonos |
| betöltött kép-helyek (4 mock, teljes audit-eredmény) | 15 / 10 / 9 / 11 | azonos (bájtra egyező kimenet) |
