# 2026-09-29 — A `mobile-chrome-check` párhuzamosítása + indokolt önátfedés a futtatóban (A+B)

A lassú-land vizsgálat (ADR-0260) javaslata; a tulaj a koordinátoron át jóváhagyta („mehet”).
Döntés: ADR-XXXX (`XXXX-mobile-chrome-check-parhuzamos-munkasok-es-onatfedes.md`).

**Mérve (a gépen közben 2–7 idegen kapu-futtató):**
- a kapu egyedül: 546 s → 189 · 182 · 163 s (4 munkás, 3/3 zöld);
- `--selftest`: 158 s → 51 · 48 · 47 s (3/3 zöld, mind a 7 beültetett hiba piros);
- a lapok ítélet-sorai 6/6 futásban betűre azonosak a soros futáséval;
- sablont érintő land kapusora (galéria land2, 84 kapu, cache nélkül): 960 s → 691 s
  (⚠️ más terhelés: load1 ~8 vs ~2–3). A kritikus út most a `lead-page-surface-check` (313 s)
  és a `guest-mobile-check` (206 s) — ezek a következő jelöltek, a gazdáik döntésével.

**Tanulság:** a `gate-runner-check` „szkript-kizárás ki” visszarontása a MINTÁT keresi — az
átírásom után hangosan bukott („a minta nincs meg”), nem zöldült némán. Jól működött: minta-
alapú visszarontásnál a szállított alak változásakor a mutációt is át kell írni.

**Módosított fájlok:** `scripts/mobile-chrome-check.mts`, `scripts/lib/gate-runner.mjs`,
`scripts/gate-runner-check.mts`, az ADR, ez a jegyzet (+ a két generált index).
