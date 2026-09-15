# 2026-09-15 — A halott gomb-osztály (ADR-0178): a `ghost` az ellenkezőjét csinálta

**Szál:** `wt/megkeresesszerk` (B6 utómunka) · **Élesítés: NINCS.**
**Tulajdonosi utasítás:** „a ghost gombot is javítsd meg."
**Őr:** `scripts/button-weight-check.mts`

## A hiba

A konzolban hat helyen állt `class="ghost"` — a szándék „halvány, másodlagos". A `.ghost`-hoz
viszont **egyetlen CSS-szabály sem tartozott**, ezért a `submit` gombokra a
`.con button[type="submit"]:not(…)` **navy gradiense** ült rá.

⛔ **A halott osztály nem semleges volt: az ellenkezőjét csinálta annak, amit a neve ígért.**
Ez a tanulság — egy szabály nélküli osztály nem „nem csinál semmit", hanem átengedi az elemet
a legszélesebb szabálynak, ami épp illeszkedik rá.

## A kár, mérve (valódi konzol, 2026-09-15)

- lead-lap: 2 gomb (`Adatok újragyűjtése`, `Portál-fotók újragyűjtése`) elsődlegesnek látszott
- `/duplicates`: a **három válaszból kettő** volt `ghost` → **három egyforma navy gomb**, és
  köztük az `Ugyanaz — összevonás`, ami **lead-rekordokat von össze** és elérhetőségeket mozgat.
  A kurátor a képről nem tudta megmondani, melyik a fő válasz.

## A javítás

A `.ghost` a dizájn-mag **meglévő** ghost-mintáját kapta (`.citui-btn--ghost`: fehér lap,
`line-strong` szegély, navy szöveg) — nem új stílus, hanem a meglévő szándék hatályba léptetése —
és bekerült a navy szabály `:not()` láncába. Az ADR-0169-ben bevezetett `con-btn2` **beolvadt**:
két osztály ugyanarra a szerepre két igazság lenne ugyanazon a képernyőn.

## Az őr — nem a `ghost`-ot őrzi, hanem a HIBAOSZTÁLYT

Minden osztály, amit egy konzol-gomb visel, vagy **FEST** (van rá szabály a **betöltött**
stíluslapokban — nem forrás-grepből: egy szabály, ami nem jut el a böngészőig, nem szabály),
vagy **HORGONY** (a lap saját szkriptje `querySelector`-ral hivatkozik rá). Ami egyik sem:
halott, és bukik. Plusz: a `ghost` sosem gradiens · a másodlagos felirat kontrasztja ≥ 4,5
(a „halvány" nem jelentheti azt, hogy „nem látszik") · a duplikátum-döntés sorában pontosan
EGY elsődleges gomb.

⭐ **Az őr rögtön talált egy MÁSODIK szabály nélküli osztályt:** `.gen-go`. Az viszont VALÓDI
JS-horgony (`querySelector('button.gen-go')`), tehát jogosan nincs szabálya. Az első
változatom kézi kivétel-listát használt volna — a horgony-felismerés ezért **szerkezeti** lett:
a következő horgonyhoz nem kell az őrhöz nyúlni, a következő HALOTT osztály viszont fennakad.

**Piros önteszt:** a betöltött lapon visszaadjuk a `ghost`-nak a navy gradienst (pontosan a
javítás előtti állapot) → **199 állítás megy pirosra**.

## Amit érdemes megjegyezni a módszerről

- A „mi látszik ma?" kérdésre **a kirajzolt háttérrel** válaszoltam (`backgroundImage`
  gradiens-e), nem class-névvel. A class-név épp az, ami hazudott.
- A kontrasztot a **TÉNYLEGESEN látható** háttérhez mérem: átlátszó gombnál felfelé keresem az
  első nem-átlátszó ős hátterét, különben egy láthatatlan színhez mérnék.
- A teljes-lapos screenshot itt használhatatlan volt (a `/duplicates` 21 615 px magas) — a
  **döntés-sort kivágva** lett látható a lényeg, előtte/utána.

## Módosított fájlok

- `public/assets/ui/citui-console.css` — a `.ghost` hatályba lép; a `con-btn2` beolvad
- `src/console/views.ts` — `class="con-btn2"` → `class="ghost"`
- `scripts/button-weight-check.mts` — ÚJ őr (szerkezeti horgony-felismerés + piros önteszt)
- `hooks/pre-commit` — bekötve (a CSS és az őr saját fájlja is trigger)
- `_planning/DECISIONS.md` — ADR-0178
