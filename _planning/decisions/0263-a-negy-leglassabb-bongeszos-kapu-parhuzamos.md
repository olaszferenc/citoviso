## ADR-0263 — A négy leglassabb böngészős kapu párhuzamos munkásokkal mér, közös, sorrendtartó munkás-körrel (`scripts/lib/gate-pool.mts`) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** a koordinátor kérdésére („A négy lassú kapu gyorsítása: kiosszam
  egy szálra?”): *„Igen”*. Brief: `~/rc-briefs/lassu-kapuk-parhuzamositasa.md`. Az ADR-0261 után a
  sablont érintő land kritikus útja ez a négy kapu lett (ADR-0261 „Nyitva” pontja).
- **Előzmény:** ADR-0227 (párhuzamos kapu-futtatás), ADR-0230 (gép-szintű slotok), ADR-0260 (a land
  újrahasznosítja a commitkori zöldet), ADR-0261 (`mobile-chrome-check` 4 munkással + indokolt
  önátfedés-jelölés).

**Hol ment el az idő (mérve, `CIT_GATE_POOL_TIMES` egység-idők):** mind a négy kapuban egymástól
független (lap, nézet) mérések futottak EGYMÁS UTÁN, egy magon; az indulás (tsx + Chromium + fixture-
renderelés) 4–8 s. Az egységek összege ≈ a régi futásidő:

| kapu | egységek | egy egység | egységek összege |
|---|---|---|---|
| `lead-page-surface-check` | 82 (① 38 · ② 38 · ③ 2 · ④ 4) | 1,2–14 s (a ④d szándékosan a 12 s-os plafonig vár) | ~320 s |
| `guest-mobile-check` | 30 (sablon/archetípus × 3 nézet) | 4,6–8,6 s | ~201 s |
| `guest-mobile-check --selftest` | 11 | 7,0–8,3 s | ~85 s |
| `room-details-check` | 38 (19 sablon × 2 szélesség) | 4,5–5,1 s | ~177 s |
| `lead-mobile-check --gate --selftest` | 19 (10 tiszta + 9 visszarontás) | 6,9–17,8 s | ~185 s |

A várakozások (pirula-nyugvópont, 650 ms hidratálás, `walk()`) a mérés részei — ezeket NEM
rövidítettem, csak egymás mellé tettem.

**Audit — közös írt állapot (kapunként):**
- `lead-page-surface-check`: a fixture-eket a munkafa-kulcsú `assets/Temp/_leadsurface-<fa>/` alá írja
  a pool ELŐTT; az egységek csak olvassák, az öntesztek saját nevű fájlt írnak (`_nopin`, `_norow`,
  `<id>.noavoid`, `_oscillate`), a képek nézetenként külön nevet kapnak. A DB-t csak olvassa
  (`mock_artifact` id). → párhuzamosítható. Önátfedés nem kérdés (a hook egyszer hívja).
- `guest-mobile-check`: `setContent`, nem ír semmit (`--shots`/`--json` csak kérésre; a hook egyiket sem
  adja). → párhuzamosítható, ÉS indokolt `self-overlap-safe` fejlécet kapott: az önteszt és a fő
  futás egymás mellett futhat (eddig a futtató láncba tette: 87 + 201 s).
- `room-details-check`: saját `mkdtemp`; egységenként munkásonkénti saját lap (a soros futás is
  egy lapot használt újra szélességenként). → párhuzamosítható.
- `lead-mobile-check --gate`: minden futás saját kontextus, route-on kiszolgált fixture, saját
  kép-könyvtár (`<sablon>-<visszarontás>/<nézet>-NN-…`). → párhuzamosítható.
- Scratch-DB, közös `sites/`-fixture: egyik kapu sem használ (`reference_shared_sites_fixture_race`,
  `reference_module_upsell_check_scratch_db_race` nem érinti).

**Döntés**

