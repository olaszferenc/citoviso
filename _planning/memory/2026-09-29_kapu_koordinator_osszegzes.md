# 2026-09-29 — Kapu-koordinátor: a land 16+ percről ~6 percre, és nincs többé háromszoros újrafuttatás

Tulaj (a telefonos kör koordinátorán át): „mi a tököm tart eddig. indíts egy koordináló sessiont a kapuk vizsgálatára”.
Önálló koordinátor (`cit3bd83952`), hét SUB, mind landolva és leállítva. Kódot a koordinátor nem írt.

## Eredmény (valós landban mérve)
- Sablont érintő land kapusora: reggel 960 s → este csendes gépen egy kör ~360 s. Nem sablonos land: 2,5 perc.
- Ami 45 percet vitt el ma egy landon (`cit48c5979c`, a24d552e): a push kétszer visszapattant, és minden kör a TELJES
  kapusort újrafuttatta (1145 s · 1020 s · 361 s, „0 már zöld”). Erre jött a gépszintű land-sor (ADR-0275).

| ADR | mit | szám |
|---|---|---|
| 0261 | mobile-chrome-check 4 munkással | 577 → 183 s |
| 0263 | lead-page-surface · guest-mobile · room-details · lead-mobile + `scripts/lib/gate-pool.mts` | 313→101 · ~300→~70 · 182→61 · 178→64 s |
| 0264 | room-card-overflow · configurator-float · configurator-placement · whole-only-guest | 111→42 · 86→37 · 61→40 · 50→29 s |
| 0265 | a futtató a leghosszabb kaput indítja először (`cit-gate-history.json`) | ① −25 % |
| 0266 | outreach-link-live-check: `networkidle` → `load` (a photo-health külső fotókat töltött) | 299–675 → 37 s |
| 0268→0269 | job-időkorlát: CSEND-alapú (900 s, se kimenet, se szívverés) + 3600 s plafon, nem kapcsolható ki | — |
| 0271 | szívverés: a gate-pool egységenként érint egy fájlt, a kimenet változatlan | cfg-sheet csend 242 → 38 s |
| 0272 | cfg-sheet-scroll-check poolon + nyugvópont (S11: 4 s-on belül nincs → PIROS) | ~20 perc → ~4–5 perc |
| 0273 | lead-mobile + guest-mobile nyugvóponton mér; **termék-javítás**: `cit-configurator.js` a `[data-cit-mobbar]` transitionendjére is újrahelyez | — |
| 0275 | gépszintű land-sor (`scripts/land-lock.sh`, `.git/cit-land.lock`, `flock -o` + PID-figyelés) + `scripts/land-lock-check.mts` | 1 kör landonként |

## Tanulságok
- **Terheléses mérés a KÖZÖS gépen = mindenki landja lassul.** A SUB-ok CPU-égetői miatt délután load 22–29 volt, a tulaj:
  „Iszonyat lassú minden.” → ezen a gépen CPU-égető tilos; bizonyítás szintetikus fixture-rel vagy egyedül futtatva.
- **Fix `waitForTimeout` utáni mérés terhelés alatt MOZGÓ elemre esik** (smooth scroll, beúszó sáv) — nemcsak hamis piros,
  hanem HAMIS ZÖLD is: a lead-mobile „pill-on-bar” és a guest-mobile ⑥ visszarontása az átmeneti állapotból élt.
- **„epoll_wait + tétlen renderer” NEM beragadás-jel** — a waitForTimeout-os kapu normál állapota. A cfg-sheet-scroll-t
  kétszer leölték „beragadtként”, pedig lassú volt; az első (teljes-idő) korlát ugyanígy hamis pirosat adott.
- A csend-korlát + pufferelő pool összeakad (a pool a végén játssza vissza a kimenetet) → szívverés kell.
- Két SUB gépszintű `pkill -f`-et futtatott (egy idegen kapufutást is érinthetett) — csak PID szerint.

## Nyitva
- `lead-page-surface-check` 4 égető alatt egyszer rc 1 (nincs kivizsgálva; csak ha valódi landban is előjön).
- „C” opció (6 kapu-szál) felfüggesztve — a land-sor után valószínűleg nem kell.
- networkidle-lel lead-lapot tölt még: console-contrast, copy-panel, hero-override-ui, button-weight (a mock-photo-gate-nél
  szükséges) — olcsó következő kör.
- A land-sor mellett a commit-kori zöld csak akkor hasznosul, ha a main nem mozdult és nincs ADR-kiosztás (ADR-0275 ③);
  következő lépés lehet: a main mozgását a kapuk bemenetével tartalmilag összevetni.
- guest-mobile ⑥: 10 s után csak GYANÚ (nem piros), a cfg-sheet S11 viszont piros — eltérő szigor, élő landban 0 előfordulás.
- A `hooks/pre-commit` fejkommentje a gate-runner-check-ről („5 visszarontás”) elavult.

## Fájlok
Koordinátor: csak briefek a fán kívül (`~/rc-briefs/kapu-koordinator.md` és a hét SUB-brief), ez a jegyzet, `MEMORY.md`.
