# 2026-09-29 — A `cfg-sheet-scroll-check` gyorsítása (pool + nyugvópont, ADR-XXXX)

Brief: `~/rc-briefs/cfg-sheet-scroll-gyorsitas.md` (koordinátor `cit3bd83952`, tulaj: „Ok a és b”).

**Kész:** mind a 25 egység (18 fő + 7 piros önteszt) a közös poolon; a húzás utáni 450 ms fix alvás
helyett nyugvópont-várás; új S11 (4 s alatt nem nyugvó mérés = PIROS, az önteszten is); CDP-session
oldalanként egy. Előtte ~20 perc (soros, terhelés alatt) → egyedül 294–306 s, 4 égetővel 411 s.

**Tanulságok:**
- ⚠️ A húzás költsége NEM az utó-alvás volt: a 12 touchMove terhelés alatt ~580 ms (a
  `dispatchTouchEvent` a renderelő nyugtájára vár), a nyugvópont átlag ~316 ms (a 250 ms-os alsó
  korláthoz közel). A gesztus sebességét nem rövidítettem — a lendületet is az adja.
- A CDP-session újrahasznosítása mérve alig hozott (294 vs 306 s, zajon belül).
- Az S11 negatív kontrollja: 100 ms-os plafonnal mind a 6 egység piros — a szabály tud bukni.
- A pool a kimenetet puffereli: a kapu a teljes pool-időre néma (290–390 s) — a 900 s-os
  `CIT_GATE_JOB_SILENCE` (ADR-0269) alatt, de a szívverés a gate-pool-ba a `cite558120f` szál dolga.

**Módosított fájlok:** `scripts/cfg-sheet-scroll-check.mts`,
`_planning/decisions/XXXX-a-cfg-sheet-scroll-kapu-is-a-kozos-poolon-mer.md`, ez a jegyzet.