1. **Közös segéd: `scripts/lib/gate-pool.mts`.** `pool(items, fn)` `CIT_GATE_JOBS` (alap 4; `=1` a
   régi soros viselkedés) munkással futtatja az egységeket, és az eredményt az EREDETI sorrendben
   adja vissza. Egy egység futás közbeni kiírása (`out()`/`err()`) az egységhez pufferelődik
   (AsyncLocalStorage), és a kapu sorrendben játssza vissza → a kimenet ugyanaz, mint sorosan.
   ⛔ Minden hely előre „a mérés nem futott le” hibával töltődik; csak befejezett egység írja felül —
   eredmény nélküli egység = hangos bukás, sosem zöld. `CIT_GATE_POOL_TIMES=<fájl>` egység-időket ír
   (a fenti bontás forrása).
2. **A négy kapu** a (lap, nézet) egységeit a poolon futtatja; a mérési lépések, szabályok,
   küszöbök, időtúllépések, beültetett hibák és önteszt-ítéletek VÁLTOZATLANOK. Timeoutot nem
   emeltem. A `mobile-chrome-check` saját (ADR-0261) megoldásához nem nyúltam.
3. **`guest-mobile-check`:** `// gate-runner: self-overlap-safe — …` fejléc (ADR-0261 mechanizmusa).

**Eredmény (egyedül futtatva; a gépen közben idegen kapu-futtatók, load1 0,6–13,9):**

| | előtte (soros, 3 futás) | utána (4 munkás) |
|---|---|---|
| `lead-page-surface-check` | 313 · 307 · 307 s | **91 · 90 · 94 s** |
| `guest-mobile-check` | 214 · 201 · 201 s | **56 · 57 · 57 s** |
| `guest-mobile-check --selftest` | 101 · 87 · 87 s | **27 · 27 · 27 s** (+ a fő futással együtt futhat) |
| `room-details-check` | 183 · 179 · 179 s | **50 · 50 s** |
| `room-details-check --selftest` (nincs a hookban) | 2395 s (1 futás) | **650 · 641 s** |
| `lead-mobile-check --gate --selftest` | 167 · 168 · 168 s | **50 · 51 s** |

- **Ítélet-sorok:** a `lead-page-surface`, `guest-mobile` (+önteszt), `room-details` és
  `lead-mobile` TELJES kimenete betűre azonos a soros futáséval (a `lead-page-surface`-ben csak a
  mért pirula-idő „(N ms)” normalizálva).
- **Negatív kontrollok párhuzamosan is pirosak:** `lead-page-surface` ④ (4 ág), `guest-mobile` 9
  ültetett hiba, `room-details` 14 visszarontás mind 38/38 piros, `lead-mobile` 9 visszarontás.
- **Élő bizonyíték az „eredmény nélküli = bukás” szabályra:** egy mérés leállításakor a böngésző a
  `room-details-check` futása közben megszűnt → „⛔ a mérés nem futott le: … browser has been
  closed”, 14/38 bukás, nem-nulla kilépés.
- **A mérés úgy állt le, ahogy a koordinátor kérte** („ne indíts újabb többórás soros mérést”): a
  `room-details`/`lead-mobile` 3. utána-futása és a `CIT_GATE_JOBS=1`-es kör nem készült el.

**Nyitott megfigyelés (NEM zöld):** a `room-details-check --selftest` „a felugró fixed pozíciójának
leütése” visszarontásánál a lelet-SZÖVEGBEN a dokumentumba esett felugró y-koordinátái futásonként
eltérnek (pl. `doboz=[0,7100,…]` ↔ `[0,7229,…]`). Számok nélkül a kimenet betűre azonos, a
visszarontás mindkétszer 38/38 piros. Két PÁRHUZAMOS futás egymástól is eltér ugyanitt, tehát az
érték futás-függő — de soros-soros összevetés nem készült (~40 perc), így nem állítom, hogy a
soros futás itt determinisztikus lenne.

**Nyitva:** egy slot most 4 lapot járat (ADR-0230: egy slot = egy kapu) — a `CIT_GATE_JOBS` a
slot-számmal együtt hangolható, ha a gép terhelése ezt kéri.
