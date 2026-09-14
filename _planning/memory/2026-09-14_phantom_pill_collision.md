# 2026-09-14 — A fantom pirula-ütközés: a saját jelentésem lett a hamis premissza

**Tulajdonosi utasítás:** „javítsd az aurora/mobil pirula-ütközést, aztán kösd be a
`lead-page-surface-check`-et".

**ADR:** [ADR-0168](../DECISIONS.md) · **Élesítés NINCS** (§0.3) · **Termék-kód nem változott.**

---

## ① A javítás elmaradt, mert nem volt mit javítani

Az utasítás premisszája az én ADR-0152-es leltáramból jött: a `lead-page-surface-check`
„MA PIROS, és ez TERMÉK-HIBA — `aurora`/mobil a pirula a CTA 23 %-át takarja". **Javítás
előtt újramértem, és a premissza megdőlt.**

| futás | bukó eset | pirula y |
|---|---|---|
| reggel (régebbi main) | `aurora/mobil` | 769 |
| délután | `fullbleed/mobil` | 685 |
| közvetlenül utána, változatlan kódon | `fullbleed/asztali` | 798 |

Ugyanarra a sablonra a mért `y` futásonként **100+ px-et ugrált** (`fullbleed/mobil`
685 → 543). Ez nem regresszió, hanem **érme-feldobás**.

## ② Az ok: a termék MÁR kikerül, az őr a kikerülés közben mér

Az `assets/runtime/cit-configurator.js` `cit-cfg-avoid` blokkja (Elek FK-004b H-3 óta)
felfelé sepri a pirulát, amíg el nem hagyja az elsődleges vezérlőket — és a `bottom`-ot
**animálva** teszi. A CSS maga kimondja: *„`bottom` is animated because the runtime MOVES
the pill out of the way of a primary button"*.

Az őr ehhez képest `wakePill()` után **fixen 400+700 ms**-mal mintavételezett. A mért
megállási idők: 210 ms – **5 050 ms** (aurora/asztali, 10 400 px-es lap, ~16 párhuzamos szál).

**Nyugvópontra várva három teljes futás: 0 bukás** (114 mérés/futás).

## ③ A javítás — az őrbe, nem a termékbe

`settlePill()`: rAF-enkénti poll, amíg a pirula rect-je **700 ms-on át változatlan ÉS
`opacity === 1`**.

- A **700 ms levezetett**: hosszabb, mint a leghosszabb lehetséges lökés (120 ms debounce +
  500 ms átmenet) — különben egy „megállt, aztán újra elindult" pirulát mondanánk nyugvónak.
- A **plafon 12 000 ms**, a mért legrosszabb (5 050 ms) ~2,4-szerese. A javítás utáni három
  futás legnagyobb megállása **3 237 ms** → 3,7× ráhagyás. ⚠️ Ez az ADR-0147 kifejezett
  tanulsága: az „alig-átmenő" keret a következő érme-feldobás.
- **A plafon nem ítélet:** ha a pirula nem áll meg, az külön PIROS állítás („a pirula
  MEGÁLL"), nem elnyelt timeout.
- Az **önteszt ugyanazzal a mércével mér**, mint az éles ág.

## ④ Nem vakítottam el az őrt — bizonyítva

A termék kikerülője **kimondottan feladja**, ha csak a képernyőről lelépve tudna kitérni
(`if (lifted - h < 8) break`), tehát tartós takarás nyugvó állapotban IS lehetséges.

- **Meglévő piros iker (tovább él):** a `cit-cfg-avoid` blokkot kivágva a pirula betemet egy
  gombot → elkapja.
- **Visszarontás-próba:** `placeLaunch()` kikapcsolva az őr **sok sablonon** bukik, mind a
  nyugvó `y=745`-nél, **konzisztensen** — ép kódnál a `y` sablononként eltér (540…828), és
  **ez a működő kikerülés ujjlenyomata**.
- **Új piros iker:** szintetikusan **oszcilláltatott** pirula (minden képkockán mozdul) →
  `settled=false`. Enélkül a „MEGÁLL" állítás csupa zöldje díszlet lenne.

## ⑤ Bekötve

Trigger: motor-render + konfigurátor-generátor + **`assets/runtime/cit-configurator.{js,css}`**
(a hibaosztály pontosan egy CSS-átmenet és egy JS-időzítő abban a két fájlban) + az őr saját
fájlja (ADR-0147 ③). ~5–6 perc, ezért szigorúan diff-scope-olt. A `guard-wiring-check`
kivétel-listájáról ezzel lekerült; maradt **egy** adósság (`module-config-check`).

## ⑥ A tanulság, ami túlmutat ezen az őrön

**A bekötetlen őr nemcsak a terméket hagyja őrizetlenül — maga is elromlik, és senki nem
veszi észre.** Ez az őr fantom-pirosat termelt; mert soha nem futott, a romlás a leltáramba
„élő termék-hibaként" került be, onnan pedig **tulajdonosi utasításként jött vissza**.

⛔ **A saját korábbi mérésem is premissza, nem tény.** Javító vagy romboló művelet előtt
újra kell mérni — akkor is, ha a saját számomat kapom vissza.

## Módosított fájlok

- `scripts/lead-page-surface-check.mts` — `settlePill()` + „a pirula MEGÁLL" állítás +
  oszcilláció-önteszt; a ② és a ④ pirula-ága nyugvópontban mér
- `hooks/pre-commit` — a `lead-page-surface-check` bekötve, diff-scope-olt triggerrel
- `scripts/guard-wiring-check.mts` — a kivétel-sor törölve
- `_planning/DECISIONS.md` — ADR-0168
