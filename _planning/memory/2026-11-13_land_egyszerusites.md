# 2026-11-13 — Land egyszerűsítés: böngészős kapuk óránként, egyszeri újrafuttatás (ADR-XXXX)

**Session:** `cit565535c3` · **Brief:** `~/rc-briefs/land-egyszerusites-20261113.md` (+ a `cit5f6654b8` session kiegészítése)

## Elvégezve
- `scripts/lib/gate-runner.mjs`: LAND-módban a böngészős kapu nem fut (kiírja: „óránként fut”); `// gate-runner: land-blocking — <ok>` jelölés = a landon is blokkol; `CIT_GATE_HOURLY=1` = csak a land-en nem futók; `CIT_FULL_LAND=1` = régi teljes land; minden bukó kapu egyszer újrafut (`runRetry`, időtúllépés nem), statisztika `cit-gate-retries.log`.
- `scripts/gate-hourly.sh` + `scripts/gate-hourly-alert.mts` + `deploy/systemd/citoviso-gate-hourly.{service,timer}` (dev, `targets.json`).
- `scripts/lib/main-probe.mjs`: kényszerített futás a mainen, „NEM FUTOTT LE” ítélet a 0 s-os álzöld helyett.
- `scripts/land.sh`: fázisidők + 10 leglassabb kapu a végén. `.gitattributes`: `/MEMORY.md merge=union`.
- 13 kapu fejlécében land-blocking jelölés (lista és ok az ADR-ben).
- Őrök: `gate-runner-check` (K bővítve, új L, J pool-korlát 8→15 s, 31 visszarontás), `main-probe-check` (új ⑩, 8 visszarontás).

## Mérve
- 374 egyedi kapu-szkript, ebből 134 böngészős szabályú; 405 kapuhívásból 53 szűrő nélküli: 9 böngészős (óránkéntire került vagy jelölt), 44 nem böngészős, mind ≤ 20 s, hermetikus — nem szűkítve.
- Leglassabbak (kapuidő-előzmény): mock-trial-overlay-check ~980 s (+ önteszt ~980 s), mobile-chrome-check 339 s, hero-fit-check 273 s, cfg-sheet-scroll 270 s, lead-page-surface 186 s — mind óránkéntire került.

## Nyitott
- A timer telepítése a land után (fő fában): `sudo cp deploy/systemd/citoviso-gate-hourly.* /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now citoviso-gate-hourly.timer`.
