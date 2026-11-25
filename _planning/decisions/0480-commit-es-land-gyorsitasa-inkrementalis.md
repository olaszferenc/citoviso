## ADR-0480 — Commit és land gyorsítása: inkrementális típusellenőrzés a landon, gyors sáv a csak-dokumentum változásokra

**Státusz:** ELFOGADVA (tulaj 2026-11-25: „igen mehet” a mérés + javaslat után) · session `citd231e4fd` · **Épít:** ADR-0478
(élesítés-gyorsítás), ADR-0227 (párhuzamos kapu-futtató), ADR-0229 (író-sáv jelölés mint mért ígéret), ADR-0275 (land-sor).

### Kontextus
Az ADR-0478 után egy kódváltozás commitja ~3,5 perc, a landja ~5 perc lett (előtte 22 + 19). Mérve 2026-11-25 este,
ami még lassít:
- **Csak-dokumentum commitok.** A main 57 commitjából 26 (11-24/25) csak `MEMORY.md`-t vagy `_planning/**/*.md`-t írt
  (a „tudásrögzítés azonnal” doktrína miatt sessionönként naponta többször). Mégis 45–58 kódkapu futott rájuk
  commitnál és landnál is (~225 s, a kapuk 522 s-et vártak a gép 6 közös slotjára, más sessionök elől foglalva).
- **A land típusellenőrzése** minden landon elölről: 46–75 s, terhelt gépen 145 s.
- **A land-sor:** egyszerre egy session landol; minél rövidebb egy land, annál rövidebb a sor.

### Döntés
① **`tsc --incremental` a landon**, munkafánként saját build-info fájllal a fa git-könyvtárában
(`$(git rev-parse --git-dir)/cit-tsc.tsbuildinfo`, a fába soha). A TypeScript hivatalos mechanizmusa: azt a fájlt
ellenőrzi újra, aminek a tartalma vagy a függősége változott. Piros próba: egy típushiba ugyanúgy 2-es kóddal bukik.
Mérve: 145 s → 28 s. `CIT_TSC_FULL=1` = a régi teljes ellenőrzés.
② **Gyors sáv csak-dokumentum diffre.** Ha MINDEN változott fájl `MEMORY.md` vagy `_planning/**/*.md` (commitnál a
staged lista, landnál `LAND_RANGE`), a hook `CIT_GATE_DOCS_ONLY=1`-gyel hívja a futtatót. Az kihagyja azokat a kapukat,
amelyek fejlécében (első 40 sor) ott a jelölés: `// gate-scope: no-docs — <indoklás, ≥ 20 karakter>`. A kihagyás hangosan
kiíródik, és nem „zöld”. A jelölés **mért ígéret**: a `scripts/gate-scope-check.mts` minden jelölt kapu teljes statikus
import-zárlatát összecsomagolja (esbuild, npm-csomagok nélkül, megjegyzések nélkül), és piros, ha a kódban szerepel:
`_planning`, `MEMORY`, git-parancs (`"git"`, `ls-files`, `git grep`), glob-könyvtár, vagy rekurzív könyvtár-bejárás. Ez az
őr minden kódváltozásnál fut (`src/`, `scripts/`, `hooks/`), és van piros próbája (`--self-test`). A kézi
könyvtár-bejárást a jelöléskor kapunként átnéztem: a 38 jelölt kapu mindegyik bejárója `src/`, `scripts/`, `kb/`,
`public/` vagy `assets/design-refs/` alól indul, a repó gyökeréből egyik sem.
A DB-t, az élest és a böngészős óránkénti kört ez nem érinti; kódváltozásnál minden kapu ugyanúgy fut.

### Elvetett alternatíva
**Gépi kiszűrés jelölés nélkül** (amelyik kapu zárlatában nincs dokumentum-hivatkozás, az automatikusan kimarad):
mérve a nyers import-zárlatok jó része megjegyzésben hivatkozik `_planning`-re vagy `.md`-re, a kézi könyvtár-bejárás
gyökere pedig statikusan nem bizonyítható. Ezért marad a jelölés + őr (ugyanaz a minta, mint az író-sáv ADR-0229).

### Visszafordíthatóság
🔄 olcsó: a jelölés soronként levehető (a kapu akkor dokumentum-változásra is fut); `CIT_TSC_FULL=1` visszaadja a teljes tsc-t.
