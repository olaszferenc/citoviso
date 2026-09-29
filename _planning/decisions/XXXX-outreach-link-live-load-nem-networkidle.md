## ADR-XXXX — Az outreach-link-live-check a lap `load` eseményére vár, nem a `networkidle`-re (2026-09-29)

- **Kiváltó:** a soros kapu-sáv farka (ADR-0265 mérése): a `scripts/outreach-link-live-check.mts`
  egymagában 298,7 s, ill. 674,6 s ugyanazon a diffen. Brief: `~/rc-briefs/outreach-link-live-gyorsitas.md`
  (koordinátor `cit3bd83952`, tulaj: „Outreach-kapu, majd C”).

**A mért ok:** 38 lapbetöltés (18 prospect-es lead × 2 viewport + a saját fixture × 2), mindegyik
`waitUntil: "networkidle"`. Egy lead-lapon: `domcontentloaded` ≈0,5 s · `load` ≈0,7 s · `networkidle`
5,6–10 s egyedül, terhelés alatt ~31 s. A különbség a lap 19–20 `/lead/:id/photo-health` kérése, ami
szerver-oldalon KÜLSŐ portálfotókat tölt le (`fetchPhoto`) — hálózat- és terhelésfüggő, ez a 299↔675 s
szórás oka. DB-lekérdezés, konzol-indítás: < 5 s.

**Döntés:** `waitUntil: "load"` (+ a meglévő 350 ms). A mért `#prospects` panel teljesen szerver-oldali
(`src/console/views.ts`), a photo-health visszahívásai nem érintik és `.catch`-csel védettek; a `load`
garantálja a stíluslapokat, tehát a ③ kirajzolt-gradiens mérése érvényes marad. A photo-health végpont
CSAK olvas (DB-írás csak a POST-os tudomásulvétel-függvényekben van; a cache folyamaton belüli `Map`),
így a félbehagyott kérések a közös dev DB-t nem változtatják.

**Marad ÍRÓ (soros sáv):** fixture-leadet, prospectet és scrape_run-t ír, ÉS a TELJES `prospect` táblát
enumerálja — egy párhuzamos kapu félig beírt/törölt fixture-je hamis pirosat adna. Az `own-fixture-only`
jelölés nem bizonyítható.

**Bizonyítás:** előtte 208 s (egyedül), utána 38 s és 39 s; 421 ítélet-sor betűre azonos (a szerver
aszinkron „nyitókép” naplósorai és a véletlen UUID-s fixture-lead azonosító normalizálva). Önteszt:
no-live 3 · two-live 2 · old-section-open 1 állítás piros.

**Nyitva (következő kör):** ugyanígy `networkidle`-lel tölt lead-lapot: `console-contrast-check`,
`copy-panel-check`, `hero-override-ui-check`, `button-weight-check`, `mock-photo-gate-check` — egyenként
ellenőrizendő, hogy a mérésük függ-e a photo-health eredményétől (a `mock-photo-gate-check`-é igen).
