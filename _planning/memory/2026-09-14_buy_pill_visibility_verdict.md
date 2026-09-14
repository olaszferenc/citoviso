# 2026-09-14 — A vásárlás-pirula őre órára mért, és a zöldje egy láthatatlan gombot igazolt

**Kiindulás:** a `configurator-float-check` PIROS volt az `origin/main`-en (aurora, asztali,
`opacity: 0`), és megállította egy párhuzamos szál landolását. Ő három fán mérte meg
(saját commit-fa, tiszta ág-fej, `origin/main`) — mindenhol ugyanaz —, ezért repó-szintű,
korábbi hibaként külön szálra (ide) került. A kérdés: **valódi vevő-oldali hiba, vagy őr-hiba?**

## A válasz: ŐR-HIBA — de az őr mindkét irányban hazudott

A vásárlás-pirula **minden mérésben megjelenik**. Bevétel-kiesés nincs. Viszont az őr nem
egyszerűen „türelmetlen" volt.

### ① A piros: óra-alapú mintavétel egy szóródó megjelenésre
Az őr a görgetés után **fix 700 ms**-mal mintázott. A megjelenés az aurorán **438–1047 ms**
között szóródik — a lap SAJÁT görgetési munkája dönti el, nem a mi kódunk (a többi sablon
~150 ms). Ugyanazon a **változatlan** buildon, ugyanezen a gépen, 10 futás:

```
run 1–5: ZÖLD    run 6,7,8: PIROS    run 9: ZÖLD    run 10: PIROS
→ 4/10 PIROS
```

### ② ⛔ A zöld fele volt a VESZÉLYESEBB
A zöld futások részletei: `opacity=0  pointer-events=auto  hit=true`.

700 ms-nál a pirulán **már rajta volt** a `pointer-events: auto`, és az `elementFromPoint`
**el is találta** — miközben az opacitása **pontosan 0** volt. A levágott képernyőkép a pirula
helyéről ekkor: **nincs ott semmi**. Vagyis az őr hat futásból hatszor egy **láthatatlan
vásárlás-gombot igazolt kattinthatónak**.

> Az `elementFromPoint` **az átlátszó elemet is eltalálja.** Önmagában arra válaszol, hogy
> „takarja-e valami ezt a dobozt", **sosem** arra, hogy „látja-e ember".

Opacity-görbe a görgetéstől (aurora/asztali): `0 · 0 · 0 · 0* · 0* · 0* · 0,86* · 1*`
(200 ms-onként, `*` = a `.cit-cfg-in` osztály már rajta) — az osztály ~800 ms-nál száll rá,
de a festés csak ~1200 ms-nál indul: a főszál akadozása miatt **400 ms-os ablak**, amiben a
gomb kattintható és láthatatlan.

### ③ A vevő útja rendben van (mérve)
| út | mit tesz a vevő | mikor látszik |
|---|---|---|
| görgetés | egérgörgő / érintés | aurora 1,0–1,8 s · többi sablon ~0,5 s |
| **nem görget** | csak nézi a lapot | a feltétel nélküli `setTimeout(showPill, 2600)` → **3,3–3,6 s** |

Az aurora azért lassú, mert a lapja nehéz (`scroll-behavior: smooth` + saját animált háttér):
a smooth-scroll kikapcsolásával 91–369 ms, valódi egérgörgővel 357–984 ms. **Sosem tűnik el.**

## Szállítva

- **A verdikt KETTŐS lett:** `KIFESTVE (opacity === 1)` **ÉS** `NEM TAKART (elementFromPoint)`.
- **A várakozás a PIXELRE vár**, nem órára: rAF-enkénti poll, amíg ki nem fest. A keret
  **kimondott**, és a termék saját állandóiból származik (2600 + 500 + 4000 ms ráhagyás),
  nem egy szerencsés mintavételből. Ha sosem fest ki: **PIROS**, nem elnyelt timeout.
- ⚠️ **Az első keretem 5000 ms volt — és a teljes futásban 4624 ms jött ki.** Alig-átmenő
  érték, vagyis a következő érme-feldobás (lásd [[feedback_barely_passing_value_hides_a_dead_rule]]).
  Külön mérve a terhelésmentes szórás 3255–3591 ms volt: **~1 s a keretből gép-terhelés**,
  nem termék-viselkedés. Ezért lett a keret levezetve, nem tippelve.
- **Új önteszt ③:** átlátszóra állított `.cit-cfg-in` szabály — a geometriai verdikt itt
  **ZÖLD marad** (ez a lényeg: vak rá), a láthatósági **PIROSRA megy**. Pont az az állapot,
  amit a régi őr átengedett.
- **Új mérés ④:** a nem-görgető látogató.
- **A pre-commit trigger mostantól az őr SAJÁT fájljára is szól** — eddig az őr átírása
  ellenőrizetlenül ment át, pedig a hibaosztály egy CSS-sor és egy időzítés.

**Eredmény:** 19 sablon × 3 állítás + 4 önteszt, **két egymás utáni teljes futás zöld**,
a legrosszabb aurora/asztali kifestés 1936 ms a 4500 ms-os kereten belül.

## Amibe belefutottam

- **A munkafám (`~/wt/cit2167c7de`) EGY MÁSIK élő session commitolatlan munkáját tartalmazta**
  (Elek FK-005a panel-jelzés, +380 sor a runtime-fájlokban). Nem nyúltam hozzá: tiszta
  worktree-t húztam `origin/main`-ről (`~/wt/citcfgfloat`), ott mértem és ott landolok.
  Lásd [[reference_shared_worktree_collision]].
- **IKER-JAVÍTÁS.** Munka közben landolt `1ee2fe8`, ami ugyanennek a pirosnak a *piros felét*
  szintén javította (`waitForSelector(".cit-cfg-in")` + 700 ms), és a rebase konfliktusban jött
  elő. Az ő változata a fantom-pirosat gyógyítja, a **hamis zöldet nem** — ezért az övé elesett.
  Ugyanaz a commit a pirulát rAF-tickre mozgatja is (hogy ne üljön a hero CTA-ra), ezért a
  rebase után **újra végigmértem**: zöld.

## Nyitott

- Az aurora ~10× lassabb görgetés-válasza megmaradt (a lap sajátja, nem a mi kódunk). A belépő
  kifestése így is 2,3× kereten belül van, de ha egy sablon ennél lassabb lesz, az őr most már
  **megnevezi** (a log kiírja a kifestési időt sablononként), nem elnyeli.

**Fájlok:** `scripts/configurator-float-check.mts` · `hooks/pre-commit` ·
`_planning/DECISIONS.md` (ADR-0147)
