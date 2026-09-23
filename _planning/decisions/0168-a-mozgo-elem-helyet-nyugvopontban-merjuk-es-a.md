## ADR-0168 — A mozgó elem helyét nyugvópontban mérjük; és a bekötetlen őr MAGA is elromlik (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA · **Kapcsolódó:** ADR-0147 ② (ugyanez a
hibaosztály, itt MÁSODSZOR), ADR-0152 (árva őrök bekötése), Elek FK-004b ①②
· **Őr:** `scripts/lead-page-surface-check.mts` (most bekötve)

- **Kontextus:** az ADR-0152 leltára a `lead-page-surface-check`-et „MA PIROS, és ez
  TERMÉK-HIBA" néven vette fel — a jelentés szerint `aurora`/mobil a lebegő vásárlás-pirula
  a „Szabad időpontok megtekintése" CTA 23 %-át takarta. Tulajdonosi utasítás: javítsd a
  pirula-ütközést, aztán kösd be az őrt.
- ⛔⛔ **A PREMISSZA HAMIS VOLT, ÉS A SAJÁT JELENTÉSEM TERJESZTETTE TÉNYKÉNT.** Javítás előtt
  újramérve **nem volt termék-hiba**:
  1. **Három futás HÁROM KÜLÖNBÖZŐ esetet buktatott meg** — `aurora/mobil` (y=769),
     `fullbleed/mobil` (y=685), majd `fullbleed/asztali` (y=798) —, és ugyanarra a sablonra
     a mért `y` futásonként **100+ px-et ugrált** (`fullbleed/mobil` 685 → 543).
  2. **A termék MÁR KIKERÜLI a gombot.** Az `assets/runtime/cit-configurator.js`
     `cit-cfg-avoid` blokkja (Elek FK-004b H-3 óta) felfelé sepri a pirulát, amíg el nem
     hagyja az elsődleges vezérlőket, és a `bottom`-ot **animálva** teszi (0,5 s átmenet).
  3. **Az őr a kikerülés KÖZBEN mintavételezett:** `wakePill()` után fixen 400+700 ms-mal.
     A mért megállási idők ehhez képest 210 ms-tól **5 050 ms**-ig szórtak.
  4. **Nyugvópontra várva három teljes futás: 0 bukás** (114 mérés/futás).
- **Döntés:**
  1. **Az ADR-0147 ② nem egy őr javítása volt, hanem SZABÁLY:** animált elem helyét a
     PIXELRE várva mérjük, nem órára. Itt másodszor fordult elő ugyanaz — ezért a
     `settlePill()` rAF-enkénti pollal vár, amíg a pirula rect-je **700 ms-on át**
     változatlan ÉS `opacity === 1`. A 700 ms levezetett: hosszabb, mint a leghosszabb
     lehetséges lökés (120 ms debounce + 500 ms átmenet), tehát egy „megállt, aztán újra
     elindult" pirulát nem mondunk nyugvónak.
  2. **A keret levezetett, nem tippelt, és NEM alig-átmenő** (ADR-0147 ⚠️): a termék saját
     állandói ~2 000 ms-ot adnak (900 ms mount-időzítő + 120 ms debounce + 500 ms átmenet +
     a sima görgetés), a mért legrosszabb gép-terhelés mellett 5 050 ms → a plafon
     **12 000 ms**, a mért legrosszabb ~2,4-szerese. A javítás utáni három futásban a
     legnagyobb megállás **3 237 ms** volt, vagyis 3,7× ráhagyás.
  3. **A plafon SOSE legyen az ítélet:** ha a pirula nem áll meg, az **PIROS** („a pirula
     MEGÁLL" külön állítás), nem elnyelt timeout — az oszcilláló kikerülő önmagában lelet.
  4. **Az önteszt UGYANAZZAL a mércével mér, mint az éles ág** — különben a zöldje más
     kérdésre felelne.
- ⚠️ **Amit kimondottan NEM tettem: nem vakítottam el az őrt.** A termék kikerülője
  **kimondottan feladja**, ha csak a képernyőről lelépve tudna kitérni
  (`if (lifted - h < 8) break`), tehát tartós takarás nyugvó állapotban is lehetséges — és
  ugyanúgy pirosra visz. Bizonyítva: a `placeLaunch()` kikapcsolva az őr **sok sablonon**
  bukik, mind a nyugvó `y=745`-nél, **konzisztensen** (ép kódnál a `y` sablononként eltér —
  ez a működő kikerülés ujjlenyomata). Új piros iker: szintetikusan **oszcilláltatott**
  pirula → `settled=false`, tehát a „MEGÁLL" állítás sem díszlet.
- **Bekötve** (ADR-0152 ① alól ezzel kikerül a kivétel-listáról): trigger a motor-render, a
  konfigurátor-generátor **és `assets/runtime/cit-configurator.{js,css}`** — a hibaosztály
  pontosan egy CSS-átmenet és egy JS-időzítő abban a két fájlban —, plusz az őr saját fájlja
  (ADR-0147 ③). ~5–6 perc, ezért szigorúan diff-scope-olt.
- ⭐ **A TANULSÁG, ami túlmutat ezen az őrön:** a bekötetlen őr nemcsak a terméket hagyja
  őrizetlenül — **maga is elromlik, és senki nem veszi észre**. Ez az őr fantom-pirosat
  termelt, és mert soha nem futott, a romlás egy leltárba „élő termék-hibaként" került be,
  onnan pedig utasításként jött vissza. ⛔ **Romboló vagy javító művelet előtt a saját
  korábbi mérésem is premissza, nem tény** — újra kell mérni.
- **Visszafordíthatóság:** 🔄 termék-kód NEM változott (mérve: `git diff -- src/ assets/
  public/ migrations/` üres). Csak a mérőeszköz és a hook triggere.
- **Státusz:** ELFOGADVA (2026-09-14). Élesítés NINCS (§0.3).
