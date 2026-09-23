## ADR-0178 — Egy gomb-osztály, amihez nincs szabály, némán az ELLENKEZŐJÉT csinálja (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi utasítás: „a ghost gombot is
javítsd meg") · **Őr:** `scripts/button-weight-check.mts` · **Kapcsolódó:** ADR-0169 (a
`con-btn2` ide olvad be), ADR-0021 ① (dizájn-mag), `feedback_one_rule_two_copies`.

**Kontextus — mérve, nem becsülve.** A konzolban hat helyen állt `class="ghost"`, és a
szándék egyértelmű volt: „halvány, másodlagos". A `.ghost`-hoz viszont **egyetlen CSS-szabály
sem tartozott** (grep a `citui*.css`-ekben: 0 találat), ezért a `submit` gombokra a
`.con button[type="submit"]:not(.ok):not(.bad):not(.hp-alt)` navy gradiense ült rá. A halott
osztály tehát nem semleges volt: **az ellenkezőjét csinálta annak, amit a neve ígért.**

**A kár, a valódi konzolon mérve (2026-09-15).** A lead-lapon két gomb (`Adatok
újragyűjtése`, `Portál-fotók újragyűjtése`) elsődlegesnek látszott. A `/duplicates` lapon
viszont a **három válaszból kettő** volt `ghost` — vagyis az `Ugyanaz — összevonás` (ami
lead-rekordokat VON ÖSSZE, és elérhetőségeket mozgat) **semmiben nem különbözött** a másik
két verdikttől: három egyforma navy gomb egymás mellett.

**Döntés.**
① **A `.ghost` hatályba lép**, a dizájn-mag MEGLÉVŐ ghost-mintája szerint
(`.citui-btn--ghost`: fehér lap, `line-strong` szegély, navy szöveg) — nem új stílus, hanem
a meglévő szándék érvényesítése —, és bekerül a navy szabály `:not()` láncába.
② **EGY másodlagos osztály van, nem kettő.** Az ADR-0169-ben bevezetett `con-btn2` ide
olvad be: két osztály ugyanarra a szerepre két igazság lenne ugyanazon a képernyőn.

**Őr — és ami a lényege.** `scripts/button-weight-check.mts` nem a `ghost`-ot őrzi, hanem a
**HIBAOSZTÁLYT**: minden osztály, amit egy konzol-gomb visel, vagy **FEST** (van rá szabály a
**betöltött** stíluslapokban — nem forrás-grepből, mert egy szabály, ami nem jut el a
böngészőig, nem szabály), vagy **HORGONY** (a lap saját szkriptje `querySelector`-ral
hivatkozik rá). Ami egyik sem: halott, és bukik. Ezen felül: a `ghost` sosem gradiens · a
másodlagos felirat kontrasztja ≥ 4,5 (a „halvány" nem jelentheti azt, hogy „nem látszik") ·
a duplikátum-döntés sorában pontosan EGY elsődleges gomb.
⭐ **Az őr rögtön talált egy MÁSODIK szabály nélküli osztályt** (`.gen-go`) — az viszont
VALÓDI JS-horgony, tehát nem bukás. Az első változatom kézi kivétel-listát használt; a
horgony-felismerés **szerkezeti** lett, így a következő horgonyhoz nem kell az őrhöz nyúlni,
a következő HALOTT osztály viszont fennakad.
**Piros önteszt:** a betöltött lapon visszaadjuk a `ghost`-nak a navy gradienst (pontosan a
2026-09-15 előtti állapot) → **199 állítás megy pirosra**.

**Visszafordíthatóság:** 🔄 tisztán megjelenítés; adat- és sémaérintés nincs.
**Élesítés:** NINCS (§0.3).
⚠️ **Sorszám:** `git fetch` + rebase után, közvetlenül írás előtt ellenőrizve (az origin/main
legmagasabbja 0169 volt).
