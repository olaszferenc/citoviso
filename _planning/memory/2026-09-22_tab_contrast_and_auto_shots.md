# 2026-09-22 — A fülsáv olvashatatlan felirata, és a pillanatkép, ami magától elkészül

**Szál:** `wt/citd82c09c9` · **ADR:** 0203 (automatikus pillanatkép), 0204 (kontraszt-vakfolt)
**Kiindulás:** két tulajdonosi mondat egy képernyőkép mellé — *„itt a header zöld betűje szinte
nem is látszik"* és *„miért nem jön automatikusan előnézeti kép?"*

## ① A bejelentett hiba: a fülsáv

A lead-lap INAKTÍV fül-feliratai (`Mock és generálás`, `Megkeresés`, …) a navy gradiens sávon
`--citui-link-ink` (#10697a) színnel festődtek. **Pixelből mérve 2,22:1** (küszöb 4,5).

Ok: **specificitás-ütközés** — `.con a` (0,1,1) veri a `.con-ltab` (0,1,0) színét. Árulkodó nyom:
a `:hover` és az `.on` ág MÁR `.con` prefixszel íródott (valaki ebbe már belefutott), csak az
alapállapot maradt ki. Javítás egy sor: `.con a.con-ltab` (0,2,1) → **8,33:1**, asztali és mobil
méreten mérve, képpel igazolva.

⚠️ **A tulaj képernyőképe zöldes-sötét volt, az enyém navy** — ezt előbb a böngészője
színkezelésének hittem, és a Chrome kényszerített sötét módjával reprodukáltam is a KÉPET. Zsákutca
volt: a hiba a mi kódunkban ült, és a force-dark **javította** a számokat (2,22 → 6,12). A tanulság:
a reprodukált látvány még nem a diagnózis.

## ② Az őr, ami zölden védte

A `console-contrast-check.mts` 9733 elemre mondott ZÖLDET, miközben a hiba a lapon ült: a
háttér-feloldás gradiens ősnél `null`-lal adta fel, és a hívó az ilyen elemeket NÉMÁN kihagyta —
a konzol **minden sötét sávja** kívül esett a mérésen.

Javítva: minden gradiens-stopra megold, a LEGROSSZABBAT veszi (+302 felirat: 9733 → 10035), a
mérhetetlent (kép-háttér, féligátlátszó gradiens) megszámolja és KIÍRJA (36), külön állítás bukik,
ha a gradiens-ág nullát mér, és az **önteszt negatív kontrollt kapott pont erre az ágra**
(2 → 14 gradiens-lelet). ⚠️ A kontroll SORRENDJE kötött: a token-csere ELŐTT kell futnia, mert a
csere a link-tintát ciánra írja, ami a sötét sávon már átmenne — fordítva a kontroll némán
elgyengülne.

## ③ „Miért nem jön automatikusan a kép?"

A felület azt állította: *„a kép legyártása ~40 másodperc, ezért külön kérésre indul"*. **Megmérve
hamis:** 5,6 s az első render, 2,0–2,3 s a többi. A 40 s a BUKÓ eset két kísérletének ideje volt —
abból lett egy INDOK, amiért a kurátor 19 kártyán 19-szer kattintott, miközben a kép pont a
DÖNTÉSHEZ kellett volna.

A valódi költség a portál felé ismételt fotó-letöltés volt (19 változat, ugyanaz a fotó-készlet).
**Forráskép-cache** (`src/outreach/photoCache.ts`) → a 19 render **4 letöltést** küldött ki.
Mellé: globális sorompó (egyszerre EGY Chromium), automatikus indítás a generálás végén ÉS a
lead-lap megnyitásakor a hiányzókra (`kind === "none"` — a `failed` NEM indul újra magától), és a
kártya helyben frissül.

**Mérve, kattintás nélkül:** networkidle 19,4 s · 19 kép 49,5 s alatt · 13 lap-lekérdezés ·
0 JS-hiba.

## ④ A saját első változatom lett a következő hiba

A poll első verziója kártyánként kérdezett és bukásnál `location.replace()`-t hívott. Ez **két
mért bukás**: (a) 19 fetch háromszor percenként → a lap SOHA nem ér el `networkidle`-t, és a
`button-weight-check` 390 px-en „HTTP nincs válasz"-ra futott; (b) az újratöltés a betöltés
közepén is lecserélte a lapot. Javítva: köteges `/lead/:id/shot-states` végpont (a bukás OKÁVAL
együtt), és helyben kiírt hiba. Az őr utána 414 állítással zöld.

## ⑤ Mérési csapda, amit érdemes megjegyezni

A worktree-ből indított konzol a **saját** CSS-ét szolgálja ki, a fő fa könyvtárából indított a
**fő fáét** (`path.resolve(process.cwd(), "public", …)`). A mock HTML-ek viszont a FŐ FA
gyökerében élnek, ezért a pillanatkép-mérésekhez a fő fa cwd-je kell — és akkor a képeken a RÉGI
CSS látszik. Egy körben majdnem „javítottnak" olvastam egy még javítatlan fülsávot.

## Módosított fájlok

- `public/assets/ui/citui-console.css` — `.con a.con-ltab` alapszín
- `scripts/console-contrast-check.mts` — gradiens-ág, mérhetetlen-riport, önteszt-kontroll
- `src/outreach/photoCache.ts` (ÚJ) — forráskép lemez-cache
- `src/outreach/heroShot.ts` — cache bekötése, globális sorompó, cache-statisztika a naplóban
- `src/console/server.ts` — automatikus indítás (generálás vége + lap-megnyitás), köteges végpont
- `src/console/views.ts` — kártya-felirat igazra, kliens-oldali poll
- `_planning/DECISIONS.md` — ADR-0203, ADR-0204

## ⑥ Infrastruktúra-lelet: a worktree nem látja a mockokat

A landolás kapuja (`outreach-send-bar-check`) **7 bukással** megállt — „a mock renderelt fájlja
nincs meg a lemezen", a küldés-gomb `(nincs kép)`-pel tiltott. ⭐ **A tiszta fán IS**, tehát nem a
munkámtól: a generált mock-HTML-ek a **fő fa gyökerébe** íródnak (a DB cwd-relatív FÁJLNEVET tárol,
könyvtár nélkül), a friss worktree viszont **nullát** lát belőlük — a fő fában közben 31 van. A
`rc-wt-prepare.sh` a `.env`/`node_modules`/`sites`/`assets/Temp`-et symlinkeli, a mockokat nem.

Megoldva a gépen (`~/bin/rc-wt-prepare.sh`, backup: `~/bin/_backup-rc-wt-prepare-20260922.sh`):
glob-os symlink-blokk a `mock-*.html`-re. ⛔ **Két csapda, mindkettő próbával igazolva:**
(a) a `-L` nem elhagyható a `-e` mellől — ha a fő fából eltűnik egy mock, a worktree-ben TÖRÖTT
link marad, amire a `-e` HAMISAT mond, az `ln -s` „File exists"-szel elhasal, és `set -e` mellett
az EGÉSZ előkészítés megáll (**negatív kontrollal bizonyítva**: a `-L` nélküli változat ugyanazon
a törött linken elhasal, az új átmegy — az első próbám itt értéktelen volt, mert a visszarontó
`sed` nem is alkalmazódott, és „átment"-et írt); (b) NEM `ln -sfn`, mert a szál a saját fájában is
generálhat mockot — az VALÓDI fájl, egy erőltetett link csendben elpusztítaná.

⚠️ **KORLÁT:** ez a worktree LÉTREHOZÁSAKOR fut, a később generált mockokat nem hozza át.

## Nyitva maradt

A forráskép-cache rendernként épül (lead-szintű előmelegítés az első 5,6 s-et is levinné) · a
`MAX_CONCURRENT_RENDERS = 1` az éles VPS-en mérendő · a cache TTL-takarítása nincs ütemezve · **a
generált mockok `sites/` alá költöztetése** (az a tartós megoldás a ⑥-ra: a `sites/` már ma is
symlinkelt; érinti a generátor kimeneti útvonalát ÉS a DB-ben tárolt útvonalakat → külön kör, ADR) · a
`.con-back` („← Vissza a leadekhez") ugyanattól a link-szabálytól türkiz a szürke helyett — világos
háttéren 5,81:1, ezért nem fáj, de ugyanaz a hibaosztály.
