# 2026-09-29 — outreach-link-live-check: 208 s → 38 s (networkidle → load)

- **Szál:** `cit21b5f556`, SUB a `cit3bd83952` kapu-koordinátor alatt. Brief: `~/rc-briefs/outreach-link-live-gyorsitas.md`.
- **Ok:** 38 lapbetöltés `networkidle`-re várt; a lead-lap 19–20 photo-health kérése külső portálfotókat tölt
  → 5–10 s/lap egyedül, ~31 s terhelés alatt. `load` ≈0,7 s.
- **Javítás:** `waitUntil: "load"`, lásd ADR-0266 (`outreach-link-live-load-nem-networkidle`). Állítások, viewportok, önteszt változatlan.
- **Mérés:** előtte 208 s, utána 38/39 s; 421 ítélet-sor betűre azonos (normalizálva: szerver-napló sorrend, fixture UUID).
  Önteszt 3/2/1 piros.
- **Marad író** (teljes prospect-tábla enumeráció + saját fixture).
- **Módosított fájlok:** `scripts/outreach-link-live-check.mts`, az ADR, ez a jegyzet.
- **Nyitva:** a többi `networkidle`-es lead-lapos kapu (console-contrast, copy-panel, hero-override-ui, button-weight, mock-photo-gate) — következő kör.
